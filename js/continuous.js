(function() {
// Constants and configuration
const PLOT_CONFIG = {
    margin: { top: 30, right: 50, bottom: 70, left: 95 },
    viewBoxWidth: 1200,
    viewBoxHeight: 600,
    fontSize: {
        axisLabel: 34,
        legendText: 30,
        annotationText: 25,
        tickLabel: 14
    },
    tickSize: 11,
    tickWidth: 1.5
};

// Computed plot dimensions
const PLOT_AREA = {
    width: PLOT_CONFIG.viewBoxWidth - PLOT_CONFIG.margin.left - PLOT_CONFIG.margin.right,
    height: PLOT_CONFIG.viewBoxHeight - PLOT_CONFIG.margin.bottom - PLOT_CONFIG.margin.top
};

// Element selectors
const SELECTORS = {
    scatterPlotTrue: 'scatter-plot-true-cont',
    scatterPlotObserved: 'scatter-plot-observed-cont',
    distributionPlotTrue: 'distribution-plot-true-cont',
    distributionPlotObserved: 'distribution-plot-observed-cont',
    rocPlot: 'roc-plot-cont',
    prPlot: 'pr-plot-cont',
    dcaPlot: 'dca-plot-cont'
};

// State variables
let thresholdValue = 0;
let rocInitialized = false;
let currentView = "observed";
let trueLabeledData = [];
let observedLabeledData = [];
let currentLabeledData = [];
let trueMetrics = {};
let observedMetrics = {};
let xScale, yScale;

// Utility functions
function computeObservedR(trueR, reliabilityX, reliabilityY) {
    return trueR * Math.sqrt(reliabilityX * reliabilityY);
}

// Helper function to generate data points and labeled data
function generateLabeledData(r) {
    // Check the state of the precise estimates checkbox
    const preciseCheckbox = document.getElementById("precise-estimates-checkbox-cont");
    // Corrected numPoints logic from previous user interaction if needed
    const numPoints = preciseCheckbox && preciseCheckbox.checked ? 200000 : 50000; 
    const numPlotPoints = 4000; // Keep plot points lower for performance
    const meanX = 0, meanY = 0, stdDevX = 1, stdDevY = 1;
    const baseRate = parseFloat(document.getElementById("base-rate-slider-cont").value) / 100;

    // Generate the full dataset
    const fullData = d3.range(numPoints).map(() => {
        const x = d3.randomNormal(meanX, stdDevX)();
        const y = r * (x - meanX) + Math.sqrt(1 - r ** 2) * d3.randomNormal(meanY, stdDevY)();
        return { x, y };
    });

    // Sort and divide for colors
    const sortedData = fullData.sort((a, b) => b.y - a.y);
    const thresholdIndex = Math.floor(numPoints * baseRate);
    const tealData = sortedData.slice(0, thresholdIndex);
    const grayData = sortedData.slice(thresholdIndex);

    // Create labeled data
    const labeledData = [
        ...tealData.map(d => ({ ...d, trueClass: 1 })),
        ...grayData.map(d => ({ ...d, trueClass: 0 }))
    ];

    // Return necessary data components
    return { labeledData, tealData, grayData, sortedData, thresholdIndex, numPlotPoints, numPoints, fullData };
}

// Function to compute all effect size metrics
function computeEffectSizeMetrics(tealX, grayX) {
    // Compute basic statistics
    const meanTeal = d3.mean(tealX);
    const meanGray = d3.mean(grayX);
    const varianceTeal = d3.variance(tealX);
    const varianceGray = d3.variance(grayX);
    const nTeal = tealX.length;
    const nGray = grayX.length;

    // Cohen's d with pooled standard deviation
    const pooledSD = Math.sqrt(((nGray - 1) * varianceGray + (nTeal - 1) * varianceTeal) / (nGray + nTeal - 2));
    const d = (meanTeal - meanGray) / pooledSD;

    // Compute rank-biserial correlation
    const allData = [...tealX, ...grayX].sort(d3.ascending);
    const tealRankSum = d3.sum(tealX.map(x => d3.bisect(allData, x)));
    const rankBiserial = 2 * (tealRankSum / nTeal - (nTeal + nGray + 1) / 2) / (nTeal + nGray);

    // Adjust for unequal variances and sample sizes
    const nonpooledSD = Math.sqrt((varianceGray + varianceTeal) / 2);
    const da = (meanTeal - meanGray) / nonpooledSD;
    const glassD = (meanTeal - meanGray) / Math.sqrt(varianceGray);

    // Cohen's U3 = proportion of Group 2 that exceeds the median of Group 1
    const cohensU3 = StatUtils.normalCDF(da, 0, 1); // Using da (non-pooled) for consistency

    return {
        d,
        rankBiserial,
        da, 
        glassD,
        cohensU3,
        meanTeal,
        meanGray,
        varianceTeal,
        varianceGray
    };
}

// Function to compute metrics at a given threshold
function computePredictiveMetrics(threshold, data) {
    const predictions = data.map(d => d.x >= threshold ? 1 : 0);
    const trueClasses = data.map(d => d.trueClass);
    
    let TP = 0, FP = 0, TN = 0, FN = 0;
    
    for (let i = 0; i < data.length; i++) {
        if (trueClasses[i] === 1) {
            if (predictions[i] === 1) TP++;
            else FN++;
        } else {
            if (predictions[i] === 1) FP++;
            else TN++;
        }
    }
    
    const sensitivity = TP / (TP + FN) || 0;
    const specificity = TN / (TN + FP) || 0;
    const ppv = TP / (TP + FP) || 0;
    const npv = TN / (TN + FN) || 0;
    const accuracy = (TP + TN) / data.length;
    const balancedAccuracy = (sensitivity + specificity) / 2;
    const f1Score = 2 * (ppv * sensitivity) / (ppv + sensitivity) || 0;
    
    // Calculate Matthews Correlation Coefficient (MCC)
    const mcc = ((TP * TN - FP * FN) /
        Math.sqrt((TP + FP) * (TP + FN) * (TN + FP) * (TN + FN)) || 0);
    
    return {
        TP, FP, TN, FN,
        sensitivity,
        specificity,
        ppv,
        npv,
        accuracy,
        balancedAccuracy,
        f1Score,
        mcc,
        fpr: 1 - specificity
    };
}

// Cleanup function for switching views
function cleanupContinuous() {
    // Reset state and clean up plots (existing cleanup)
    Plotly.purge(SELECTORS.rocPlot);
    Plotly.purge(SELECTORS.prPlot); 
    
    // Cleanup DCA module
    if (typeof DCAModule !== 'undefined') {
        DCAModule.cleanup('continuous');
    }
    
    // Add purging/cleanup for D3 plots if necessary
    d3.select(`#${SELECTORS.scatterPlotTrue}`).selectAll("*").remove();
    d3.select(`#${SELECTORS.scatterPlotObserved}`).selectAll("*").remove();
    d3.select(`#${SELECTORS.distributionPlotTrue}`).selectAll("*").remove();
    d3.select(`#${SELECTORS.distributionPlotObserved}`).selectAll("*").remove();

    // Reset global vars if needed
    thresholdValue = 0;
    rocInitialized = false;
    trueMetrics = {};
    observedMetrics = {};
    currentView = "observed";
    trueLabeledData = [];
    observedLabeledData = [];
}

// Drawing functions
function drawScatterPlot(r, type, plotDataGen) {
    // Use pre-generated data
    const { tealData, grayData, sortedData, thresholdIndex, numPlotPoints, numPoints, fullData } = plotDataGen;

    // Subsample for plotting (using full generated data)
    // Ensure fullData is used for subsampling if plotData isn't directly passed or suitable
    const plotData = fullData.filter((_, i) => i % Math.max(1, Math.floor(numPoints / numPlotPoints)) === 0);

    // Use full dataset for metric calculations (passed directly)
    drawDistributions(tealData.map(d => d.x), grayData.map(d => d.x), type);

    const scatterXScale = d3.scaleLinear().domain([-4, 4]).range([PLOT_CONFIG.margin.left, PLOT_CONFIG.margin.left + PLOT_AREA.width]);
    const scatterYScale = d3.scaleLinear().domain([-4, 4]).range([PLOT_CONFIG.margin.top + PLOT_AREA.height, PLOT_CONFIG.margin.top]);

    const svgScatter = d3.select(`#${type === "true" ? SELECTORS.scatterPlotTrue : SELECTORS.scatterPlotObserved}`)
        .selectAll("svg")
        .data([null])
        .join("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        // Use standard viewBox, remove width/height attributes if they existed
        .attr("viewBox", `0 0 ${PLOT_CONFIG.viewBoxWidth} ${PLOT_CONFIG.viewBoxHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("display", "block")
        .style("max-width", "100%");

    // Axes - Use viewBox dimensions for positioning
    svgScatter.selectAll(".x-axis")
        .data([null])
        .join("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${PLOT_CONFIG.margin.top + PLOT_AREA.height})`) 
        .call(d3.axisBottom(scatterXScale).ticks(5).tickFormat(() => ""))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-width", PLOT_CONFIG.tickWidth)
            .attr("y2", PLOT_CONFIG.tickSize))
        .call(g => g.selectAll("path.domain")
            .attr("stroke-width", PLOT_CONFIG.tickWidth));

    svgScatter.selectAll(".y-axis")
        .data([null])
        .join("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${PLOT_CONFIG.margin.left},0)`) 
        .call(d3.axisLeft(scatterYScale).ticks(5).tickFormat(() => ""))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-width", PLOT_CONFIG.tickWidth)
            .attr("x2", -PLOT_CONFIG.tickSize))
        .call(g => g.selectAll("path.domain")
            .attr("stroke-width", PLOT_CONFIG.tickWidth));

    // Axis labels - Adjust positioning based on viewBox
    const urlParams = parseURLParams();
    const xAxisLabel = urlParams.xaxisLabel || "Predictor";
    const yAxisScatterLabel = urlParams.yaxisScatterLabel || "Outcome";

    svgScatter.selectAll(".x-label")
        .data([null])
        .join("foreignObject")
        .attr("class", "x-label")
        .attr("x", PLOT_CONFIG.margin.left + PLOT_AREA.width / 2 - 150) 
        .attr("y", PLOT_CONFIG.margin.top + PLOT_AREA.height + 35) 
        .attr("width", 300)
        .attr("height", 40)
        .append("xhtml:div")
        .attr("contenteditable", true)
        .style("text-align", "center")
        .style("font-size", `${PLOT_CONFIG.fontSize.axisLabel}px`)
        .style("color", "black")
        .text(xAxisLabel);

    svgScatter.selectAll(".y-label")
        .data([null])
        .join("foreignObject")
        .attr("class", "y-label")
        .attr("transform", `translate(${PLOT_CONFIG.margin.left - 90}, ${PLOT_CONFIG.margin.top + PLOT_AREA.height / 2 + 175}) rotate(-90)`)
        .attr("width", 350)
        .attr("height", 40)
        .append("xhtml:div")
        .attr("contenteditable", true)
        .style("text-align", "center")
        .style("font-size", `${PLOT_CONFIG.fontSize.axisLabel}px`)
        .style("color", "black")
        .text(yAxisScatterLabel);

    // Points - Use updated scales
    svgScatter.selectAll(".scatter-point")
        .data(plotData.map(d => ({
            ...d,
            color: d.y > sortedData[thresholdIndex]?.y ? "teal" : "gray",
        })), d => `${d.x}-${d.y}`)
        .join(
            enter => enter.append("circle")
                .attr("class", "scatter-point")
                .attr("r", 7) 
                .attr("fill", d => d.color)
                .attr("opacity", 0.5)
                .attr("cx", d => scatterXScale(d.x))
                .attr("cy", d => scatterYScale(d.y)),
            update => update
                .transition().duration(100) // Smooth transition
                .attr("cx", d => scatterXScale(d.x))
                .attr("cy", d => scatterYScale(d.y)),
            exit => exit.remove()
        );
}

function drawDistributions(tealX, grayX, type) {
    // First, clear any existing SVG to avoid duplicate plots
    d3.select(`#${type === "true" ? SELECTORS.distributionPlotTrue : SELECTORS.distributionPlotObserved}`).selectAll("svg").remove();
    
    // Use same x-axis range as scatter plot
    const xRange = [-4, 4];
    xScale.domain(xRange);
    
    const baseRate = parseFloat(document.getElementById("base-rate-slider-cont").value) / 100;
    const greenScale = baseRate;
    const blueScale = 1 - baseRate;

    // Create histograms instead of KDE
    const binCount = 70; // Number of bins for the histogram
    const histogramGenerator = d3.histogram()
        .domain(xRange)
        .thresholds(d3.range(xRange[0], xRange[1], (xRange[1] - xRange[0]) / binCount));
    
    // Generate histogram data
    const tealBins = histogramGenerator(tealX);
    const grayBins = histogramGenerator(grayX);
    
    // Convert bins to density format (normalize by total count and bin width)
    const tealTotal = tealX.length;
    const grayTotal = grayX.length;
    const binWidth = tealBins[0].x1 - tealBins[0].x0;
    
    // Convert to density format compatible with existing visualization
    const tealDensity = tealBins.map(bin => ({
        x: (bin.x0 + bin.x1) / 2, // Use bin midpoint for x
        y: (bin.length / tealTotal / binWidth) * greenScale // Normalize by count and bin width
    }));
    
    const grayDensity = grayBins.map(bin => ({
        x: (bin.x0 + bin.x1) / 2, // Use bin midpoint for x
        y: (bin.length / grayTotal / binWidth) * blueScale // Normalize by count and bin width
    }));

    // Compute all effect size metrics
    const esMetrics = computeEffectSizeMetrics(tealX, grayX);
    
    // Update UI displays
    document.getElementById(`${type}-rank-biserial-cont`).value = esMetrics.rankBiserial.toFixed(2);
    document.getElementById(`${type}-glass-d-cont`).value = esMetrics.glassD.toFixed(2);

    // Create metrics object for the existing updateMetricsFromD function
    const metrics = { 
        d: esMetrics.d, 
        da: esMetrics.da, 
        cohensU3: esMetrics.cohensU3,
        meanTeal: esMetrics.meanTeal, 
        meanGray: esMetrics.meanGray, 
        varianceTeal: esMetrics.varianceTeal, 
        varianceGray: esMetrics.varianceGray 
    };
    
    // Store metrics and update UI
    if (type === "true") {
        trueMetrics = metrics;
    } else if (type === "observed") {
        observedMetrics = metrics;
    }

    updateMetricsFromD(metrics, type);

    const maxYTeal = d3.max(tealDensity, d => d.y);
    const maxYGray = d3.max(grayDensity, d => d.y);
    const maxY = Math.max(maxYTeal, maxYGray, 0.1); // Ensure maxY is not 0
    
    // Update yScale domain based on actual data, range uses viewBox
    yScale.domain([0, maxY * 1.1]).range([PLOT_CONFIG.margin.top + PLOT_AREA.height, PLOT_CONFIG.margin.top]);
    
    // Update xScale range based on viewBox
    xScale.range([PLOT_CONFIG.margin.left, PLOT_CONFIG.margin.left + PLOT_AREA.width]);

    // Create the SVG container
    const svgDistributions = d3.select(`#${type === "true" ? SELECTORS.distributionPlotTrue : SELECTORS.distributionPlotObserved}`)
        // Remove previous SVG if exists
        .select("svg").remove(); 
    const newSvg = d3.select(`#${type === "true" ? SELECTORS.distributionPlotTrue : SELECTORS.distributionPlotObserved}`)
        .append("svg") // Append new SVG
        .attr("width", "100%")
        .attr("height", "100%")
        // Use standard viewBox
        .attr("viewBox", `0 0 ${PLOT_CONFIG.viewBoxWidth} ${PLOT_CONFIG.viewBoxHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("display", "block")
        .style("max-width", "100%");
    
    // Add x-axis - Use viewBox dimensions
    newSvg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${PLOT_CONFIG.margin.top + PLOT_AREA.height})`) 
        .call(d3.axisBottom(xScale).tickFormat(() => ""))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-width", PLOT_CONFIG.tickWidth)
            .attr("y2", PLOT_CONFIG.tickSize))
        .call(g => g.selectAll("path.domain")
            .attr("stroke-width", PLOT_CONFIG.tickWidth));

    // Add y-axis - Use viewBox dimensions
    newSvg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${PLOT_CONFIG.margin.left},0)`) 
        .call(d3.axisLeft(yScale).tickFormat(() => ""))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-width", PLOT_CONFIG.tickWidth)
            .attr("x2", -PLOT_CONFIG.tickSize))
        .call(g => g.selectAll("path.domain")
            .attr("stroke-width", PLOT_CONFIG.tickWidth));

    const binWidthPixels = (xScale(tealBins[0].x1) - xScale(tealBins[0].x0)); // Calculate bin width in pixels for rect width
    
    // Draw distributions as true histograms (bar charts)
    newSvg.selectAll(".gray-bar")
        .data(grayDensity)
        .join("rect")
        .attr("class", "distribution gray-distribution gray-bar")
        .attr("x", d => xScale(d.x - binWidth/2))
        .attr("y", d => yScale(d.y))
        .attr("width", binWidthPixels)
        .attr("height", d => Math.max(0, yScale(0) - yScale(d.y))) // Ensure height >= 0
        .attr("fill", "black")
        .attr("opacity", 0.3);
        
    newSvg.selectAll(".teal-bar")
        .data(tealDensity)
        .join("rect")
        .attr("class", "distribution teal-distribution teal-bar")
        .attr("x", d => xScale(d.x - binWidth/2))
        .attr("y", d => yScale(d.y))
        .attr("width", binWidthPixels)
        .attr("height", d => Math.max(0, yScale(0) - yScale(d.y))) // Ensure height >= 0
        .attr("fill", "teal")
        .attr("opacity", 0.4);

    // Axis labels - Adjust positioning based on viewBox
    const urlParamsDist = parseURLParams();
    const xAxisLabelDist = urlParamsDist.xaxisLabel || "Predictor";

    newSvg.selectAll(".x-label")
        .data([null])
        .join("foreignObject")
        .attr("class", "x-label")
        .attr("x", PLOT_CONFIG.margin.left + PLOT_AREA.width / 2 - 150) // Centered
        .attr("y", PLOT_CONFIG.margin.top + PLOT_AREA.height + 35) // Below axis
        .attr("width", 300)
        .attr("height", 40)
        .append("xhtml:div")
        .attr("contenteditable", true)
        .style("text-align", "center")
        .style("font-size", `${PLOT_CONFIG.fontSize.axisLabel}px`)
        .style("color", "black")
        .text(xAxisLabelDist);

    newSvg.selectAll(".y-label")
        .data([null])
        .join("foreignObject")
        .attr("class", "y-label")
        // Rotate around top-left corner of text area, adjust x/y
        .attr("transform", `translate(${PLOT_CONFIG.margin.left - 90}, ${PLOT_CONFIG.margin.top + PLOT_AREA.height / 2 + 125}) rotate(-90)`) // Adjusted Y for centering
        .attr("width", 300)
        .attr("height", 40)
        .append("xhtml:div")
        .attr("contenteditable", true)
        .style("text-align", "center")
        .style("font-size", `${PLOT_CONFIG.fontSize.axisLabel}px`)
        .style("color", "black")
        .text("Count");

    // Variance annotation - Adjust positioning based on viewBox to match original approx location
    const varianceRatio = (esMetrics.varianceGray / esMetrics.varianceTeal).toFixed(2);
    const varianceFontSize = PLOT_CONFIG.fontSize.annotationText * 1.2;
    
    newSvg.append("foreignObject")
        .attr("class", "variance-annotation") 
        // Restore original positioning logic relative to viewBox/margins
        .attr("x", PLOT_CONFIG.viewBoxWidth - PLOT_CONFIG.margin.right - 300) // Position near right edge
        .attr("y", PLOT_CONFIG.margin.top + 170) // Position relative to top margin
        .attr("width", 300)
        .attr("height", 120)
        .append("xhtml:div")
        .style("font-size", `${PLOT_CONFIG.fontSize.annotationText}px`)
        .style("font-weight", "bold")
        .style("text-align", "center")
        .html(`
            <div style="display: inline-flex; align-items: center; justify-content: center;">
                <div style="display: inline-block; text-align: center; position: relative;">
                    <div style="color: #777777; padding: 0 5px; font-size: ${varianceFontSize}px;">σ₁²</div>
                    <div style="height: 3px; background-color: #333333; margin: 8px auto; width: 50px;"></div>
                    <div style="color: teal; padding: 0 5px; font-size: ${varianceFontSize}px;">σ₂²</div>
                </div>
                <span style="color: #444444; margin-left: 20px;"> = ${varianceRatio}</span>
            </div>
        `);

    // Legend - Adjust positioning based on viewBox
    const urlParams = parseURLParams();
    const label1 = urlParams.label1 || "Group 1";
    const label2 = urlParams.label2 || "Group 2";
    const legendData = [label1, label2];
    const legend = newSvg.selectAll(".legend-group").data(legendData);

    legend.exit().remove();

    const legendEnter = legend.enter()
        .append("foreignObject")
        .attr("class", "legend-group")
        .attr("width", 400)
        .attr("height", 40);

    // Add editable group labels
    legendEnter.append("xhtml:div")
        .attr("contenteditable", true)
        .style("font-size", `${PLOT_CONFIG.fontSize.legendText}px`)
        .style("font-weight", "bold")
        .style("color", (d, i) => (i === 0 ? "#777777" : "teal"))
        .style("display", "inline")
        .text(d => d);

    legendEnter.merge(legend)
        .attr("x", PLOT_CONFIG.margin.left + 100) // Position relative to margin
        .attr("y", (d, i) => PLOT_CONFIG.margin.top + i * 34 + 30); // Position relative to margin

    // Remove any existing threshold before redrawing
    newSvg.selectAll(".threshold-group").remove();

    // Draw threshold after distributions
    drawThreshold(metrics, type);
}

function drawThreshold(metrics, type) {
    const svg = d3.select(`#${type === "true" ? SELECTORS.distributionPlotTrue : SELECTORS.distributionPlotObserved}`).select("svg");
    if (svg.empty()) return; // Don't draw if SVG doesn't exist

    // Remove existing threshold group before drawing a new one
    svg.selectAll(".threshold-group").remove();

    // Define variable for drag event
    let offsetX;

    const thresholdGroup = svg.append("g") // Append to the existing SVG
        .attr("class", "threshold-group")
        .style("cursor", "ew-resize")
        .call(d3.drag()
            .on("start", function (event) {
                offsetX = xScale(thresholdValue) - event.x;
            })
            .on("drag", function (event) {
                let newThreshold = xScale.invert(event.x + offsetX);
                newThreshold = Math.max(xScale.domain()[0], Math.min(xScale.domain()[1], newThreshold));
                thresholdValue = newThreshold;
                plotROC();
                drawThreshold(metrics, type); // Redraw the threshold itself
            })
        );

    // Calculate plot area bounds based on viewBox and margins
    const plotTop = PLOT_CONFIG.margin.top;
    const plotBottom = PLOT_CONFIG.margin.top + PLOT_AREA.height;
    const plotLeft = PLOT_CONFIG.margin.left;
    const plotRight = PLOT_CONFIG.margin.left + PLOT_AREA.width;

    // Add or update the threshold line
    thresholdGroup.selectAll(".threshold-line")
        .data([null])
        .join("line")
        .attr("class", "threshold-line")
        .attr("x1", xScale(thresholdValue))
        .attr("x2", xScale(thresholdValue))
        .attr("y1", plotTop) // Use calculated plot area top
        .attr("y2", plotBottom) // Use calculated plot area bottom
        .attr("stroke", "red")
        .attr("stroke-width", 7)
        .attr("opacity", 0.9);

    // Add or update the hitbox for interaction
    thresholdGroup.selectAll(".threshold-hitbox")
        .data([null])
        .join("rect")
        .attr("class", "threshold-hitbox")
        .attr("x", xScale(thresholdValue) - 15)
        .attr("width", 30)
        .attr("y", plotTop) // Use calculated plot area top
        .attr("height", PLOT_AREA.height) // Use calculated plot area height
        .attr("fill", "transparent");

    // Add or update the arrows
    const arrowSize = 15;
    const arrowY = plotTop + 15; // Position near top of plot area
    const arrowData = [
        { direction: "left", x: thresholdValue - 0.2, y: arrowY },
        { direction: "right", x: thresholdValue + 0.2, y: arrowY },
    ];

    thresholdGroup.selectAll(".threshold-arrow")
        .data(arrowData)
        .join("path")
        .attr("class", "threshold-arrow")
        .attr("d", d => {
            const x = xScale(d.x);
            const y = d.y;
            if (d.direction === "left") {
                return `M${x},${y} l${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
            } else {
                return `M${x},${y} l-${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
            }
        })
        .attr("fill", "red");

    // Ensure the threshold group is always on top
    thresholdGroup.raise();
}

function plotROC() {
    if (!currentLabeledData || currentLabeledData.length === 0) {
        console.warn("plotROC called with no currentLabeledData.");
        // Maybe draw empty plots?
        Plotly.purge(SELECTORS.rocPlot);
        Plotly.purge(SELECTORS.prPlot);
        // Clear dashboard too
        document.getElementById("auc-value-cont").textContent = 'N/A';
        // ... clear other dashboard values
        return;
    }
    // Generate ROC and PR curve points using currentLabeledData
    const uniqueXValues = Array.from(new Set(currentLabeledData.map(d => d.x))).sort((a, b) => a - b);
    const stepSize = Math.max(1, Math.floor(uniqueXValues.length / 500)); // Limit to ~500 points for performance
    const thresholds = uniqueXValues.filter((_, i) => i % stepSize === 0);

    const curvePoints = thresholds.map(t => computePredictiveMetrics(t, currentLabeledData));

    // Arrays for plotting
    const FPR = curvePoints.map(p => p.fpr);
    const TPR = curvePoints.map(p => p.sensitivity);
    const precision = curvePoints.map(p => p.ppv);
    const recall = TPR; // recall is the same as sensitivity/TPR

    // Calculate AUC properly using trapezoidal rule
    let auc = 0;
    for (let i = 1; i < FPR.length; i++) {
        auc += (FPR[i-1] - FPR[i]) * (TPR[i] + TPR[i-1]) / 2;  // Reversed the order of FPR difference
    }

    // Calculate PR-AUC using trapezoidal rule
    let prauc = 0;
    for (let i = 1; i < recall.length; i++) {
        prauc += (recall[i-1] - recall[i]) * (precision[i] + precision[i-1]) / 2;  // Also fix PR-AUC calculation
    }

    // Get metrics at current threshold using currentLabeledData
    const currentMetrics = computePredictiveMetrics(thresholdValue, currentLabeledData);
    
    // Update dashboard values
    document.getElementById("auc-value-cont").textContent = auc.toFixed(2);
    document.getElementById("accuracy-value-cont").textContent = currentMetrics.accuracy.toFixed(2);
    document.getElementById("sensitivity-value-cont").textContent = currentMetrics.sensitivity.toFixed(2);
    document.getElementById("specificity-value-cont").textContent = currentMetrics.specificity.toFixed(2);
    document.getElementById("balanced-accuracy-value-cont").textContent = currentMetrics.balancedAccuracy.toFixed(2);
    document.getElementById("f1-value-cont").textContent = currentMetrics.f1Score.toFixed(2);
    document.getElementById("mcc-value-cont").textContent = currentMetrics.mcc.toFixed(2);
    document.getElementById("npv-value-cont").textContent = currentMetrics.npv.toFixed(2);
    document.getElementById("ppv-value-cont").textContent = currentMetrics.ppv.toFixed(2);
    
    // ROC Plot
    const rocTrace = {
        x: FPR,
        y: TPR,
        type: "scatter",
        mode: "lines",
        name: "ROC Curve",
        fill: "tozeroy",
        fillcolor: "rgba(200, 200, 200, 0.4)",
        line: { color: "black" },
    };
    
    const thresholdMarker = {
        x: [1 - currentMetrics.specificity],
        y: [currentMetrics.sensitivity],
        type: "scatter",
        mode: "markers",
        marker: { color: "red", size: 10 },
    };
    
    const rocLayout = {
        xaxis: { title: "1 - Specificity (FPR)", range: [0, 1], showgrid: false, titlefont: { size: 15 }, dtick: 1 },
        yaxis: { title: "Sensitivity (TPR)", range: [0, 1], showgrid: false, titlefont: { size: 15 }, dtick: 1 },
        showlegend: false,
        margin: { t: 20, l: 50, r: 30, b: 40 },
        font: { size: 12 },
        autosize: true,
        annotations: [{
            x: 0.95,
            y: 0.05,
            xref: "paper",
            yref: "paper",
            text: `ROC-AUC: ${auc.toFixed(2)}`,
            showarrow: false,
            font: { size: 16, color: "black", weight: "bold" },
            align: "right",
        }]
    };
    
    // PR Plot - Use the sorted data to ensure correct curve
    const prTrace = {
        x: recall,
        y: precision,
        type: "scatter",
        mode: "lines",
        name: "PR Curve",
        fill: "tozeroy",
        fillcolor: "rgba(200, 200, 200, 0.4)",
        line: { color: "black" },
    };
    
    const prThresholdMarker = {
        x: [currentMetrics.sensitivity],
        y: [currentMetrics.ppv],
        type: "scatter",
        mode: "markers",
        marker: { color: "red", size: 10 },
    };
    
    const prLayout = {
        xaxis: { title: "Recall (TPR)", range: [0, 1], showgrid: false, titlefont: { size: 15 }, dtick: 1 },
        yaxis: { title: "Precision (PPV)", range: [0, 1], showgrid: false, titlefont: { size: 15 }, dtick: 1 },
        showlegend: false,
        margin: { t: 20, l: 50, r: 30, b: 40 },
        font: { size: 12 },
        autosize: true,
        annotations: [{
            x: 0.05,
            y: 0.05,
            xref: "paper",
            yref: "paper",
            text: `PR-AUC: ${prauc.toFixed(2)}`,
            showarrow: false,
            font: { size: 16, color: "black", weight: "bold" },
            align: "left",
        }]
    };
    
    const config = { 
        staticPlot: true,
        responsive: true,
        displayModeBar: false
    };

    if (!rocInitialized) {
        Plotly.newPlot(SELECTORS.rocPlot, [rocTrace, thresholdMarker], rocLayout, config);
        Plotly.newPlot(SELECTORS.prPlot, [prTrace, prThresholdMarker], prLayout, config);
        
        // Add click event listeners to navigate to get-started.html sections
        document.getElementById(SELECTORS.rocPlot).addEventListener('click', () => {
            window.open('get-started.html#threshold-metrics', '_blank');
        });
        document.getElementById(SELECTORS.prPlot).addEventListener('click', () => {
            window.open('get-started.html#threshold-metrics', '_blank');
        });
        
        rocInitialized = true;
    } else {
        Plotly.react(SELECTORS.rocPlot, [rocTrace, thresholdMarker], rocLayout, config);
        Plotly.react(SELECTORS.prPlot, [prTrace, prThresholdMarker], prLayout, config);
    }
    
    // Plot DCA (only if container exists and DCA module is available)
    if (document.getElementById(SELECTORS.dcaPlot) && typeof DCAModule !== 'undefined') {
        // Get base rate from current data
        const baseRate = currentLabeledData.filter(d => d.trueClass === 1).length / currentLabeledData.length;
        
        // Get metrics at current threshold position
        const currentMetrics = computePredictiveMetrics(thresholdValue, currentLabeledData);
        
        DCAModule.plot('continuous', {
            sensitivity: currentMetrics.sensitivity,
            specificity: currentMetrics.specificity,
            baseRate: baseRate
        });
    }
}



function updateMetricsFromD(metrics, type) {
    const { d, da, cohensU3 } = metrics;
    
    // Calculate metrics from actual data
    // For AUC, we'll use the actual data points in plotROC
    // Here we'll just update the other metrics
    const oddsRatio = Math.exp(da * Math.PI / Math.sqrt(3));
    const logOddsRatio = da * Math.PI / Math.sqrt(3);
    
    // Calculate point-biserial correlation
    const baseRate = parseFloat(document.getElementById("base-rate-slider-cont").value) / 100;
    const pbR = StatUtils.dToR(da,baseRate);
    
    document.getElementById(`${type}-cohens-d-cont`).value = d.toFixed(2);
    document.getElementById(`${type}-cohens-da-cont`).value = da.toFixed(2);
    document.getElementById(`${type}-cohens-u3-cont`).value = cohensU3.toFixed(2);
    document.getElementById(`${type}-odds-ratio-cont`).value = oddsRatio.toFixed(2);
    document.getElementById(`${type}-log-odds-ratio-cont`).value = logOddsRatio.toFixed(2);
    document.getElementById(`${type}-pb-r-cont`).value = pbR.toFixed(2);
}

// Function to toggle plot visibility without redrawing
function togglePlotVisibility() {
    const showTrue = currentView === "true";
    document.getElementById(SELECTORS.scatterPlotTrue).style.display = showTrue ? "block" : "none";
    document.getElementById(SELECTORS.distributionPlotTrue).style.display = showTrue ? "block" : "none";
    document.getElementById(SELECTORS.scatterPlotObserved).style.display = showTrue ? "none" : "block";
    document.getElementById(SELECTORS.distributionPlotObserved).style.display = showTrue ? "none" : "block";
}

// Function to update plots and metrics based on current state
function updatePlots() {
    // Get current values
    const trueR = parseFloat(document.getElementById("true-pearson-r-cont").value);
    const reliabilityX = parseFloat(document.getElementById("reliability-x-number-cont").value);
    const reliabilityY = parseFloat(document.getElementById("reliability-y-number-cont").value);

    // Calculate observed R
    const observedR = computeObservedR(trueR, reliabilityX, reliabilityY);

    // Update the readonly observed r and r-squared inputs
    document.getElementById("observed-pearson-r-cont").value = observedR.toFixed(2);
    document.getElementById("true-R-squared-cont").value = (trueR**2).toFixed(2);
    document.getElementById("observed-R-squared-cont").value = (observedR**2).toFixed(2);

    // Generate data for BOTH true and observed
    const trueDataGen = generateLabeledData(trueR);
    const observedDataGen = generateLabeledData(observedR);

    // Store globally
    trueLabeledData = trueDataGen.labeledData;
    observedLabeledData = observedDataGen.labeledData;

    // Draw both plots using the generated data
    drawScatterPlot(trueR, "true", trueDataGen);
    drawScatterPlot(observedR, "observed", observedDataGen);

    // Set the CURRENT data for ROC plot based on view
    currentLabeledData = (currentView === "true") ? trueLabeledData : observedLabeledData;

    // Update ROC/PR plots
    plotROC();

    // Ensure the correct scatter/distribution plots are visible
    togglePlotVisibility();
}

function initializePlots() {
    // Set the default active state
    const trueButton = document.getElementById("true-button-cont");
    const observedButton = document.getElementById("observed-button-cont");
    observedButton.classList.add("active");
    trueButton.classList.remove("active");
    
    // Set initial highlighting based on current view
    updateMetricsHighlighting(currentView);

    // Show/hide plots based on the default selection (e.g., observed by default)
    document.getElementById(SELECTORS.scatterPlotTrue).style.display = "none";
    document.getElementById(SELECTORS.scatterPlotObserved).style.display = "block";
    document.getElementById(SELECTORS.distributionPlotTrue).style.display = "none";
    document.getElementById(SELECTORS.distributionPlotObserved).style.display = "block";

    // Initial plot visibility
    togglePlotVisibility(); // Use the new function

    // Call updatePlots to render the initial plots and threshold
    updatePlots();
}

// Update highlighting of metric input columns
function updateMetricsHighlighting(view) {
    const metricsInputs = document.querySelectorAll('.metrics-input');
    
    metricsInputs.forEach(input => {
        // Remove existing highlighting classes
        input.classList.remove('selected-true', 'selected-observed');
        
        // Add highlighting based on current view and input ID
        if (view === "true" && input.id.includes("true-")) {
            input.classList.add('selected-true');
        } else if (view === "observed" && input.id.includes("observed-")) {
            input.classList.add('selected-observed');
        }
    });
}

// Event listener setup
function setupEventListeners() {
    // Effect slider and input
    const effectSlider = document.getElementById("effect-slider-cont");
    const effectInput = document.getElementById("true-pearson-r-cont");
    const rSquaredInput = document.getElementById("true-R-squared-cont"); 
    
    effectSlider.addEventListener("input", (e) => {
        const sliderValue = parseFloat(e.target.value);
        effectInput.value = sliderValue.toFixed(2);
        updatePlots();
    });
    
    effectInput.addEventListener("change", () => {
        effectSlider.value = effectInput.value;
        updatePlots();
    });
    
    // Added listener for R^2 input
    rSquaredInput.addEventListener("change", () => {
        const rSquared = parseFloat(rSquaredInput.value);
        if (!isNaN(rSquared) && rSquared >= 0 && rSquared <= 1) {
            const r = Math.sqrt(rSquared);
            effectInput.value = r.toFixed(2);
            effectSlider.value = r; // Update slider value too
            updatePlots();
        }
    });

    // Base rate slider and input
    const baseRateSlider = document.getElementById("base-rate-slider-cont");
    const baseRateInput = document.getElementById("base-rate-number-cont");
    
    baseRateSlider.addEventListener("input", () => {
        baseRateInput.value = parseFloat(baseRateSlider.value).toFixed(1);
        updatePlots();
    });

    baseRateInput.addEventListener("change", () => {
        baseRateSlider.value = baseRateInput.value;
        updatePlots();
    });

    // Reliability sliders and inputs
    const reliabilityXSlider = document.getElementById("reliability-x-slider-cont");
    const reliabilityXInput = document.getElementById("reliability-x-number-cont");
    const reliabilityYSlider = document.getElementById("reliability-y-slider-cont");
    const reliabilityYInput = document.getElementById("reliability-y-number-cont");

    reliabilityXSlider.addEventListener("input", (e) => {
        const value = parseFloat(e.target.value);
        reliabilityXInput.value = value.toFixed(2);
        updatePlots();
    });
    reliabilityXInput.addEventListener("change", () => {
        reliabilityXSlider.value = reliabilityXInput.value;
        updatePlots();
    });

    reliabilityYSlider.addEventListener("input", (e) => {
        const value = parseFloat(e.target.value);
        reliabilityYInput.value = value.toFixed(2);
        updatePlots();
    });
    reliabilityYInput.addEventListener("change", () => {
        reliabilityYSlider.value = reliabilityYInput.value;
        updatePlots();
    });

    // Precise Estimates Checkbox
    const preciseCheckbox = document.getElementById("precise-estimates-checkbox-cont");
    if (preciseCheckbox) { // Check if the element exists
        preciseCheckbox.addEventListener("change", updatePlots);
    }

    // Plot toggle buttons
    const trueButton = document.getElementById("true-button-cont");
    const observedButton = document.getElementById("observed-button-cont");

    trueButton.addEventListener("click", () => {
        if (currentView === "true") return; // Do nothing if already selected
        currentView = "true";
        trueButton.classList.add("active");
        observedButton.classList.remove("active");
        updateMetricsHighlighting("true");
        currentLabeledData = trueLabeledData; // Switch data source
        togglePlotVisibility(); // Handles scatter/distribution visibility
        plotROC(); // Update ROC/PR plot with current data & threshold
    });

    observedButton.addEventListener("click", () => {
        if (currentView === "observed") return; // Do nothing if already selected
        currentView = "observed";
        observedButton.classList.add("active");
        trueButton.classList.remove("active");
        updateMetricsHighlighting("observed");
        currentLabeledData = observedLabeledData; // Switch data source
        togglePlotVisibility(); // Handles scatter/distribution visibility
        plotROC(); // Update ROC/PR plot with current data & threshold
    });
}

// Main initialization function - Now much smaller and focused on orchestration
function initializeContinuous(initialThreshold) {
    console.log("Initializing continuous version");
    
    // Clean up any existing state
    cleanupContinuous();
    
    // Set initial threshold if provided (after cleanup which resets it to 0)
    if (initialThreshold !== undefined) {
        thresholdValue = initialThreshold;
        console.log(`Setting threshold to ${initialThreshold}`);
    }
    
    // Initialize DCA module if available
    if (typeof DCAModule !== 'undefined') {
        DCAModule.init('continuous', {
            plotSelector: SELECTORS.dcaPlot,
            thresholdRange: { min: 0.05, max: 0.30 },
            onThresholdChange: (min, max) => {
                console.log(`DCA continuous range: ${min.toFixed(3)} - ${max.toFixed(3)}`);
            }
        });
    }
    
    // Initialize scales at module level
    xScale = d3.scaleLinear()
        .domain([-4, 4])
        .range([PLOT_CONFIG.margin.left, PLOT_CONFIG.margin.left + PLOT_AREA.width]);
    
    yScale = d3.scaleLinear()
        .domain([0, 0.5])
        .range([PLOT_CONFIG.margin.top + PLOT_AREA.height, PLOT_CONFIG.margin.top]);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize plots
    initializePlots();
}

// Function to update threshold value and redraw
function updateThreshold(newThreshold) {
    thresholdValue = newThreshold;
    // Redraw plots to reflect the new threshold
    updatePlots();
}

// Export for main.js
window.initializeContinuous = initializeContinuous;
window.cleanupContinuous = cleanupContinuous;
window.updateThreshold = updateThreshold;
})();