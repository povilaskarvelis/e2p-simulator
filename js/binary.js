(function() {
// Constants and configuration
const PLOT_CONFIG = {
    margin: { top: 20, right: 30, bottom: 40, left: 50 },
    fontSize: {
        axisLabel: 18,
        legendText: 16,
        annotationText: 16,
        tickLabel: 14
    },
    tickSize: 8,
    tickWidth: 1.5
};

// Element selectors
const SELECTORS = {
    overlapPlot: 'overlap-plot',
    rocPlot: 'roc-plot',
    prPlot: 'pr-plot',
    dcaPlot: 'dca-plot'
};

// State variables
let thresholdValue = 0;
let rocInitialized = false;
let currentView = "observed";
let xScale, yScale;
let plotGroup;
let width, height;

// Utility functions
function parseURLParams() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const params = {};
    
    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }
    
    return params;
}

// Function to compute metrics at a given threshold
function computeMetricsForBinaryDistributions(d, baseRate, sigma1, sigma2, threshold) {
    // Calculate FPR (1 - specificity) and TPR (sensitivity)
    const thresholdFPR = 1 - StatUtils.normalCDF(threshold, 0, sigma1);
    const thresholdTPR = 1 - StatUtils.normalCDF(threshold, d, sigma2);
    
    // Calculate metrics
    const specificity = 1 - thresholdFPR;
    const sensitivity = thresholdTPR;
    
    // When sensitivity is 0, precision is 1 by convention
    const ppv = sensitivity === 0 ? 1 : (sensitivity * baseRate) / 
        (sensitivity * baseRate + (1 - specificity) * (1 - baseRate));
    
    const balancedAccuracy = (sensitivity + specificity) / 2;
    const npv = (specificity * (1 - baseRate)) / 
        (specificity * (1 - baseRate) + (1 - sensitivity) * baseRate);
    
    // Calculate regular accuracy
    const accuracy = sensitivity * baseRate + specificity * (1 - baseRate);
    
    // Calculate F1-score (harmonic mean of precision and recall)
    const f1Score = (ppv + sensitivity > 0) ? 
        2 * (ppv * sensitivity) / (ppv + sensitivity) : 0;

    // Calculate Matthews Correlation Coefficient (MCC)
    const TP = sensitivity * baseRate;
    const TN = specificity * (1 - baseRate);
    const FP = (1 - specificity) * (1 - baseRate);
    const FN = (1 - sensitivity) * baseRate;
    
    const mcc = (TP * TN - FP * FN) / 
        Math.sqrt((TP + FP) * (TP + FN) * (TN + FP) * (TN + FN) || 1); // Avoid division by zero
    
    return {
        fpr: thresholdFPR,
        tpr: thresholdTPR,
        specificity,
        sensitivity,
        ppv,
        npv,
        accuracy,
        balancedAccuracy,
        f1Score,
        mcc
    };
}

