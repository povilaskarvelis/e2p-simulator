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
        .attr("height", height);

        svgDistributions.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat(() => "")); // Remove x-axis tick labels

        svgDistributions.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(yScale).tickFormat(() => "")); // Remove y-axis tick labels


    let thresholdValue = 0;
    let rocInitialized = false; // Track if the ROC plot is initialized

    function normalPDF(x, mean, stdDev) {
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
        const greenScale = baseRate;
        const blueScale = 1 - baseRate;

        const x = d3.range(-10, 10, 0.1);

        // Ensure xScale is consistent across the entire code
        xScale.domain([-5, 5]) // Adjust the initial range
            .range([margin.left, width - margin.right]);

        const normalizationFactor = 1 / (Math.sqrt(2 * Math.PI)); // Normal PDF constant

        const data1 = x.map(val => ({
            x: val,
            y: (normalPDF(val, 0, 1) * blueScale) / normalizationFactor,
        }));
        const data2 = x.map(val => ({
            x: val,
            y: (normalPDF(val, d, 1) * greenScale) / normalizationFactor,
        }));

        // Calculate maximum y-value for adjusting the yScale
        const maxYBlue = d3.max(data1, d => d.y);
        const maxYGreen = d3.max(data2, d => d.y);
        const maxY = Math.max(maxYBlue, maxYGreen);
        yScale.domain([0, maxY * 1.1]); // Add a 10% buffer

        // Update y-axis
        svgDistributions.select(".y-axis")
            .transition()
            .duration(300)
            .call(d3.axisLeft(yScale).tickFormat(() => ""));

        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y));

        svgDistributions.selectAll(".distribution").remove();

        // Draw the first (control group) distribution
        svgDistributions.append("path")
            .datum(data1)
            .attr("class", "distribution")
            .attr("fill", "black")
            .attr("opacity", 0.3)
            .attr("stroke", "black")
            .attr("stroke-width", 1.5)
            .attr("d", line);

        // Draw the second (group of interest) distribution
        svgDistributions.append("path")
            .datum(data2)
            .attr("class", "distribution")
            .attr("fill", "teal")
            .attr("opacity", 0.3)
            .attr("stroke", "teal")
            .attr("stroke-width", 1.5)
            .attr("d", line);

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
        const xDomain = xScale.domain(); // Get the min and max of the xScale domain

        // Select the correct distribution container based on the type
        const threshold = svgDistributions.selectAll(".threshold-line").data([thresholdValue]);

        // Select or create the threshold group
        const thresholdGroup = svgDistributions.selectAll(".threshold-group")
            .data([null]); // Use a single group for the threshold

        const groupEnter = thresholdGroup.enter()
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
                    newThreshold = Math.max(xDomain[0], Math.min(xDomain[1], newThreshold));
                    thresholdValue = newThreshold;

                    const d = parseFloat(sliderD.value)

                    // Update the marker position on the ROC curve
                    plotROC(d);
                    // Redraw the threshold group and update visuals
                    drawThreshold(d);
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

        // Adjust threshold range based on d to ensure we capture the full curve
        const tMin = Math.min(-5, -Math.abs(d) - 2);
        const tMax = Math.max(5, Math.abs(d) + 2);
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
            const cdfB = cumulativeDistributionFunction(t, d, 1);

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
        const auc = cumulativeDistributionFunction(d / Math.sqrt(2), 0, 1);

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
            title: "ROC Curve",
            xaxis: { title: "1 - Specificity (FPR)", range: [0, 1], showgrid: false },
            yaxis: { title: "Sensitivity (TPR)", range: [0, 1], showgrid: false },
            showlegend: false,
            margin: { t: 40, l: 60, r: 20, b: 40 },
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
            font: { size: 12 },
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
            title: "PR Curve",
            xaxis: { title: "Recall (TPR)", range: [0, 1], showgrid: false },
            yaxis: { title: "Precision (PPV)", range: [0, 1], showgrid: false },
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

    const sliderD = document.getElementById("difference-slider");
    const inputD = document.getElementById("difference-number");
    const sliderBaseRate = document.getElementById("base-rate-slider");
    const inputBaseRate = document.getElementById("base-rate-number");
    const oddsRatioInput = document.getElementById("odds-ratio");
    const logOddsRatioInput = document.getElementById("log-odds-ratio");
    const aucInput = document.getElementById("auc");
    const pbrInput = document.getElementById("pb-r");
    const etaSquaredInput = document.getElementById("eta-squared");

    function updatePlots() {
        const d = parseFloat(sliderD.value);
        inputD.value = d.toFixed(2);

        const baseRate = parseFloat(sliderBaseRate.value);
        inputBaseRate.value = baseRate.toFixed(1);

        drawDistributions(d);
        drawThreshold(d);
        plotROC(d);
    }

    if (sliderD && inputD) {
        sliderD.addEventListener("input", (e) => {
            const d = parseFloat(e.target.value);
            updateMetricsFromD(d);
        });

        inputD.addEventListener("input", (e) => {
            const d = parseFloat(e.target.value);
            updateMetricsFromD(d);
        });
    }

    if (sliderBaseRate && inputBaseRate) {
        sliderBaseRate.addEventListener("input", updatePlots);
        inputBaseRate.addEventListener("input", () => {
            sliderBaseRate.value = inputBaseRate.value;
            updatePlots();
        });
    }

    if (oddsRatioInput) {
        oddsRatioInput.addEventListener("input", (e) => {
            const oddsRatio = parseFloat(e.target.value);
            updateMetricsFromOddsRatio(oddsRatio);
        });
    }

    if (logOddsRatioInput) {
        logOddsRatioInput.addEventListener("input", (e) => {
            const logOddsRatio = parseFloat(e.target.value);
            updateMetricsFromLogOddsRatio(logOddsRatio);
        });
    }

    if (aucInput) {
        aucInput.addEventListener("input", (e) => {
            const auc = parseFloat(e.target.value);
            updateMetricsFromAUC(auc);
        });
    }

    if (pbrInput) {
        pbrInput.addEventListener("input", (e) => {
            const r = parseFloat(e.target.value);
            updateMetricsFromR(r);
        });
    }

    if (etaSquaredInput) {
        etaSquaredInput.addEventListener("input", (e) => {
            const etaSquared = parseFloat(e.target.value);
            const r = Math.sqrt(etaSquared);
            updateMetricsFromR(r);
        });
    }

    function updateMetricsFromD(d) {
        // Get all elements first
        const elements = {
            oddsRatio: document.getElementById("odds-ratio"),
            logOddsRatio: document.getElementById("log-odds-ratio"),
            auc: document.getElementById("auc"),
            pbr: document.getElementById("pb-r"),
            etaSquared: document.getElementById("eta-squared"),
            slider: document.getElementById("difference-slider"),
            number: document.getElementById("difference-number")
        };

        // Check if all elements exist
        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`Missing element: ${key}`);
                return; // Exit if any element is missing
            }
        }

        // Calculate values
        const oddsRatio = Math.exp(d * Math.PI / Math.sqrt(3));
        const logOddsRatio = d * Math.PI / Math.sqrt(3);
        const auc = cdfNormal(d / Math.sqrt(2), 0, 1);
        const r = d / Math.sqrt(d ** 2 + 4);
        const etaSquared = r ** 2;

        // Update values
        elements.oddsRatio.value = oddsRatio.toFixed(2);
        elements.logOddsRatio.value = logOddsRatio.toFixed(2);
        elements.auc.value = auc.toFixed(3);
        elements.pbr.value = r.toFixed(2);
        elements.etaSquared.value = etaSquared.toFixed(2);
        elements.slider.value = d.toFixed(2);
        elements.number.value = d.toFixed(2);

        // Update plots
        drawDistributions(d);
        drawThreshold(d);
        plotROC(d);
    }

    function updateMetricsFromOddsRatio(oddsRatio) {
        const d = Math.log(oddsRatio) * Math.sqrt(3) / Math.PI;
        updateMetricsFromD(d);
    }

    function updateMetricsFromLogOddsRatio(logOddsRatio) {
        const d = logOddsRatio * Math.sqrt(3) / Math.PI; // Convert Log Odds Ratio back to Cohen's d
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

    // Initialize everything at the end
    updateMetricsFromD(0.5); // Default Cohen's d
    updatePlots();
}

// Export for main.js to use
window.initializeBinary = initializeBinary;