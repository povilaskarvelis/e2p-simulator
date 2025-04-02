// Cleanup function for switching views
function cleanupContinuous() {
    // Reset state and clean up plots
    Plotly.purge('roc-plot-cont');
}

// Main initialization function
function initializeContinuous() {
    console.log("Initializing continuous version");
    
    // Local constants
    // Define relative margins for viewBox calculation
    const margin = { top: 30, right: 50, bottom: 70, left: 95 }; // Keep this for scale ranges
    const viewBoxWidth = 1200; // Standard viewBox width
    const viewBoxHeight = 600; // Standard viewBox height (maintains 2:1 aspect ratio)
    // let width, height; // Remove fixed width/height calculation
    
    // Global font and tick size settings
    const fontSize = {
        axisLabel: 34,     // Axis labels (x, y)
        legendText: 30,    // Legend text
        annotationText: 25, // Annotation text (variance, etc.)
        tickLabel: 14      // Axis tick labels
    };
    const tickSize = 11;    // Size of axis ticks
    const tickWidth = 1.5;   // Width of axis ticks
    
    // State variables
    let thresholdValue = 0;
    let rocInitialized = false;
    let trueMetrics = {};
    let observedMetrics = {};
    let currentView = "observed";  // Add currentView state variable with default value
    let trueLabeledData = [];
    let observedLabeledData = [];
    
    // Global variables for data sharing
    
    // Clean up any existing state
    cleanupContinuous();
    

    
    // Scales - Use viewBox dimensions for range calculation
    const plotAreaWidth = viewBoxWidth - margin.left - margin.right;
    const plotAreaHeight = viewBoxHeight - margin.bottom - margin.top;
    const xScale = d3.scaleLinear().domain([-4, 4]).range([margin.left, margin.left + plotAreaWidth]); // Adjusted range
    const yScale = d3.scaleLinear().domain([0, 0.5]).range([margin.top + plotAreaHeight, margin.top]); // Adjusted range
    
    // Utility functions (these don't depend on DOM or state)
    function computeObservedR(trueR, reliabilityX, reliabilityY) {
        return trueR * Math.sqrt(reliabilityX * reliabilityY);
    }

    // Helper function to generate data points and labeled data
    function generateLabeledData(r) {
        // Check the state of the precise estimates checkbox
        const preciseCheckbox = document.getElementById("precise-estimates-checkbox-cont");
        // Corrected numPoints logic from previous user interaction if needed
        const numPoints = preciseCheckbox && preciseCheckbox.checked ? 200000 : 50000; 
        const numPlotPoints = 5000; // Keep plot points lower for performance
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

    // Drawing functions (depend on DOM elements)
    function drawScatterPlot(r, type, plotDataGen) {
        // Use pre-generated data
        const { tealData, grayData, sortedData, thresholdIndex, numPlotPoints, numPoints, fullData } = plotDataGen;

        // Subsample for plotting (using full generated data)
        // Ensure fullData is used for subsampling if plotData isn't directly passed or suitable
         const plotData = fullData.filter((_, i) => i % Math.max(1, Math.floor(numPoints / numPlotPoints)) === 0);

        // Use full dataset for metric calculations (passed directly)
        drawDistributions(tealData.map(d => d.x), grayData.map(d => d.x), type);

        const scatterXScale = d3.scaleLinear().domain([-4, 4]).range([margin.left, margin.left + plotAreaWidth]); // Use adjusted range
        const scatterYScale = d3.scaleLinear().domain([-4, 4]).range([margin.top + plotAreaHeight, margin.top]); // Use adjusted range

        const svgScatter = d3.select(`#scatter-plot-${type}-cont`)
            .selectAll("svg")
            .data([null])
            .join("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            // Use standard viewBox, remove width/height attributes if they existed
            .attr("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("display", "block")
            .style("max-width", "100%");

        // Axes - Use viewBox dimensions for positioning
        svgScatter.selectAll(".x-axis")
            .data([null])
            .join("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${margin.top + plotAreaHeight})`) // Use viewBox-relative position
            .call(d3.axisBottom(scatterXScale).ticks(5).tickFormat(() => ""))
            .call(g => g.selectAll(".tick line")
                .attr("stroke-width", tickWidth)
                .attr("y2", tickSize))
            .call(g => g.selectAll("path.domain")
                .attr("stroke-width", tickWidth));

        svgScatter.selectAll(".y-axis")
            .data([null])
            .join("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left},0)`) // Use viewBox-relative position
            .call(d3.axisLeft(scatterYScale).ticks(5).tickFormat(() => ""))
            .call(g => g.selectAll(".tick line")
                .attr("stroke-width", tickWidth)
                .attr("x2", -tickSize))
            .call(g => g.selectAll("path.domain")
                .attr("stroke-width", tickWidth));

        // Axis labels - Adjust positioning based on viewBox
        const urlParams = parseURLParams();
        const xAxisLabel = urlParams.xaxisLabel || "Predictor";
        const yAxisScatterLabel = urlParams.yaxisScatterLabel || "Outcome";

        svgScatter.selectAll(".x-label")
            .data([null])
            .join("foreignObject")
            .attr("class", "x-label")
            .attr("x", margin.left + plotAreaWidth / 2 - 150) // Centered in plot area
            .attr("y", margin.top + plotAreaHeight + 35) // Below x-axis
            .attr("width", 300)
            .attr("height", 40)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", `${fontSize.axisLabel}px`)
            .style("color", "black")
            .text(xAxisLabel);

        svgScatter.selectAll(".y-label")
            .data([null])
            .join("foreignObject")
            .attr("class", "y-label")
             // Rotate around top-left corner of text area, adjust x/y
            .attr("transform", `translate(${margin.left - 90}, ${margin.top + plotAreaHeight / 2 + 175}) rotate(-90)`)
            .attr("width", 350)
            .attr("height", 40)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", `${fontSize.axisLabel}px`)
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

        return {
            d,
            rankBiserial,
            da, 
            glassD,
            meanTeal,
            meanGray,
            varianceTeal,
            varianceGray
        };
    }

    function drawDistributions(tealX, grayX, type) {
        // First, clear any existing SVG to avoid duplicate plots
        d3.select(`#distribution-plot-${type}-cont`).selectAll("svg").remove();
        
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
        yScale.domain([0, maxY * 1.1]).range([margin.top + plotAreaHeight, margin.top]);
        // Update xScale range based on viewBox
        xScale.range([margin.left, margin.left + plotAreaWidth]);

        // Create the SVG container
        const svgDistributions = d3.select(`#distribution-plot-${type}-cont`)
            // Remove previous SVG if exists
            .select("svg").remove(); 
        const newSvg = d3.select(`#distribution-plot-${type}-cont`)
            .append("svg") // Append new SVG
            .attr("width", "100%")
            .attr("height", "100%")
             // Use standard viewBox
            .attr("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("display", "block")
            .style("max-width", "100%");
        
        // Add x-axis - Use viewBox dimensions
        newSvg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${margin.top + plotAreaHeight})`) // Use viewBox-relative position
            .call(d3.axisBottom(xScale).tickFormat(() => ""))
            .call(g => g.selectAll(".tick line")
                .attr("stroke-width", tickWidth)
                .attr("y2", tickSize))
            .call(g => g.selectAll("path.domain")
                .attr("stroke-width", tickWidth));

        // Add y-axis - Use viewBox dimensions
        newSvg.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left},0)`) // Use viewBox-relative position
            .call(d3.axisLeft(yScale).tickFormat(() => ""))
            .call(g => g.selectAll(".tick line")
                .attr("stroke-width", tickWidth)
                .attr("x2", -tickSize))
            .call(g => g.selectAll("path.domain")
                .attr("stroke-width", tickWidth));

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
            .attr("x", margin.left + plotAreaWidth / 2 - 150) // Centered
            .attr("y", margin.top + plotAreaHeight + 35) // Below axis
            .attr("width", 300)
            .attr("height", 40)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", `${fontSize.axisLabel}px`)
            .style("color", "black")
            .text(xAxisLabelDist);

        newSvg.selectAll(".y-label")
            .data([null])
            .join("foreignObject")
            .attr("class", "y-label")
             // Rotate around top-left corner of text area, adjust x/y
            .attr("transform", `translate(${margin.left - 90}, ${margin.top + plotAreaHeight / 2 + 125}) rotate(-90)`) // Adjusted Y for centering
            .attr("width", 300)
            .attr("height", 40)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", `${fontSize.axisLabel}px`)
            .style("color", "black")
            .text("Count");

        // Variance annotation - Adjust positioning based on viewBox to match original approx location
        const varianceRatio = (esMetrics.varianceGray / esMetrics.varianceTeal).toFixed(2);
        const varianceFontSize = fontSize.annotationText * 1.2;
        
        newSvg.append("foreignObject")
            .attr("class", "variance-annotation") 
            // Restore original positioning logic relative to viewBox/margins
            .attr("x", viewBoxWidth - margin.right - 300) // Position near right edge
            .attr("y", margin.top + 170) // Position relative to top margin
            .attr("width", 300)
            .attr("height", 120)
            .append("xhtml:div")
            .style("font-size", `${fontSize.annotationText}px`)
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
            .style("font-size", `${fontSize.legendText}px`)
            .style("font-weight", "bold")
            .style("color", (d, i) => (i === 0 ? "#777777" : "teal"))
            .style("display", "inline")
            .text(d => d);

        legendEnter.merge(legend)
            .attr("x", margin.left + 100) // Position relative to margin
            .attr("y", (d, i) => margin.top + i * 34 + 30); // Position relative to margin

        // Remove any existing threshold before redrawing
        newSvg.selectAll(".threshold-group").remove();

        // Draw threshold after distributions
        drawThreshold(metrics, type);
    }

    function drawThreshold(metrics, type) {
        // Remove any existing threshold before creating new one
        d3.select(`#distribution-plot-${type}-cont`).select("svg")
            .selectAll(".threshold-group").remove();

        // Create new threshold group
        const thresholdGroup = d3.select(`#distribution-plot-${type}-cont`).select("svg")
            .append("g")
            .attr("class", "threshold-group")
            .style("cursor", "pointer")
            .call(d3.drag()
                .on("start", function (event) {
                    // Capture the initial threshold position during drag
                    offsetX = xScale(thresholdValue) - event.x;
                })
                .on("drag", function (event) {
                    // Update threshold value based on drag
                    let newThreshold = xScale.invert(event.x + offsetX);
                    // Constrain to the x-axis domain
                    newThreshold = Math.max(xScale.domain()[0], Math.min(xScale.domain()[1], newThreshold));
                    thresholdValue = newThreshold;

                    plotROC();

                    // Redraw the threshold group and update visuals
                    drawThreshold(metrics, type);
                })
            );

        // Merge enter/update for the group
        const groupMerge = thresholdGroup.merge(thresholdGroup);

        // Add or update the threshold line
        const line = groupMerge.selectAll(".threshold-line")
            .data([null]);

        line.enter()
            .append("line")
            .attr("class", "threshold-line")
            .merge(line)
            .attr("x1", xScale(thresholdValue))
            .attr("x2", xScale(thresholdValue))
            .attr("y1", yScale.range()[0])
            .attr("y2", yScale.range()[1])
            .attr("stroke", "red")
            .attr("stroke-width", 7)
            .attr("opacity", 0.9);

        // Add or update the hitbox for interaction
        const hitbox = groupMerge.selectAll(".threshold-hitbox")
            .data([null]);

        hitbox.enter()
            .append("rect")
            .attr("class", "threshold-hitbox")
            .merge(hitbox)
            .attr("x", xScale(thresholdValue) - 15)
            .attr("width", 30)
            .attr("y", yScale.range()[1])
            .attr("height", yScale.range()[0] - yScale.range()[1])
            .attr("fill", "transparent");

        // Add or update the arrows
        const arrowSize = 15;
        const arrowY = yScale.range()[1] + 15;
        const arrowData = [
            { direction: "left", x: thresholdValue - 0.2, y: arrowY },
            { direction: "right", x: thresholdValue + 0.2, y: arrowY },
        ];

        const arrows = groupMerge.selectAll(".threshold-arrow")
            .data(arrowData);

        arrows.enter()
            .append("path")
            .attr("class", "threshold-arrow")
            .merge(arrows)
            .attr("d", d => {
                const x = xScale(d.x);
                const y = d.y;
                if (d.direction === "left") {
                    // Outward-pointing left triangle
                    return `M${x},${y} l${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                } else {
                    // Outward-pointing right triangle
                    return `M${x},${y} l-${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                }
            })
            .attr("fill", "red");

        arrows.exit().remove();

        // Ensure the threshold group is always on top
        groupMerge.raise();
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

    function plotROC() {
        if (!currentLabeledData || currentLabeledData.length === 0) {
            console.warn("plotROC called with no currentLabeledData.");
            // Maybe draw empty plots?
            Plotly.purge("roc-plot-cont");
            Plotly.purge("pr-plot-cont");
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
                text: `AUC: ${auc.toFixed(2)}`,
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
            Plotly.newPlot("roc-plot-cont", [rocTrace, thresholdMarker], rocLayout, config);
            Plotly.newPlot("pr-plot-cont", [prTrace, prThresholdMarker], prLayout, config);
            rocInitialized = true;

            // Add resize event listeners
            window.addEventListener('resize', () => {
                Plotly.Plots.resize('roc-plot-cont');
                Plotly.Plots.resize('pr-plot-cont');
            });
        } else {
            Plotly.react("roc-plot-cont", [rocTrace, thresholdMarker], rocLayout, config);
            Plotly.react("pr-plot-cont", [prTrace, prThresholdMarker], prLayout, config);
        }
    }

    function updateMetricsFromD(metrics, type) {
        const { d, da } = metrics;
        
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
        document.getElementById(`${type}-odds-ratio-cont`).value = oddsRatio.toFixed(2);
        document.getElementById(`${type}-log-odds-ratio-cont`).value = logOddsRatio.toFixed(2);
        document.getElementById(`${type}-pb-r-cont`).value = pbR.toFixed(2);
    }

    // NEW function to toggle plot visibility without redrawing
    function togglePlotVisibility() {
        const showTrue = currentView === "true";
        document.getElementById("scatter-plot-true-cont").style.display = showTrue ? "block" : "none";
        document.getElementById("distribution-plot-true-cont").style.display = showTrue ? "block" : "none";
        document.getElementById("scatter-plot-observed-cont").style.display = showTrue ? "none" : "block";
        document.getElementById("distribution-plot-observed-cont").style.display = showTrue ? "none" : "block";
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
        // Make sure plotDataGen is passed correctly
        drawScatterPlot(trueR, "true", trueDataGen);
        drawScatterPlot(observedR, "observed", observedDataGen);
        // drawDistributions is called within drawScatterPlot

        // Set the CURRENT data for ROC plot based on view
        currentLabeledData = (currentView === "true") ? trueLabeledData : observedLabeledData;

        // Update ROC/PR plots
        plotROC();

        // Ensure the correct scatter/distribution plots are visible
        togglePlotVisibility();
    }

    // Initialization functions
    function initializeDistributions() {
        // Remove the initial SVG creation from here, it's done in drawDistributions now
        /*
        ["true", "observed"].forEach(type => {
            // ... remove SVG setup code ...
        });
        */
    }

    function initializePlots() {
        // Set the default active state
        const trueButton = document.getElementById("true-button-cont");
        const observedButton = document.getElementById("observed-button-cont");
        observedButton.classList.add("active");
        trueButton.classList.remove("active");

        // Show/hide plots based on the default selection (e.g., observed by default)
        document.getElementById("scatter-plot-true-cont").style.display = "none";
        document.getElementById("scatter-plot-observed-cont").style.display = "block";
        document.getElementById("distribution-plot-true-cont").style.display = "none";
        document.getElementById("distribution-plot-observed-cont").style.display = "block";

        // Initial plot visibility
        togglePlotVisibility(); // Use the new function

        // Call updatePlots to render the initial plots and threshold
        updatePlots();
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

        reliabilityXSlider.addEventListener("input", updatePlots);
        reliabilityXInput.addEventListener("change", () => {
            reliabilityXSlider.value = reliabilityXInput.value;
            updatePlots();
        });

        reliabilityYSlider.addEventListener("input", updatePlots);
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
            currentLabeledData = trueLabeledData; // Switch data source
            togglePlotVisibility(); // Handles scatter/distribution visibility
            plotROC(); // Update ROC/PR plot with current data & threshold
        });

        observedButton.addEventListener("click", () => {
            if (currentView === "observed") return; // Do nothing if already selected
            currentView = "observed";
            observedButton.classList.add("active");
            trueButton.classList.remove("active");
            currentLabeledData = observedLabeledData; // Switch data source
            togglePlotVisibility(); // Handles scatter/distribution visibility
            plotROC(); // Update ROC/PR plot with current data & threshold
        });
    }

    // Call setupEventListeners and initializeDistributions
    setupEventListeners();
    initializeDistributions();
    initializePlots();
}

// Export for main.js
window.initializeContinuous = initializeContinuous;
window.cleanupContinuous = cleanupContinuous;