// Drawing functions
function drawDistributions(d) {
    try {
        const baseRate = parseFloat(document.getElementById("base-rate-slider").value) / 100;

        // Get ICC values
        const icc1 = parseFloat(document.getElementById("icc1-slider").value);
        const icc2 = parseFloat(document.getElementById("icc2-slider").value);

        // Calculate standard deviations based on reliabilities
        const sigma1 = currentView === "true" ? 1 : 1 / Math.sqrt(icc1); // Group 1
        const sigma2 = currentView === "true" ? 1 : 1 / Math.sqrt(icc2); // Group 2
        
        const x = d3.range(-6, 6.1, 0.1);  // Changed to match domain, added .1 to include end point
        const data1 = x.map(val => ({
            x: val,
            y: StatUtils.normalPDF(val, 0, sigma1) * (1-baseRate),
        }));
        const data2 = x.map(val => ({
            x: val,
            y: StatUtils.normalPDF(val, d, sigma2) * baseRate,
        }));

        // Calculate maximum y-value for adjusting the yScale
        const maxY = Math.max(d3.max(data1, d => d.y), d3.max(data2, d => d.y));
        
        // Ensure y-axis starts at 0 and extends slightly above max
        yScale.domain([0, maxY * 1.1]); // 10% buffer for top of plot

        // Update y-axis
        plotGroup.select(".y-axis")
            .transition()
            .duration(300)
            .call(d3.axisLeft(yScale).tickFormat(() => ""));

        // Create an area generator that will close the path to the bottom
        const area = d3.area()
            .x(d => xScale(d.x))
            .y0(yScale(0))  // Bottom of the plot
            .y1(d => yScale(d.y));  // Top of the distribution

        // Remove existing distributions before drawing new ones
        plotGroup.selectAll(".distribution").remove();

        // Draw control distribution (black)
        plotGroup.append("path")
            .attr("class", "distribution")
            .datum(data1)
            .attr("fill", "black")
            .attr("opacity", 0.3)
            .attr("d", area);

        // Draw patient distribution (teal)
        plotGroup.append("path")
            .attr("class", "distribution")
            .datum(data2)
            .attr("fill", "teal")
            .attr("opacity", 0.3)
            .attr("d", area);

        // Update legend
        const urlParams = parseURLParams(); // Get URL params
        const label1 = urlParams.label1 || "Group 1"; // Default if not provided
        const label2 = urlParams.label2 || "Group 2"; // Default if not provided
        const legendData = [label1, label2];
        updateLegend(legendData);
    } catch (error) {
        console.error("Error drawing distributions:", error);
    }
}

function updateLegend(legendData) {
    try {
        const legend = plotGroup.selectAll(".legend-group").data(legendData);

        // Remove any excess legend elements
        legend.exit().remove();

        // Add new legend elements and set initial attributes
        const legendEnter = legend.enter()
            .append("foreignObject")
            .attr("class", "legend-group")
            .attr("width", 300)
            .attr("height", 40);

        // Add editable group labels
        legendEnter.append("xhtml:div")
            .attr("contenteditable", true)
            .style("font-size", `${PLOT_CONFIG.fontSize.legendText}px`)
            .style("font-weight", "bold")
            .style("color", (d, i) => (i === 0 ? "#555555" : "teal"))
            .style("display", "inline")
            .style("white-space", "nowrap")
            .style("overflow", "visible")
            .text(d => d);

        // Update the position and properties of all legend elements
        legendEnter.merge(legend)
            .attr("x", PLOT_CONFIG.margin.left)
            .attr("y", (d, i) => PLOT_CONFIG.margin.top + i * 19); // Adjusted for better spacing
    } catch (error) {
        console.error("Error updating legend:", error);
    }
}

