function initializeBinary() {
    const width = 600;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };

    const xScale = d3.scaleLinear().domain([-4, 5]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([0, 0.5]).range([height - margin.bottom, margin.top]);

    // Wait for elements to be in the DOM
    const baseRateSlider = document.getElementById("base-rate-slider");
    const baseRateValue = document.getElementById("base-rate-value");

    // Only set up event listeners if elements exist
    if (baseRateSlider && baseRateValue) {
        baseRateSlider.addEventListener("input", () => {
            baseRateValue.textContent = `${baseRateSlider.value}%`;
            const d = parseFloat(slider.value);
            const baseRate = parseFloat(baseRateSlider.value);
            baseRateValue.textContent = baseRate.toFixed(1) + "%";
            drawDistributions(d);
            drawThreshold(d);
            plotROC(d);
        });
    }

    const svgDistributions = d3.select("#overlap-plot")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("margin-top", "40px");

        svgDistributions.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat(() => "")); // Remove x-axis tick labels

        svgDistributions.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(yScale).tickFormat(() => "")); // Remove y-axis tick labels

    // Editable axis labels
    svgDistributions.selectAll(".x-label")
        .data([null])
        .join("foreignObject")
        .attr("class", "x-label")
        .attr("x", width / 2 - 50)
        .attr("y", height - margin.bottom + 20)
        .attr("width", 100)
        .attr("height", 20)
        .append("xhtml:div")
        .attr("contenteditable", true)
        .style("text-align", "center")
        .style("font-size", "18px")
        .style("color", "black")
        .text("Predictor");

    svgDistributions.selectAll(".y-label")
        .data([null])
        .join("foreignObject")
        .attr("class", "y-label")
        .attr("x", -height / 1.5)
        .attr("y", margin.left - 40)
        .attr("transform", `rotate(-90)`)
        .attr("width", 200)
        .attr("height", 20)
        .append("xhtml:div")
        .attr("contenteditable", true)
        .style("text-align", "center")
        .style("font-size", "18px")
        .style("color", "black")
        .text("Probability Density");

    // Add state variable for current view
    let currentView = "observed";

    let thresholdValue = 0;
    let rocInitialized = false; // Track if the ROC plot is initialized

    function normalPDF(x, mean, stdDev) {
        // Add back normalization factor (1/(σ√(2π)))
        return Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2)) / (stdDev * Math.sqrt(2 * Math.PI));
    }

    function erf(z) {
        const sign = z < 0 ? -1 : 1;
        z = Math.abs(z);
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
        const p = 0.3275911;

        const t = 1 / (1 + p * z);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
        return sign * y;
    }

    function cumulativeDistributionFunction(x, mu = 0, sigma = 1) {
        return 0.5 * (1 + erf((x - mu) / (Math.sqrt(2) * sigma)));
    }

    function drawDistributions(d) {
        const baseRate = parseFloat(document.getElementById("base-rate-slider").value) / 100;


        // Get ICC values
        const icc1 = parseFloat(document.getElementById("icc1-slider").value);
        const icc2 = parseFloat(document.getElementById("icc2-slider").value);

        // Use true or observed standard deviations based on current view
        const sigma1 = currentView === "true" ? 1 : 1 / Math.sqrt(icc1); // Controls
        const sigma2 = currentView === "true" ? 1 : 1 / Math.sqrt(icc2); // Patients
        // Get the true d value from the input
        const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
        
        // Get ICC_G value that was missing
        const iccG = parseFloat(document.getElementById("iccc-slider").value);
        
        // Calculate the mean difference based on true d and ICC_G
        const meanDiff = currentView === "true" ? trueD : trueD * Math.sqrt(iccG);
        
        const x = d3.range(-10, 10, 0.1);

        // Ensure xScale is consistent across the entire code
        xScale.domain([-5, 5])
            .range([margin.left, width - margin.right]);

        const data1 = x.map(val => ({
            x: val,
            y: normalPDF(val, 0, sigma1) * (1-baseRate),
        }));
        const data2 = x.map(val => ({
            x: val,
            y: normalPDF(val, meanDiff, sigma2) * baseRate,
        }));

        // Calculate maximum y-value for adjusting the yScale
        const maxYBlue = d3.max(data1, d => d.y);
        const maxYGreen = d3.max(data2, d => d.y);
        const maxY = Math.max(maxYBlue, maxYGreen);
        
        // Ensure y-axis starts at 0 and extends slightly above max
        const minY = 0;
        const buffer = maxY * 0.1;  // 10% buffer for top of plot
        yScale.domain([minY, maxY + buffer]);

        // Update y-axis
        svgDistributions.select(".y-axis")
            .transition()
            .duration(300)
            .call(d3.axisLeft(yScale).tickFormat(() => ""));

        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y));

        // Create an area generator that will close the path to the bottom
        const area = d3.area()
            .x(d => xScale(d.x))
            .y0(yScale(0))  // Bottom of the plot
            .y1(d => yScale(d.y));  // Top of the distribution

        svgDistributions.selectAll(".distribution").remove();

        // Draw control distribution (black)
        svgDistributions.append("path")
            .attr("class", "distribution")
            .datum(data1)
            .attr("fill", "black")
            .attr("opacity", 0.3)
            .attr("d", area);

        // Draw patient distribution (teal)
        svgDistributions.append("path")
            .attr("class", "distribution")
            .datum(data2)
            .attr("fill", "teal")
            .attr("opacity", 0.3)
            .attr("d", area);

        const legendData = ["Controls", "Patients"];
        const legend = svgDistributions.selectAll(".legend-group").data(legendData);

        // Remove any excess legend elements
        legend.exit().remove();

        // Add new legend elements and set initial attributes
        const legendEnter = legend.enter()
            .append("foreignObject")
            .attr("class", "legend-group")
            .attr("width", 100)
            .attr("height", 20);

        legendEnter.append("xhtml:div")
            .attr("contenteditable", true)
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("color", (d, i) => (i === 0 ? "black" : "teal"))
            .text(d => d);

        // Update the position and properties of all legend elements
        legendEnter.merge(legend)
            .attr("x", width - 520) // Adjust position
            .attr("y", (d, i) => margin.top + i * 20); // Spacing for items

    }

    function drawThreshold(d) {
        const xDomain = xScale.domain();

        // Select or create the threshold group
        const thresholdGroup = svgDistributions.selectAll(".threshold-group")
            .data([null]); // Use a single group for the threshold

        const groupEnter = thresholdGroup.enter()
            .append("g")
            .attr("class", "threshold-group")
            .style("cursor", "pointer")
            .call(d3.drag()
                .on("drag", function(event) {
                    // Get new threshold value from drag position
                    let newThreshold = xScale.invert(event.x);
                    // Constrain to the x-axis domain
                    newThreshold = Math.max(xDomain[0], Math.min(xDomain[1], newThreshold));
                    thresholdValue = newThreshold;

                    // Update threshold line and arrows position
                    thresholdGroup.select(".threshold-line")
                        .attr("x1", xScale(newThreshold))
                        .attr("x2", xScale(newThreshold));

                    // Update arrows
                    thresholdGroup.selectAll(".threshold-arrow")
                        .attr("d", d => {
                            const x = xScale(newThreshold + (d.direction === "left" ? -0.33 : 0.33));
                            const y = d.y;
                            if (d.direction === "left") {
                                return `M${x},${y} l${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                            } else {
                                return `M${x},${y} l-${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                            }
                        });

                    // Update hitbox position
                    thresholdGroup.select(".threshold-hitbox")
                        .attr("x", xScale(newThreshold) - 10);

                    // Update threshold line position
                    d3.select(this).select(".threshold-line")
                        .attr("x1", xScale(newThreshold))
                        .attr("x2", xScale(newThreshold));

                    // Update arrows position
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

                    // Get current d value from the appropriate input
                    const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
                    const icc1 = parseFloat(document.getElementById("icc1-slider").value);
                    const icc2 = parseFloat(document.getElementById("icc2-slider").value);
                    const iccG = parseFloat(document.getElementById("iccc-slider").value);
                    const dObs = trueD * Math.sqrt((2 * icc1 * icc2 / (icc1 + icc2)) * iccG);
                    const dToUse = currentView === "true" ? trueD : dObs;
                    plotROC(dToUse);
                })
            );

        // Merge enter/update for the group
        const groupMerge = groupEnter.merge(thresholdGroup);

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
            .attr("stroke-width", 4)
            .attr("opacity", 0.9);

        // Add or update the hitbox for interaction
        const hitbox = groupMerge.selectAll(".threshold-hitbox")
            .data([null]);

        hitbox.enter()
            .append("rect")
            .attr("class", "threshold-hitbox")
            .merge(hitbox)
            .attr("x", xScale(thresholdValue) - 10)
            .attr("width", 20)
            .attr("y", yScale.range()[1])
            .attr("height", yScale.range()[0] - yScale.range()[1])
            .attr("fill", "transparent");

        // Add or update the arrows
        const arrowSize = 10; // Size of the arrow
        const arrowY = yScale.range()[1] + 10; // Slightly below the top of the y-axis
        const arrowData = [
            { direction: "left", x: thresholdValue - 0.33, y: arrowY },
            { direction: "right", x: thresholdValue + 0.33, y: arrowY },
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

        // Remove excess groups
        thresholdGroup.exit().remove();
    }

    function plotROC(d) {
        const baseRate = parseFloat(document.getElementById("base-rate-slider").value) / 100;

        // Calculate AUC once - it only depends on d
        const auc = cumulativeDistributionFunction(d / Math.sqrt(2), 0, 1);

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
            const cdfA = cumulativeDistributionFunction(t, 0, 1);
            const cdfB = cumulativeDistributionFunction(t, d, 1);  // d is already the correct value from updatePlots

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

        const thresholdFPR = 1 - cumulativeDistributionFunction(thresholdValue, 0, 1);
        const thresholdTPR = 1 - cumulativeDistributionFunction(thresholdValue, d, 1);

        // Calculate metrics
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
        document.getElementById("auc-value").textContent = (auc * 100).toFixed(1) + "%";
        document.getElementById("sensitivity-value").textContent = (sensitivity * 100).toFixed(1) + "%";
        document.getElementById("specificity-value").textContent = (specificity * 100).toFixed(1) + "%";
        document.getElementById("accuracy-value").textContent = (balancedAccuracy * 100).toFixed(1) + "%";
        document.getElementById("ppv-value").textContent = (ppv * 100).toFixed(1) + "%";

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
            x: [thresholdFPR],
            y: [thresholdTPR],
            type: "scatter",
            mode: "markers",
            marker: { color: "red", size: 10 },
        };

        const rocLayout = {
            xaxis: { title: "1 - Specificity (FPR)", range: [0, 1], showgrid: false, titlefont: { size: 14 } },
            yaxis: { title: "Sensitivity (TPR)", range: [0, 1], showgrid: false, titlefont: { size: 14 } },
            showlegend: false,
            margin: { t: 40, l: 60, r: 20, b: 40 },
            font: { size: 12 },
            annotations: [{
                x: 0.95,
                y: 0.05,
                xref: "paper",
                yref: "paper",
                text: `AUC: ${(auc * 100).toFixed(1)}%`,
                showarrow: false,
                font: { size: 16, color: "black", weight: "bold" },
                align: "right",
            }],
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
            xaxis: { title: "Recall (TPR)", range: [0, 1], showgrid: false, titlefont: { size: 14 } },
            yaxis: { title: "Precision (PPV)", range: [0, 1], showgrid: false, titlefont: { size: 14 } },
            showlegend: false,
            margin: { t: 40, l: 60, r: 20, b: 40 },
            font: { size: 12 },
            annotations: [{
                x: 0.05,
                y: 0.05,
                xref: "paper",
                yref: "paper",
                text: `PR-AUC: ${(prauc * 100).toFixed(1)}%`,
                showarrow: false,
                font: { size: 16, color: "black", weight: "bold" },
                align: "left",
            }],
        };

        const config = { staticPlot: true };

        if (!rocInitialized) {
            Plotly.newPlot("roc-plot", [rocTrace, rocThresholdMarker], rocLayout, config);
            Plotly.newPlot("pr-plot", [prTrace, prThresholdMarker], prLayout, config);
            rocInitialized = true;
        } else {
            Plotly.react("roc-plot", [rocTrace, rocThresholdMarker], rocLayout, config);
            Plotly.react("pr-plot", [prTrace, prThresholdMarker], prLayout, config);
        }
    }

    function updateMetricsFromD(d) {
        // Get reliability values
        const icc1 = parseFloat(document.getElementById("icc1-slider").value);
        const icc2 = parseFloat(document.getElementById("icc2-slider").value);
        const iccG = parseFloat(document.getElementById("iccc-slider").value);
        
        // Calculate attenuated d
        const dObs = d * Math.sqrt((2 * icc1 * icc2 / (icc1 + icc2)) * iccG);

        // Calculate values for true d
        const trueOddsRatio = Math.exp(d * Math.PI / Math.sqrt(3));
        const trueLogOddsRatio = d * Math.PI / Math.sqrt(3);
        const trueAuc = cdfNormal(d / Math.sqrt(2), 0, 1);
        const trueR = d / Math.sqrt(d ** 2 + 4);
        const trueEtaSquared = trueR ** 2;

        // Calculate values for observed d
        const obsOddsRatio = Math.exp(dObs * Math.PI / Math.sqrt(3));
        const obsLogOddsRatio = dObs * Math.PI / Math.sqrt(3);
        const obsAuc = cdfNormal(dObs / Math.sqrt(2), 0, 1);
        const obsR = dObs / Math.sqrt(dObs ** 2 + 4);
        const obsEtaSquared = obsR ** 2;

        // Update all inputs
        document.getElementById("true-difference-number-bin").value = d.toFixed(2);
        document.getElementById("observed-difference-number-bin").value = dObs.toFixed(2);
        document.getElementById("difference-slider").value = d.toFixed(2);

        // Update true metrics
        document.getElementById("true-odds-ratio-bin").value = trueOddsRatio.toFixed(2);
        document.getElementById("true-log-odds-ratio-bin").value = trueLogOddsRatio.toFixed(2);
        document.getElementById("true-auc-bin").value = trueAuc.toFixed(2);
        document.getElementById("true-pb-r-bin").value = trueR.toFixed(2);
        document.getElementById("true-eta-squared-bin").value = trueEtaSquared.toFixed(2);

        // Update observed metrics
        document.getElementById("observed-odds-ratio-bin").value = obsOddsRatio.toFixed(2);
        document.getElementById("observed-log-odds-ratio-bin").value = obsLogOddsRatio.toFixed(2);
        document.getElementById("observed-auc-bin").value = obsAuc.toFixed(2);
        document.getElementById("observed-pb-r-bin").value = obsR.toFixed(2);
        document.getElementById("observed-eta-squared-bin").value = obsEtaSquared.toFixed(2);

        // Update plots using updatePlots to respect current view
        updatePlots();
    }

    function updatePlots() {
        const trueD = parseFloat(document.getElementById("true-difference-number-bin").value);
        const icc1 = parseFloat(document.getElementById("icc1-slider").value);
        const icc2 = parseFloat(document.getElementById("icc2-slider").value);
        const iccG = parseFloat(document.getElementById("iccc-slider").value);
        
        // Calculate observed d based on reliabilities
        const dObs = trueD * Math.sqrt((2 * icc1 * icc2 / (icc1 + icc2)) * iccG);
        
        // Update observed metrics
        document.getElementById("observed-difference-number-bin").value = dObs.toFixed(2);
        document.getElementById("observed-odds-ratio-bin").value = Math.exp(dObs * Math.PI / Math.sqrt(3)).toFixed(2);
        document.getElementById("observed-log-odds-ratio-bin").value = (dObs * Math.PI / Math.sqrt(3)).toFixed(2);
        document.getElementById("observed-auc-bin").value = cdfNormal(dObs / Math.sqrt(2), 0, 1).toFixed(3);
        document.getElementById("observed-pb-r-bin").value = (dObs / Math.sqrt(dObs ** 2 + 4)).toFixed(2);
        const obsR = dObs / Math.sqrt(dObs ** 2 + 4);
        document.getElementById("observed-eta-squared-bin").value = (obsR ** 2).toFixed(2);
        
        // Use appropriate d value based on current view
        const dToUse = currentView === "true" ? trueD : dObs;
        
        // Update plots with the appropriate d value
        drawDistributions(dToUse);
        drawThreshold(dToUse);
        plotROC(dToUse);
    }

    // Conversion functions
    function updateMetricsFromOddsRatio(oddsRatio) {
        const d = Math.log(oddsRatio) * Math.sqrt(3) / Math.PI;
        updateMetricsFromD(d);
    }

    function updateMetricsFromLogOddsRatio(logOddsRatio) {
        const d = logOddsRatio * Math.sqrt(3) / Math.PI;
        updateMetricsFromD(d);
    }

    function updateMetricsFromAUC(auc) {
        const d = qNorm(auc) * Math.sqrt(2);
        updateMetricsFromD(d);
    }

    function updateMetricsFromR(r) {
        const d = (2 * r) / Math.sqrt(1 - r ** 2);
        updateMetricsFromD(d);
    }

    // Utility functions
    function cdfNormal(x, mean, stdev) {
        return (1 - erf((mean - x) / (Math.sqrt(2) * stdev))) / 2;
    }

    function qNorm(p) {
        p = parseFloat(p);
        var split = 0.42;
        var a0 = 2.50662823884;
        var a1 = -18.61500062529;
        var a2 = 41.39119773534;
        var a3 = -25.44106049637;
        var b1 = -8.47351093090;
        var b2 = 23.08336743743;
        var b3 = -21.06224101826;
        var b4 = 3.13082909833;
        var c0 = -2.78718931138;
        var c1 = -2.29796479134;
        var c2 = 4.85014127135;
        var c3 = 2.32121276858;
        var d1 = 3.54388924762;
        var d2 = 1.63706781897;
        var q = p - 0.5;

        var r, ppnd;

        if (Math.abs(q) <= split) {
            r = q * q;
            ppnd = q * (((a3 * r + a2) * r + a1) * r + a0) / ((((b4 * r + b3) * r + b2) * r + b1) * r + 1);
        } else {
            r = p;
            if (q > 0) r = 1 - p;
            if (r > 0) {
                r = Math.sqrt(-Math.log(r));
                ppnd = (((c3 * r + c2) * r + c1) * r + c0) / ((d2 * r + d1) * r + 1);
                if (q < 0) ppnd = -ppnd;
            } else {
                ppnd = 0;
            }
        }
        return ppnd;
    }

    // Move event listener setup to the top level
    function setupEventListeners() {
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
            auc: document.getElementById("true-auc-bin"),
            pbr: document.getElementById("true-pb-r-bin"),
            etaSquared: document.getElementById("true-eta-squared-bin")
        };

        // Reliability controls
        const reliabilityControls = {
            icc1Slider: document.getElementById("icc1-slider"),
            icc1Input: document.getElementById("icc1-number"),
            icc2Slider: document.getElementById("icc2-slider"),
            icc2Input: document.getElementById("icc2-number"),
            iccGSlider: document.getElementById("iccc-slider"),
            iccGInput: document.getElementById("iccc-number")
        };

        // ICC1 listeners
        reliabilityControls.icc1Slider.addEventListener("input", () => {
            reliabilityControls.icc1Input.value = parseFloat(reliabilityControls.icc1Slider.value).toFixed(2);
            updatePlots();
        });
        reliabilityControls.icc1Input.addEventListener("input", () => {
            reliabilityControls.icc1Slider.value = reliabilityControls.icc1Input.value;
            updatePlots();
        });

        // ICC2 listeners
        reliabilityControls.icc2Slider.addEventListener("input", () => {
            reliabilityControls.icc2Input.value = parseFloat(reliabilityControls.icc2Slider.value).toFixed(2);
            updatePlots();
        });
        reliabilityControls.icc2Input.addEventListener("input", () => {
            reliabilityControls.icc2Slider.value = reliabilityControls.icc2Input.value;
            updatePlots();
        });

        // ICC_G listeners
        reliabilityControls.iccGSlider.addEventListener("input", () => {
            reliabilityControls.iccGInput.value = parseFloat(reliabilityControls.iccGSlider.value).toFixed(2);
            updatePlots();
        });
        reliabilityControls.iccGInput.addEventListener("input", () => {
            reliabilityControls.iccGSlider.value = reliabilityControls.iccGInput.value;
            updatePlots();
        });

        // Add event listeners to all true metric inputs
        trueMetricInputs.d.addEventListener("input", (e) => {
            const d = parseFloat(e.target.value);
            differenceSlider.value = d;
            updateMetricsFromD(d);
        });

        trueMetricInputs.oddsRatio.addEventListener("input", (e) => {
            const oddsRatio = parseFloat(e.target.value);
            updateMetricsFromOddsRatio(oddsRatio);
        });

        trueMetricInputs.logOddsRatio.addEventListener("input", (e) => {
            const logOddsRatio = parseFloat(e.target.value);
            updateMetricsFromLogOddsRatio(logOddsRatio);
        });

        trueMetricInputs.auc.addEventListener("input", (e) => {
            const auc = parseFloat(e.target.value);
            updateMetricsFromAUC(auc);
        });

        trueMetricInputs.pbr.addEventListener("input", (e) => {
            const r = parseFloat(e.target.value);
            updateMetricsFromR(r);
        });

        trueMetricInputs.etaSquared.addEventListener("input", (e) => {
            const etaSquared = parseFloat(e.target.value);
            const r = Math.sqrt(etaSquared);
            updateMetricsFromR(r);
        });

        // Base rate slider and input
        const baseRateSlider = document.getElementById("base-rate-slider");
        const baseRateInput = document.getElementById("base-rate-number");

        baseRateSlider.addEventListener("input", () => {
            baseRateInput.value = parseFloat(baseRateSlider.value).toFixed(1);
            updatePlots();
        });

        baseRateInput.addEventListener("input", () => {
            baseRateSlider.value = baseRateInput.value;
            updatePlots();
        });
    }

    // Call setupEventListeners after elements are available
    setupEventListeners();

    // Initialize with default values
    updateMetricsFromD(0.5);
    updatePlots();
}

// Export for main.js to use
window.initializeBinary = initializeBinary;