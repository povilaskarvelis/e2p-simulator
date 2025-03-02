// Cleanup function for switching views
function cleanupContinuous() {
    // Reset state and clean up plots
    Plotly.purge('roc-plot-cont');
}

// Main initialization function
function initializeContinuous() {
    console.log("Initializing continuous version");
    
    // Local constants
    const width = 1200;
    const height = 600;
    const margin = { top: 30, right: 50, bottom: 70, left: 95 };
    
    // Global font and tick size settings
    const fontSize = {
        axisLabel: 30,     // Axis labels (x, y)
        legendText: 27,    // Legend text
        annotationText: 25, // Annotation text (variance, etc.)
        tickLabel: 14      // Axis tick labels
    };
    const tickSize = 11;    // Size of axis ticks
    const tickWidth = 1.5;   // Width of axis ticks
    
    // Scales
    const xScale = d3.scaleLinear().domain([-4, 5]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([0, 0.5]).range([height - margin.bottom, margin.top]);
    
    // State variables
    let thresholdValue = 0;
    let rocInitialized = false;
    let trueMetrics = {};
    let observedMetrics = {};
    let currentView = "observed";  // Add currentView state variable with default value
    
    // Clean up any existing state
    cleanupContinuous();
    
    // Utility functions (these don't depend on DOM or state)
    function kernelDensityEstimator(kernel, X) {
        return function (sample) {
            return X.map(x => [x, d3.mean(sample, v => kernel(x - v))]);
        };
    }
    
    function kernelEpanechnikov(bandwidth) {
        return function (u) {
            u = u / bandwidth;
            return Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / bandwidth : 0;
        };
    }
    
    function computeObservedR(trueR, reliabilityX, reliabilityY) {
        return trueR * Math.sqrt(reliabilityX * reliabilityY);
    }

    // Drawing functions (depend on DOM elements)
    function drawScatterPlot(r, type) {
        const numPoints = 50000; // Full dataset for metrics
        const numPlotPoints = 5000; // Reduced dataset for visualization
        const meanX = 0, meanY = 0, stdDevX = 1, stdDevY = 1;
        const baseRate = parseFloat(document.getElementById("base-rate-slider-cont").value) / 100;

        // Generate the full dataset
        const fullData = d3.range(numPoints).map(() => {
            const x = d3.randomNormal(meanX, stdDevX)();
            const y = r * (x - meanX) + Math.sqrt(1 - r ** 2) * d3.randomNormal(meanY, stdDevY)();
            return { x, y };
        });

        // Subsample for plotting
        const plotData = fullData.filter((_, i) => i % (numPoints / numPlotPoints) === 0);

        // Sort and divide for colors
        const sortedData = fullData.sort((a, b) => b.y - a.y);
        const thresholdIndex = Math.floor(numPoints * baseRate);
        const tealData = sortedData.slice(0, thresholdIndex);
        const grayData = sortedData.slice(thresholdIndex);

        // Use full dataset for metric calculations
        drawDistributions(tealData.map(d => d.x), grayData.map(d => d.x), type);

        const scatterXScale = d3.scaleLinear().domain([-4, 4]).range([margin.left, width - margin.right]);
        const scatterYScale = d3.scaleLinear().domain([-4, 4]).range([height - margin.bottom, margin.top]);

        const svgScatter = d3.select(`#scatter-plot-${type}-cont`)
            .selectAll("svg")
            .data([null])
            .join("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "none");

        // Axes with larger ticks
        svgScatter.selectAll(".x-axis")
            .data([null])
            .join("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height - margin.bottom})`)
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
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(scatterYScale).ticks(5).tickFormat(() => ""))
            .call(g => g.selectAll(".tick line")
                .attr("stroke-width", tickWidth)
                .attr("x2", -tickSize))
            .call(g => g.selectAll("path.domain")
                .attr("stroke-width", tickWidth));

        // Editable axis labels with larger font
        svgScatter.selectAll(".x-label")
            .data([null])
            .join("foreignObject")
            .attr("class", "x-label")
            .attr("x", width / 2 - 70)
            .attr("y", height - margin.bottom + 35)
            .attr("width", 140)
            .attr("height", 30)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", `${fontSize.axisLabel}px`)
            .style("color", "black")
            .text("Predictor");

        svgScatter.selectAll(".y-label")
            .data([null])
            .join("foreignObject")
            .attr("class", "y-label")
            .attr("x", -height / 2)
            .attr("y", margin.left - 90)
            .attr("transform", `rotate(-90)`)
            .attr("width", 140)
            .attr("height", 30)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", `${fontSize.axisLabel}px`)
            .style("color", "black")
            .text("Outcome");

        // Points - Update instead of Redraw
        svgScatter.selectAll(".scatter-point")
            .data(plotData.map(d => ({
                ...d,
                color: d.y > sortedData[thresholdIndex]?.y ? "teal" : "gray",
            })), d => d.x) // Use x-value as key to minimize DOM changes
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
        // Use same x-axis range as scatter plot
        const xRange = [-4, 4];
        xScale.domain(xRange);

        const baseRate = parseFloat(document.getElementById("base-rate-slider-cont").value) / 100;
        const greenScale = baseRate;
        const blueScale = 1 - baseRate;

        // Kernel density estimation
        const kde = kernelDensityEstimator(kernelEpanechnikov(0.4), d3.range(xRange[0], xRange[1], 0.01));
        const tealDensity = kde(tealX).map(d => ({ x: d[0], y: d[1] * greenScale }));
        const grayDensity = kde(grayX).map(d => ({ x: d[0], y: d[1] * blueScale }));

        // Compute metrics
        const meanTeal = d3.mean(tealX);
        const meanGray = d3.mean(grayX);
        const varianceTeal = d3.variance(tealX);
        const varianceGray = d3.variance(grayX);
        const nTeal = tealX.length;
        const nGray = grayX.length;

        // const pooledSD = Math.sqrt((varianceTeal + varianceGray) / 2);
        const pooledSD = Math.sqrt(((nGray - 1) * varianceGray + (nTeal - 1) * varianceTeal) / (nGray + nTeal - 2));

        const d = (meanTeal - meanGray) / pooledSD;

        // Compute rank-biserial correlation
        const allData = [...tealX, ...grayX].sort(d3.ascending);
        const tealRankSum = d3.sum(tealX.map(x => d3.bisect(allData, x)));
        const rankBiserial = 2 * (tealRankSum / nTeal - (nTeal + nGray + 1) / 2) / (nTeal + nGray);

        // Update rank-biserial display
        document.getElementById(`${type}-rank-biserial-cont`).value = rankBiserial.toFixed(2);

        // Adjust for unequal variances and sample sizes
        const nonpooledSD = Math.sqrt((varianceGray + varianceTeal) / 2);
        const da = (meanTeal - meanGray) / nonpooledSD
        const glassD = (meanTeal - meanGray) / Math.sqrt(varianceGray);

        // Update glass d
        document.getElementById(`${type}-glass-d-cont`).value = glassD.toFixed(2);

        // Create metrics object
        const metrics = { d, da, meanTeal, meanGray, varianceTeal, varianceGray };
        
        // Store metrics and update UI
        if (type === "true") {
            trueMetrics = metrics;
        } else if (type === "observed") {
            observedMetrics = metrics;
        }

        updateMetricsFromD(metrics, type);

        // Determine the maximum Y value for scaling
        const maxYTeal = d3.max(tealDensity, d => d.y);
        const maxYGray = d3.max(grayDensity, d => d.y);
        const maxY = Math.max(maxYTeal, maxYGray);
        yScale.domain([0, maxY * 1.1]);

        // Select or create the container for the given type
        const svgDistributions = d3.select(`#distribution-plot-${type}-cont`)
            .selectAll("svg")
            .data([null])
            .join("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "none");

        // Remove old distributions
        svgDistributions.selectAll(".distribution").remove();

        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y));

        // Draw gray (control group) distribution
        svgDistributions.append("path")
            .datum(grayDensity)
            .attr("class", "distribution gray-distribution")
            .attr("fill", "black")
            .attr("opacity", 0.3)
            .attr("d", line);

        // Draw teal (experimental group) distribution
        svgDistributions.append("path")
            .datum(tealDensity)
            .attr("class", "distribution teal-distribution")
            .attr("fill", "teal")
            .attr("opacity", 0.4)
            .attr("d", line);

        // Editable axis labels with larger font
        svgDistributions.selectAll(".x-label")
            .data([null])
            .join("foreignObject")
            .attr("class", "x-label")
            .attr("x", width / 2 - 70)
            .attr("y", height - margin.bottom + 35)
            .attr("width", 140)
            .attr("height", 30)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", `${fontSize.axisLabel}px`)
            .style("color", "black")
            .text("Predictor");

        svgDistributions.selectAll(".y-label")
            .data([null])
            .join("foreignObject")
            .attr("class", "y-label")
            .attr("x", -height / 1.5)
            .attr("y", margin.left - 90)
            .attr("transform", `rotate(-90)`)
            .attr("width", 300)
            .attr("height", 40)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", `${fontSize.axisLabel}px`)
            .style("color", "black")
            .text("Probability density");

        // Add variance text annotations with larger font
        svgDistributions.selectAll(".variance-annotation").remove(); // Remove existing annotations first
        
        // Calculate variance ratio (gray/teal to match the labeling)
        const varianceRatio = (varianceGray / varianceTeal).toFixed(2);
        
        // Define a larger font size for the variance fraction
        const varianceFontSize = fontSize.annotationText * 1.2;
        
        svgDistributions.append("foreignObject")
            .attr("class", "variance-annotation") 
            .attr("x", width - margin.right - 300)
            .attr("y", margin.top + 170)
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

        // Add editable legend with larger font
        const legendData = ["Group 1", "Group 2"];
        const legend = svgDistributions.selectAll(".legend-group").data(legendData);

        legend.exit().remove();

        const legendEnter = legend.enter()
            .append("foreignObject")
            .attr("class", "legend-group")
            .attr("width", 300)
            .attr("height", 30);

        // Add editable group labels
        legendEnter.append("xhtml:div")
            .attr("contenteditable", true)
            .style("font-size", `${fontSize.legendText}px`)
            .style("font-weight", "bold")
            .style("color", (d, i) => (i === 0 ? "#777777" : "teal"))
            .style("display", "inline")
            .text(d => d);

        legendEnter.merge(legend)
            .attr("x", margin.left + 100)
            .attr("y", (d, i) => margin.top + i * 35 + 30);

        // Remove any existing threshold before redrawing
        svgDistributions.selectAll(".threshold-group").remove();

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

                    // Update the marker position on the ROC curve
                    if (type === "true") {
                        plotROC(trueMetrics);
                    } else {
                        plotROC(observedMetrics);
                    }
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

    function plotROC(metrics) {
        // Unpack needed variables from metrics object
        const { d, meanTeal, meanGray, varianceTeal, varianceGray } = metrics;
        
        const baseRate = parseFloat(document.getElementById("base-rate-slider-cont").value) / 100;

        // Get reliability values for standard deviation calculation
        const reliabilityX = parseFloat(document.getElementById("reliability-x-slider-cont").value);
        const reliabilityY = parseFloat(document.getElementById("reliability-y-slider-cont").value);

        // Calculate standard deviations based on reliabilities
        const sigma1 = currentView === "true" ? 1 : 1 / Math.sqrt(reliabilityX); // Controls
        const sigma2 = currentView === "true" ? 1 : 1 / Math.sqrt(reliabilityY); // Patients


        // Calculate AUC using the actual means and standard deviations
        const auc = StatUtils.normalCDF( d/ Math.sqrt(2), 0, 1);
        
        const tMin = -5;
        const tMax = 5;
        const step = 0.01;

        const FPR = [];
        const TPR = [];
        const precision = [];
        const recall = [];

        // Add the zero point explicitly
        FPR.push(1);
        TPR.push(1);
        precision.push(baseRate);
        recall.push(1);

        for (let t = tMin; t <= tMax; t += step) {
            // Use appropriate means and standard deviations for each distribution
            const cdfA = StatUtils.normalCDF(t, meanGray, sigma1);  // Controls
            const cdfB = StatUtils.normalCDF(t, meanTeal, sigma2);  // Patients

            FPR.push(1 - cdfA);
            TPR.push(1 - cdfB);
            
            // Calculate precision for each point
            const sens = 1 - cdfB;  // Sensitivity (TPR)
            const spec = cdfA;      // Specificity (1 - FPR)
            const prec = (sens * baseRate) / (sens * baseRate + (1 - spec) * (1 - baseRate));
            precision.push(prec);
            recall.push(sens);      // Recall is the same as sensitivity
        }

        // Add the end point explicitly
        FPR.push(0);
        TPR.push(0);
        precision.push(1);
        recall.push(0);

        // Use appropriate means and standard deviations for threshold calculations
        const thresholdFPR = 1 - StatUtils.normalCDF(thresholdValue, meanGray, sigma1);
        const thresholdTPR = 1 - StatUtils.normalCDF(thresholdValue, meanTeal, sigma2);

        // Calculate specificity, sensitivity, and PPV for threshold point only
        const specificity = 1 - thresholdFPR;
        const sensitivity = thresholdTPR;
        const ppv = (sensitivity * baseRate) / (sensitivity * baseRate + (1 - specificity) * (1 - baseRate));
        const balancedAccuracy = (sensitivity + specificity) / 2;

        // Calculate PR AUC (Average Precision)
        let prauc = 0;
        for (let i = 1; i < recall.length; i++) {
            prauc += (recall[i-1] - recall[i]) * precision[i-1];
        }

        // Update dashboard values
        document.getElementById("auc-value-cont").textContent = (auc * 100).toFixed(1) + "%";
        document.getElementById("sensitivity-value-cont").textContent = (sensitivity * 100).toFixed(1) + "%";
        document.getElementById("specificity-value-cont").textContent = (specificity * 100).toFixed(1) + "%";
        document.getElementById("accuracy-value-cont").textContent = (balancedAccuracy * 100).toFixed(1) + "%";
        document.getElementById("ppv-value-cont").textContent = (ppv * 100).toFixed(1) + "%";

        // ROC Plot configuration...
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
            x: [thresholdFPR],
            y: [thresholdTPR],
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
                text: `AUC: ${(auc * 100).toFixed(1)}%`,
                showarrow: false,
                font: { size: 16, color: "black", weight: "bold" },
                align: "right",
            }]
        };

        // Precision-Recall Plot
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
            x: [sensitivity],  // recall = sensitivity
            y: [ppv],         // precision = positive predictive value
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
                text: `PR-AUC: ${(prauc * 100).toFixed(1)}%`,
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
        const oddsRatio = StatUtils.dToOddsRatio(da);
        const logOddsRatio = StatUtils.dToLogOddsRatio(da);
        const auc = StatUtils.normalCDF(da / Math.sqrt(2), 0, 1);
        
        document.getElementById(`${type}-cohens-d-cont`).value = d.toFixed(2);
        document.getElementById(`${type}-cohens-da-cont`).value = da.toFixed(2);
        document.getElementById(`${type}-odds-ratio-cont`).value = oddsRatio.toFixed(2);
        document.getElementById(`${type}-log-odds-ratio-cont`).value = logOddsRatio.toFixed(2);
        document.getElementById(`${type}-auc-cont`).value = auc.toFixed(2);
    }

    // Update function (coordinates all updates)
    function updatePlots() {
        const trueR = parseFloat(document.getElementById("effect-slider-cont").value); // True Pearson's r
        const reliabilityX = parseFloat(document.getElementById("reliability-x-slider-cont").value); // Reliability value
        const reliabilityY = parseFloat(document.getElementById("reliability-y-slider-cont").value); // Reliability value
        const observedR = computeObservedR(trueR, reliabilityX, reliabilityY); // Attenuated r

        // Update observed r
        document.getElementById("observed-pearson-r-cont").value = observedR.toFixed(2);

        // Update R²
        document.getElementById("true-R-squared-cont").value = (trueR ** 2).toFixed(2);
        document.getElementById("observed-R-squared-cont").value = (observedR ** 2).toFixed(2);

        // Update c-index
        const trueCIndex = 0.5 + (Math.asin(trueR) / Math.PI);
        const observedCIndex = 0.5 + (Math.asin(observedR) / Math.PI);
        document.getElementById("true-c-index-cont").value = trueCIndex.toFixed(2);
        document.getElementById("observed-c-index-cont").value = observedCIndex.toFixed(2);

        // Update input fields
        document.getElementById("true-pearson-r-cont").value = trueR.toFixed(2);
        document.getElementById("reliability-x-number-cont").value = reliabilityX.toFixed(2);
        document.getElementById("reliability-y-number-cont").value = reliabilityY.toFixed(2);

        // Update scatter plots and distributions
        drawScatterPlot(trueR, "true");
        drawScatterPlot(observedR, "observed");

        // Determine the currently selected plot type based on active button
        const isTrueSelected = document.getElementById("true-button-cont").classList.contains("active");

        // Update metrics and threshold based on the selected plot type
        if (isTrueSelected) {
            drawThreshold(trueMetrics, "true"); // Update threshold for true effect size
            plotROC(trueMetrics); // Pass the entire metrics object
        } else {
            drawThreshold(observedMetrics, "observed"); // Update threshold for observed effect size
            plotROC(observedMetrics); // Pass the entire metrics object
        }
    }

    // Initialization functions
    function initializeDistributions() {
        // Initialize both "true" and "observed" distribution SVG containers
        ["true", "observed"].forEach(type => {
            const svgDistributions = d3.select(`#distribution-plot-${type}-cont`)
                .append("svg")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", `0 0 ${width} ${height}`)
                .attr("preserveAspectRatio", "none");

            // Add x-axis with larger ticks
            svgDistributions.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0,${height - margin.bottom})`)
                .call(d3.axisBottom(xScale).tickFormat(() => ""))
                .call(g => g.selectAll(".tick line")
                    .attr("stroke-width", tickWidth)
                    .attr("y2", tickSize))
                .call(g => g.selectAll("path.domain")
                    .attr("stroke-width", tickWidth));

            // Add y-axis with larger ticks
            svgDistributions.append("g")
                .attr("class", "y-axis")
                .attr("transform", `translate(${margin.left},0)`)
                .call(d3.axisLeft(yScale).tickFormat(() => ""))
                .call(g => g.selectAll(".tick line")
                    .attr("stroke-width", tickWidth)
                    .attr("x2", -tickSize))
                .call(g => g.selectAll("path.domain")
                    .attr("stroke-width", tickWidth));
        });
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

        // Call updatePlots to render the initial plots and threshold
        updatePlots();
    }

    // Event listener setup
    function setupEventListeners() {
        // Effect slider and input
        const effectSlider = document.getElementById("effect-slider-cont");
        const effectInput = document.getElementById("true-pearson-r-cont");
        
        effectSlider.addEventListener("input", updatePlots);
        effectInput.addEventListener("input", () => {
            effectSlider.value = effectInput.value;
            updatePlots();
        });

        // Base rate slider and input
        const baseRateSlider = document.getElementById("base-rate-slider-cont");
        const baseRateInput = document.getElementById("base-rate-number-cont");
        
        baseRateSlider.addEventListener("input", () => {
            baseRateInput.value = parseFloat(baseRateSlider.value).toFixed(1);
            updatePlots();
        });

        baseRateInput.addEventListener("input", () => {
            baseRateSlider.value = baseRateInput.value;
            updatePlots();
        });

        // Reliability sliders and inputs
        const reliabilityXSlider = document.getElementById("reliability-x-slider-cont");
        const reliabilityXInput = document.getElementById("reliability-x-number-cont");
        const reliabilityYSlider = document.getElementById("reliability-y-slider-cont");
        const reliabilityYInput = document.getElementById("reliability-y-number-cont");

        reliabilityXSlider.addEventListener("input", updatePlots);
        reliabilityXInput.addEventListener("input", () => {
            reliabilityXSlider.value = reliabilityXInput.value;
            updatePlots();
        });

        reliabilityYSlider.addEventListener("input", updatePlots);
        reliabilityYInput.addEventListener("input", () => {
            reliabilityYSlider.value = reliabilityYInput.value;
            updatePlots();
        });

        // Plot toggle buttons
        const trueButton = document.getElementById("true-button-cont");
        const observedButton = document.getElementById("observed-button-cont");

        trueButton.addEventListener("click", () => {
            currentView = "true";  // Set currentView to "true"
            trueButton.classList.add("active");
            observedButton.classList.remove("active");
            document.getElementById("scatter-plot-true-cont").style.display = "block";
            document.getElementById("scatter-plot-observed-cont").style.display = "none";
            document.getElementById("distribution-plot-true-cont").style.display = "block";
            document.getElementById("distribution-plot-observed-cont").style.display = "none";
            updatePlots();
        });

        observedButton.addEventListener("click", () => {
            currentView = "observed";  // Set currentView to "observed"
            observedButton.classList.add("active");
            trueButton.classList.remove("active");
            document.getElementById("scatter-plot-true-cont").style.display = "none";
            document.getElementById("scatter-plot-observed-cont").style.display = "block";
            document.getElementById("distribution-plot-true-cont").style.display = "none";
            document.getElementById("distribution-plot-observed-cont").style.display = "block";
            updatePlots();
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