function drawThreshold(d) {
    try {
        // Use the stored thresholdValue (don't recalculate)
        const xDomain = xScale.domain();

        // Select or create the threshold group within plotGroup
        const thresholdGroup = plotGroup.selectAll(".threshold-group")
            .data([null]); // Use a single group for the threshold

        const groupEnter = thresholdGroup.enter()
            .append("g")
            .attr("class", "threshold-group")
            .style("cursor", "pointer");

        // Merge enter and update selections
        const thresholdMerge = groupEnter.merge(thresholdGroup);

        // Add or update the threshold line
        const line = thresholdMerge.selectAll(".threshold-line")
            .data([null]);

        line.enter()
            .append("line")
            .attr("class", "threshold-line")
            .merge(line)
            .attr("x1", xScale(thresholdValue))
            .attr("x2", xScale(thresholdValue))
            .attr("y1", 0)
            .attr("y2", height - PLOT_CONFIG.margin.top - PLOT_CONFIG.margin.bottom)
            .attr("stroke", "red")
            .attr("stroke-width", 4)
            .attr("opacity", 0.9);

        // Add or update the hitbox
        const hitbox = thresholdMerge.selectAll(".threshold-hitbox")
            .data([null]);

        hitbox.enter()
            .append("rect")
            .attr("class", "threshold-hitbox")
            .merge(hitbox)
            .attr("x", xScale(thresholdValue) - 10)
            .attr("width", 20)
            .attr("y", 0)
            .attr("height", height - PLOT_CONFIG.margin.top - PLOT_CONFIG.margin.bottom)
            .attr("fill", "transparent");

        // Add or update the arrows
        const arrowSize = 10;
        const arrowY = 10; // Position arrows near the top
        const arrowData = [
            { direction: "left", y: arrowY },
            { direction: "right", y: arrowY }
        ];

        const arrows = thresholdMerge.selectAll(".threshold-arrow")
            .data(arrowData);

        arrows.enter()
            .append("path")
            .attr("class", "threshold-arrow")
            .merge(arrows)
            .attr("d", d => {
                const x = xScale(thresholdValue + (d.direction === "left" ? -0.35 : 0.35));
                const y = d.y;
                if (d.direction === "left") {
                    return `M${x},${y} l${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                } else {
                    return `M${x},${y} l-${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                }
            })
            .attr("fill", "red");

        // Remove any excess elements
        arrows.exit().remove();

        // Add drag behavior after elements are created
        thresholdMerge.call(d3.drag()
            .on("drag", function(event) {
                // Get new threshold value from drag position, accounting for margins
                let newThreshold = xScale.invert(event.x);
                // Constrain to the x-axis domain
                newThreshold = Math.max(xDomain[0], Math.min(xDomain[1], newThreshold));
                thresholdValue = newThreshold;

                // Update threshold line position immediately
                d3.select(this).select(".threshold-line")
                    .attr("x1", xScale(newThreshold))
                    .attr("x2", xScale(newThreshold));

                // Update hitbox position immediately
                d3.select(this).select(".threshold-hitbox")
                    .attr("x", xScale(newThreshold) - 10);

                // Update arrows immediately
                d3.select(this).selectAll(".threshold-arrow")
                    .attr("d", d => {
                        const x = xScale(newThreshold + (d.direction === "left" ? -0.33 : 0.33));
                        const y = d.y;
                        if (d.direction === "left") {
                            return `M${x},${y} l${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                        } else {
                            return `M${x},${y} l-${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                        }
                    });

                plotROC(d);
            }));

        // Ensure the threshold group is always on top
        thresholdMerge.raise();
    } catch (error) {
        console.error("Error drawing threshold:", error);
    }
}

function plotROC(d) {
    try {
        const baseRate = parseFloat(document.getElementById("base-rate-slider").value) / 100;

        // Get ICC values for standard deviation calculation
        const icc1 = parseFloat(document.getElementById("icc1-slider").value);
        const icc2 = parseFloat(document.getElementById("icc2-slider").value);

        // Calculate standard deviations based on current view
        const sigma1 = currentView === "true" ? 1 : 1 / Math.sqrt(icc1); // Group 1
        const sigma2 = currentView === "true" ? 1 : 1 / Math.sqrt(icc2); // Group 2

        // Calculate AUC 
        const datt = d * Math.sqrt(2) / Math.sqrt(sigma1**2 + sigma2**2);
        const auc = StatUtils.normalCDF(datt / Math.sqrt(2), 0, 1);

        const tMin = -20;
        const tMax = 20;
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
            // Use appropriate standard deviations for each distribution
            const cdfA = StatUtils.normalCDF(t, 0, sigma1);  // Group 1
            const cdfB = StatUtils.normalCDF(t, d, sigma2);  // Group 2

            FPR.push(1 - cdfA);
            TPR.push(1 - cdfB);
            
            // Calculate precision for each point
            const sens = 1 - cdfB;  // Sensitivity (TPR)
            const spec = cdfA;      // Specificity (1 - FPR)
            // When sensitivity is 0, precision is 1 by convention
            const prec = sens === 0 ? 1 : (sens * baseRate) / (sens * baseRate + (1 - spec) * (1 - baseRate));
            precision.push(prec);
            recall.push(sens);      // Recall is the same as sensitivity
        }

        // Add the end point explicitly
        FPR.push(0);
        TPR.push(0);
        precision.push(1);
        recall.push(0);

        // Get metrics at current threshold
        const metrics = computeMetricsForBinaryDistributions(d, baseRate, sigma1, sigma2, thresholdValue);

        // Update dashboard values
        document.getElementById("sensitivity-value").textContent = metrics.sensitivity.toFixed(2);
        document.getElementById("specificity-value").textContent = metrics.specificity.toFixed(2);
        document.getElementById("balanced-accuracy-value").textContent = metrics.balancedAccuracy.toFixed(2);
        document.getElementById("accuracy-value").textContent = metrics.accuracy.toFixed(2);
        document.getElementById("f1-value").textContent = metrics.f1Score.toFixed(2);
        document.getElementById("mcc-value").textContent = metrics.mcc.toFixed(2);
        document.getElementById("precision-value").textContent = metrics.ppv.toFixed(2);
        document.getElementById("npv-value").textContent = metrics.npv.toFixed(2);

        // Calculate PR AUC (Average Precision)
        let prauc = 0;
        for (let i = 1; i < recall.length; i++) {
            // Only include segments where recall is decreasing
            if (recall[i] < recall[i-1]) {
                const width = recall[i-1] - recall[i];
                const avgHeight = (precision[i-1] + precision[i]) / 2;
                prauc += width * avgHeight;
            }
        }

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

        const rocThresholdMarker = {
            x: [metrics.fpr],
            y: [metrics.tpr],
            type: "scatter",
            mode: "markers",
            marker: { color: "red", size: 10 },
        };

        const rocLayout = {
            xaxis: { 
                title: "1 - Specificity (FPR)", 
                range: [0, 1], 
                showgrid: false, 
                titlefont: { size: 15 }, 
                dtick: 1 
            },
            yaxis: { 
                title: "Sensitivity (TPR)", 
                range: [0, 1], 
                showgrid: false, 
                titlefont: { size: 15 }, 
                dtick: 1 
            },
            showlegend: false,
            margin: { t: 20, l: 50, r: 30, b: 40 },
            font: { size: 12 },
            annotations: [{
                x: 0.95,
                y: 0.05,
                xref: "paper",
                yref: "paper",
                text: `AUC: ${auc.toFixed(2)}`,
                showarrow: false,
                font: { size: 16, color: "black", weight: "bold" },
                align: "right",
            }],
            autosize: true,
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
            x: [metrics.sensitivity],
            y: [metrics.ppv],
            type: "scatter",
            mode: "markers",
            marker: { color: "red", size: 10 },
        };

        const prLayout = {
            xaxis: { 
                title: "Recall (TPR)", 
                range: [0, 1], 
                showgrid: false, 
                titlefont: { size: 15 }, 
                dtick: 1 
            },
            yaxis: { 
                title: "Precision (PPV)", 
                range: [0, 1], 
                showgrid: false, 
                titlefont: { size: 15 }, 
                dtick: 1 
            },
            showlegend: false,
            margin: { t: 20, l: 50, r: 30, b: 40 },
            font: { size: 13 },
            annotations: [{
                x: 0.05,
                y: 0.05,
                xref: "paper",
                yref: "paper",
                text: `PR-AUC: ${prauc.toFixed(2)}`,
                showarrow: false,
                font: { size: 16, color: "black", weight: "bold" },
                align: "left",
            }],
            autosize: true,
        };

        const config = { 
            staticPlot: true,
            responsive: true,
            displayModeBar: false
        };

        // Plot DCA using the modular DCA module
        DCAModule.plot('binary', {
            sensitivity: metrics.sensitivity,
            specificity: metrics.specificity,
            baseRate: baseRate
        });

        if (!rocInitialized) {
            Plotly.newPlot(SELECTORS.rocPlot, [rocTrace, rocThresholdMarker], rocLayout, config);
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
            Plotly.react(SELECTORS.rocPlot, [rocTrace, rocThresholdMarker], rocLayout, config);
            Plotly.react(SELECTORS.prPlot, [prTrace, prThresholdMarker], prLayout, config);
        }
    } catch (error) {
        console.error("Error plotting ROC curve:", error);
    }
}


// Inverse normal CDF approximation (for converting threshold probability to decision threshold)
function inverseNormalCDF(p) {
    // Beasley-Springer-Moro algorithm
    const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    
    const p_low = 0.02425;
    const p_high = 1 - p_low;
    
    if (0 < p && p < p_low) {
        const q = Math.sqrt(-2 * Math.log(p));
        return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
    }
    
    if (p_low <= p && p <= p_high) {
        const q = p - 0.5;
        const r = q*q;
        return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q / (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);
    }
    
    if (p_high < p && p < 1) {
        const q = Math.sqrt(-2 * Math.log(1-p));
        return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
    }
    
    return 0; // fallback
}

// Effect size and metric conversion functions
function updateMetricsFromD(d) {
    try {
        // Get reliability values
        const icc1 = parseFloat(document.getElementById("icc1-slider").value);
        const icc2 = parseFloat(document.getElementById("icc2-slider").value);
        const kappa = parseFloat(document.getElementById("kappa-slider").value);
        const baseRate = parseFloat(document.getElementById("base-rate-slider").value) / 100;
        
        // Calculate attenuated d
        const dObs = d * Math.sqrt((2 * icc1 * icc2) / (icc1 + icc2) * Math.sin((Math.PI/2) * kappa));

        // Calculate values for true d
        const trueOddsRatio = StatUtils.dToOddsRatio(d);
        const trueLogOddsRatio = StatUtils.dToLogOddsRatio(d);
        const trueR = StatUtils.dToR(d, baseRate);
        const trueEtaSquared = trueR ** 2;

        // Calculate values for observed d
        const obsOddsRatio = StatUtils.dToOddsRatio(dObs);
        const obsLogOddsRatio = StatUtils.dToLogOddsRatio(dObs);
        const obsR = StatUtils.dToR(dObs, baseRate);
        const obsEtaSquared = obsR ** 2;

        // Update all inputs
        document.getElementById("true-difference-number-bin").value = d.toFixed(2);
        document.getElementById("observed-difference-number-bin").value = dObs.toFixed(2);
        document.getElementById("difference-slider").value = d.toFixed(2);

        // Update true metrics
        document.getElementById("true-odds-ratio-bin").value = trueOddsRatio.toFixed(2);
        document.getElementById("true-log-odds-ratio-bin").value = trueLogOddsRatio.toFixed(2);
        document.getElementById("true-pb-r-bin").value = trueR.toFixed(2);
        document.getElementById("true-eta-squared-bin").value = trueEtaSquared.toFixed(2);

        // Update observed metrics
        document.getElementById("observed-odds-ratio-bin").value = obsOddsRatio.toFixed(2);
        document.getElementById("observed-log-odds-ratio-bin").value = obsLogOddsRatio.toFixed(2);
        document.getElementById("observed-pb-r-bin").value = obsR.toFixed(2);
        document.getElementById("observed-eta-squared-bin").value = obsEtaSquared.toFixed(2);
        
        // Update plots
        updatePlots();
    } catch (error) {
        console.error("Error updating metrics from d:", error);
    }
}

function updateMetricsFromOddsRatio(oddsRatio) {
    try {
        oddsRatio = parseFloat(oddsRatio);
        if (isNaN(oddsRatio) || oddsRatio <= 0) return;
        const d = Math.log(oddsRatio) * Math.sqrt(3) / Math.PI;
        updateMetricsFromD(d);
    } catch (error) {
        console.error("Error updating metrics from odds ratio:", error);
    }
}

function updateMetricsFromLogOddsRatio(logOddsRatio) {
    try {
        logOddsRatio = parseFloat(logOddsRatio);
        if (isNaN(logOddsRatio)) return;
        const d = logOddsRatio * Math.sqrt(3) / Math.PI;
        updateMetricsFromD(d);
    } catch (error) {
        console.error("Error updating metrics from log odds ratio:", error);
    }
}

function updateMetricsFromR(r) {
    try {
        r = parseFloat(r);
        if (isNaN(r) || r >= 1 || r <= 0) return;
        const d = (2 * r) / Math.sqrt(1 - r ** 2);
        updateMetricsFromD(d);
    } catch (error) {
        console.error("Error updating metrics from r:", error);
    }
}

// Function to update plots and metrics based on current state
function updatePlots() {
    try {
        const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
        const kappa = parseFloat(document.getElementById("kappa-slider").value);
        
        // Calculate observed mean difference using only kappa
        const dObs = trueD * Math.sqrt(Math.sin((Math.PI/2) * kappa));
        
        // Use appropriate mean difference value based on current view
        const ddiff = currentView === "true" ? trueD : dObs;
        
        // Update plots with the appropriate d value
        drawDistributions(ddiff);
        drawThreshold(ddiff);
        plotROC(ddiff);
    } catch (error) {
        console.error("Error updating plots:", error);
    }
}

// Setup event listeners for controls
function setupEventListeners() {
    try {
        // Toggle buttons
        const trueButton = document.getElementById("true-button-bin");
        const observedButton = document.getElementById("observed-button-bin");

        trueButton.addEventListener("click", () => {
            currentView = "true";
            trueButton.classList.add("active");
            observedButton.classList.remove("active");
            updatePlots();
        });

        observedButton.addEventListener("click", () => {
            currentView = "observed";
            observedButton.classList.add("active");
            trueButton.classList.remove("active");
            updatePlots();
        });

        // Main slider for Cohen's d
        const differenceSlider = document.getElementById("difference-slider");
        differenceSlider.addEventListener("input", (e) => {
            const d = parseFloat(e.target.value);
            document.getElementById("true-difference-number-bin").value = d.toFixed(2);
            updateMetricsFromD(d);
        });

        // True metric inputs
        const trueMetricInputs = {
            d: document.getElementById("true-difference-number-bin"),
            oddsRatio: document.getElementById("true-odds-ratio-bin"),
            logOddsRatio: document.getElementById("true-log-odds-ratio-bin"),
            pbr: document.getElementById("true-pb-r-bin"),
            etaSquared: document.getElementById("true-eta-squared-bin")
        };

        // Reliability controls
        const reliabilityControls = {
            icc1Slider: document.getElementById("icc1-slider"),
            icc1Input: document.getElementById("icc1-number"),
            icc2Slider: document.getElementById("icc2-slider"),
            icc2Input: document.getElementById("icc2-number"),
            kappaSlider: document.getElementById("kappa-slider"),
            kappaInput: document.getElementById("kappa-number")
        };

        // ICC1 listeners
        reliabilityControls.icc1Slider.addEventListener("input", () => {
            reliabilityControls.icc1Input.value = parseFloat(reliabilityControls.icc1Slider.value).toFixed(2);
            const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
            updateMetricsFromD(trueD);
        });
        reliabilityControls.icc1Input.addEventListener("change", () => {
            reliabilityControls.icc1Slider.value = reliabilityControls.icc1Input.value;
            const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
            updateMetricsFromD(trueD);
        });

        // ICC2 listeners
        reliabilityControls.icc2Slider.addEventListener("input", () => {
            reliabilityControls.icc2Input.value = parseFloat(reliabilityControls.icc2Slider.value).toFixed(2);
            const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
            updateMetricsFromD(trueD);
        });
        reliabilityControls.icc2Input.addEventListener("change", () => {
            reliabilityControls.icc2Slider.value = reliabilityControls.icc2Input.value;
            const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
            updateMetricsFromD(trueD);
        });

        // Kappa listeners
        reliabilityControls.kappaSlider.addEventListener("input", () => {
            reliabilityControls.kappaInput.value = parseFloat(reliabilityControls.kappaSlider.value).toFixed(2);
            const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
            updateMetricsFromD(trueD);
        });
        reliabilityControls.kappaInput.addEventListener("change", () => {
            reliabilityControls.kappaSlider.value = reliabilityControls.kappaInput.value;
            const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
            updateMetricsFromD(trueD);
        });

        // Add event listeners to all true metric inputs
        trueMetricInputs.d.addEventListener("change", () => {
            updateMetricsFromD(parseFloat(trueMetricInputs.d.value));
        });
        
        trueMetricInputs.oddsRatio.addEventListener("change", () => {
            updateMetricsFromOddsRatio(trueMetricInputs.oddsRatio.value);
        });

        trueMetricInputs.logOddsRatio.addEventListener("change", () => {
            updateMetricsFromLogOddsRatio(trueMetricInputs.logOddsRatio.value);
        });

        trueMetricInputs.pbr.addEventListener("change", () => {
            updateMetricsFromR(trueMetricInputs.pbr.value);
        });

        trueMetricInputs.etaSquared.addEventListener("change", () => {
            const r = Math.sqrt(parseFloat(trueMetricInputs.etaSquared.value));
            updateMetricsFromR(r);
        });

        // Base rate slider and input
        const baseRateSlider = document.getElementById("base-rate-slider");
        const baseRateInput = document.getElementById("base-rate-number");

        baseRateSlider.addEventListener("input", () => {
            baseRateInput.value = parseFloat(baseRateSlider.value).toFixed(1);
            updateMetricsFromD(parseFloat(document.getElementById("true-difference-number-bin").value));
        });

        baseRateInput.addEventListener("change", () => {
            baseRateSlider.value = baseRateInput.value;
            updateMetricsFromD(parseFloat(document.getElementById("true-difference-number-bin").value));
        });

        // Handle window resize for responsiveness
        window.addEventListener('resize', handleResize);
    } catch (error) {
        console.error("Error setting up event listeners:", error);
    }
}

// Handle window resize for responsiveness
function handleResize() {
    // Get updated dimensions
    const bbox = d3.select(`#${SELECTORS.overlapPlot}`).node().getBoundingClientRect();
    width = bbox.width;
    height = bbox.height;
    
    // Update the SVG viewBox
    d3.select(`#${SELECTORS.overlapPlot}`).select("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);
    
    // Update scales
    xScale.range([0, width - PLOT_CONFIG.margin.left - PLOT_CONFIG.margin.right]);
    yScale.range([height - PLOT_CONFIG.margin.top - PLOT_CONFIG.margin.bottom, 0]);
    
    // Update axes
    plotGroup.select(".x-axis")
        .attr("transform", `translate(0,${height - PLOT_CONFIG.margin.top - PLOT_CONFIG.margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(() => ""));
    
    plotGroup.select(".y-axis")
        .call(d3.axisLeft(yScale).tickFormat(() => ""));
    
    // Update axis labels
    d3.select(`#${SELECTORS.overlapPlot}`).select(".x-label")
        .attr("x", width / 2 - 150)
        .attr("y", height - PLOT_CONFIG.margin.bottom / 2);
    
    d3.select(`#${SELECTORS.overlapPlot}`).select(".y-label")
        .attr("x", -height / 2 - 80);
    
    // Redraw everything
    updatePlots();
}

// Initialize SVG and scales
function initializeSVG() {
    try {
        // Create or update the SVG element
        d3.select(`#${SELECTORS.overlapPlot}`).selectAll("svg").remove();
        
        // Set initial width and height variables - exactly as in original
        const bbox = d3.select(`#${SELECTORS.overlapPlot}`).node().getBoundingClientRect();
        width = bbox.width;
        height = bbox.height;
        
        // Create the SVG element - exactly as in original
        const svgDistributions = d3.select(`#${SELECTORS.overlapPlot}`)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("preserveAspectRatio", "xMidYMid meet");
            
        // Update SVG viewBox to match container size - exactly as in original
        svgDistributions.attr("viewBox", `0 0 ${width} ${height}`);

        // Create a group for the plot content with margins
        plotGroup = svgDistributions.append("g")
            .attr("class", "plot-content")
            .attr("transform", `translate(${PLOT_CONFIG.margin.left},${PLOT_CONFIG.margin.top})`);

        // Create scales with dynamic dimensions - exactly as in original
        xScale = d3.scaleLinear()
            .domain([-5.5, 6])
            .range([0, width - PLOT_CONFIG.margin.left - PLOT_CONFIG.margin.right]);
        
        yScale = d3.scaleLinear()
            .domain([0, 0.5])
            .range([height - PLOT_CONFIG.margin.top - PLOT_CONFIG.margin.bottom, 0]);

        // Create axes groups - exactly as in original
        plotGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height - PLOT_CONFIG.margin.top - PLOT_CONFIG.margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat(() => ""));

        plotGroup.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(yScale).tickFormat(() => ""));

        // Add axis labels with original positioning
        const urlParams = parseURLParams(); 
        const xAxisLabel = urlParams.xaxisLabel || "Predictor";

        svgDistributions.append("foreignObject")
            .attr("class", "x-label")
            .attr("width", 300)
            .attr("height", 40)
            .attr("x", width / 2 - 150)
            .attr("y", height - PLOT_CONFIG.margin.bottom / 2)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", "18px")
            .style("color", "black")
            .text(xAxisLabel);

        svgDistributions.append("foreignObject")
            .attr("class", "y-label")
            .attr("width", 200)
            .attr("height", 25)
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2 - 80)
            .attr("y", PLOT_CONFIG.margin.left / 6)
            .append("xhtml:div")
            .attr("contenteditable", true)
            .style("text-align", "center")
            .style("font-size", "18px")
            .style("color", "black")
            .text("Probability density");
            
    } catch (error) {
        console.error("Error initializing SVG:", error);
    }
}

// Cleanup function for binary.js
function cleanupBinary() {
    // Reset state and clean up plots
    Plotly.purge(SELECTORS.rocPlot);
    Plotly.purge(SELECTORS.prPlot);
    d3.select(`#${SELECTORS.overlapPlot}`).selectAll("*").remove();

    // Cleanup DCA module instance
    if (typeof DCAModule !== 'undefined') {
        DCAModule.cleanup('binary');
    }

    // Reset global vars
    thresholdValue = 0;
    rocInitialized = false;
    currentView = "observed";
}

// Initialize everything for the binary version
function initializeBinary(initialThreshold) {
    // Set initial threshold if provided via URL param
    if (initialThreshold !== undefined && !isNaN(initialThreshold)) {
        thresholdValue = initialThreshold;
    }

    // Initialize DCA module for binary mode
    if (typeof DCAModule !== 'undefined') {
        DCAModule.init('binary', {
            plotSelector: SELECTORS.dcaPlot,
            thresholdMin: 0.05,
            thresholdMax: 0.25,
            onThresholdChange: (min, max) => {
                console.log(`DCA threshold range updated: ${min.toFixed(3)} - ${max.toFixed(3)}`);
            }
        });
    }

    // Setup plot dimensions and scales
    initializeSVG();

    // Add event listeners
    setupEventListeners();

    // Explicitly update metrics based on the slider's default value on initial load
    const initialD = parseFloat(document.getElementById('difference-slider').value);
    updateMetricsFromD(initialD); 

    // Perform initial plot drawing and metric calculation
    updatePlots(); 
    
    // Initialize Mahalanobis D Calculator related elements
    if (typeof initializeMahalanobis === 'function') {
        initializeMahalanobis(); 
    } else {
        console.warn('initializeMahalanobis function not found.');
    }
}

// Export for main.js
window.initializeBinary = initializeBinary;
window.cleanupBinary = cleanupBinary;
})();