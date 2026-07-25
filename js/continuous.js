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
let currentTrueR = 0.5;
let currentObservedR = 0.5;
let currentAnalysisR = 0.5;

// Hybrid architecture:
// - Metrics / ROC / PR / DCA / densities / joint contours: bivariate-normal analytics
// - Monte Carlo sample for legacy rank-biserial + light scatter overlay on contours
const RANK_BISERIAL_SAMPLE_SIZE = 4000;
const SCATTER_VIZ_POINTS = 1600; // light point cloud over contours for interpretability
const PLOT_POINTS_FULL = 4000; // unused for contours; kept for any residual helpers
const SETTLE_DELAY_MS = 100;

let pendingUpdateRaf = null;
let settleTimer = null;
let pendingThresholdMetricsRaf = null;
let trueDataGenCache = null;
let observedDataGenCache = null;
let hiddenViewDrawPending = false;
let lastPlotsQuality = "full";
// Cached ROC/PR curve geometry so threshold drags only move markers / metrics
let cachedCurveState = null;

// Utility functions
function computeObservedR(trueR, reliabilityX, reliabilityY) {
    return trueR * Math.sqrt(reliabilityX * reliabilityY);
}

function getBaseRateFraction() {
    return percentageToFraction(document.getElementById("base-rate-slider-cont").value);
}

function getQuadratureOptions(quality) {
    // Interactive scrubbing uses a slightly lighter grid; settled updates use full resolution.
    // Both are far more accurate than the old Monte Carlo path at display precision.
    if (quality === "interactive") {
        return { curvePoints: 240, yNodes: 100 };
    }
    return { curvePoints: 400, yNodes: 150 };
}

function getRankBiserialSampleSize() {
    return RANK_BISERIAL_SAMPLE_SIZE;
}

function cancelPendingPlotUpdates() {
    if (pendingUpdateRaf != null) {
        cancelAnimationFrame(pendingUpdateRaf);
        pendingUpdateRaf = null;
    }
    if (settleTimer != null) {
        clearTimeout(settleTimer);
        settleTimer = null;
    }
}

function cancelPendingThresholdMetrics() {
    if (pendingThresholdMetricsRaf != null) {
        cancelAnimationFrame(pendingThresholdMetricsRaf);
        pendingThresholdMetricsRaf = null;
    }
}

// Threshold line follows the pointer every event; metrics/plots update once per frame
// on the current cached sample (full precision of whatever is loaded — never coarsened).
function scheduleThresholdMetricsUpdate() {
    if (pendingThresholdMetricsRaf != null) return;
    pendingThresholdMetricsRaf = requestAnimationFrame(() => {
        pendingThresholdMetricsRaf = null;
        plotROC({ thresholdOnly: true });
    });
}

// Coalesce parameter scrubbing to one update per frame; settle redraws both views
// at full quadrature resolution (viz sample stays light either way).
function scheduleInteractiveUpdate() {
    if (settleTimer != null) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
        settleTimer = null;
        cancelPendingPlotUpdates();
        updatePlots({ quality: "full", visibleOnly: false });
    }, SETTLE_DELAY_MS);

    if (pendingUpdateRaf != null) return;
    pendingUpdateRaf = requestAnimationFrame(() => {
        pendingUpdateRaf = null;
        updatePlots({ quality: "interactive", visibleOnly: true });
    });
}

function scheduleSettledUpdate() {
    cancelPendingPlotUpdates();
    updatePlots({ quality: "full", visibleOnly: false });
}

function requestImmediateFullUpdate() {
    cancelPendingPlotUpdates();
    updatePlots({ quality: "full", visibleOnly: false });
}

// Tiny sample used only for the legacy rank-biserial UI definition
function generateLabeledData(r, options = {}) {
    const numPoints = options.numPoints != null ? options.numPoints : getRankBiserialSampleSize();
    const numPlotPoints = PLOT_POINTS_FULL;
    const meanX = 0, meanY = 0, stdDevX = 1, stdDevY = 1;
    const baseRate = getBaseRateFraction();

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
    
    // Calculate Likelihood Ratios
    const lrPlus = sensitivity / (1 - specificity);
    const lrMinus = (1 - sensitivity) / specificity;
    const dor = lrPlus / lrMinus;
    const youden = sensitivity + specificity - 1;
    const gMean = Math.sqrt(sensitivity * specificity);

    // Cohen's kappa (chance-corrected agreement) using observed marginals
    const pYesTrue = data.filter(d => d.trueClass === 1).length / data.length;
    const pYesPred = predictions.filter(p => p === 1).length / data.length;
    const pNoTrue = 1 - pYesTrue;
    const pNoPred = 1 - pYesPred;
    const po = accuracy;
    const peChance = pYesTrue * pYesPred + pNoTrue * pNoPred;
    const kappa = (po - peChance) / (1 - peChance || 1);

    // Post-test probabilities
    const baseRate = data.filter(d => d.trueClass === 1).length / data.length;
    const preTestOdds = baseRate / (1 - baseRate);
    const postTestOddsPlus = preTestOdds * lrPlus;
    const postTestOddsMinus = preTestOdds * lrMinus;

    const postTestProbPlus = postTestOddsPlus / (1 + postTestOddsPlus);
    const postTestProbMinus = postTestOddsMinus / (1 + postTestOddsMinus);

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
        lrPlus,
        lrMinus,
        dor,
        youden,
        gMean,
        postTestProbPlus,
        postTestProbMinus,
        kappa,
        fpr: 1 - specificity
    };
}

function computePtFromThresholdContinuous(threshold) {
    try {
        return StatUtils.bivariatePosteriorProb(
            currentAnalysisR,
            getBaseRateFraction(),
            threshold
        );
    } catch (err) {
        console.error('Error computing continuous p_t from threshold:', err);
        return 0.5;
    }
}

function computeThresholdFromPtContinuous(targetPt) {
    try {
        return StatUtils.bivariateThresholdFromPt(
            currentAnalysisR,
            getBaseRateFraction(),
            targetPt
        );
    } catch (err) {
        console.error('Error computing continuous threshold from p_t:', err);
        return thresholdValue;
    }
}

const SCORE_SLIDER_MIN_CONT = -4;
const SCORE_SLIDER_MAX_CONT = 4;

// Sync left-panel controls: slider ↔ score threshold; number ↔ implied p_t.
// Param scrubbing keeps the score (and slider) fixed and only refreshes p_t.
function updatePtDisplayContinuous() {
    const pt = computePtFromThresholdContinuous(thresholdValue);
    const clampedPt = Math.min(Math.max(pt, 0.01), 0.99);
    const ptInput = document.getElementById('pt-input-cont');
    const scoreSlider = document.getElementById('threshold-slider-cont');
    if (ptInput) ptInput.value = clampedPt.toFixed(2);
    if (scoreSlider) {
        const score = Math.min(Math.max(thresholdValue, SCORE_SLIDER_MIN_CONT), SCORE_SLIDER_MAX_CONT);
        scoreSlider.value = score.toFixed(2);
    }
}

function setThresholdFromScoreContinuous(score) {
    thresholdValue = Math.min(Math.max(score, SCORE_SLIDER_MIN_CONT), SCORE_SLIDER_MAX_CONT);
    updateThreshold(thresholdValue);
}

function setThresholdFromPtControlsContinuous(pt) {
    pt = Math.min(Math.max(pt, 0.01), 0.99);
    const ptInput = document.getElementById('pt-input-cont');
    if (ptInput) ptInput.value = pt.toFixed(2);
    thresholdValue = computeThresholdFromPtContinuous(pt);
    updateThreshold(thresholdValue); // refreshes p_t number + score slider
}

// Helper: Build sorted arrays and suffix counts for a fast sweep; subsamples if needed
function buildSweepData(data, maxPoints) {
    try {
        const N = data.length;
        const stride = N > maxPoints ? Math.ceil(N / maxPoints) : 1;
        // Subsample deterministically by stride to keep distribution structure
        const sampled = stride === 1 ? data : data.filter((_, idx) => idx % stride === 0);
        // Sort by x ascending
        const sorted = sampled.slice().sort((a, b) => a.x - b.x);
        const n = sorted.length;
        const xs = new Array(n);
        const labels = new Array(n);
        for (let i = 0; i < n; i++) {
            xs[i] = sorted[i].x;
            labels[i] = sorted[i].trueClass === 1 ? 1 : 0;
        }
        // Build suffix counts for class 1 and class 0
        const posSuffix = new Array(n);
        const negSuffix = new Array(n);
        let posCount = 0;
        let negCount = 0;
        for (let i = n - 1; i >= 0; i--) {
            if (labels[i] === 1) posCount++; else negCount++;
            posSuffix[i] = posCount;
            negSuffix[i] = negCount;
        }
        const posTotal = posCount;
        const negTotal = negCount;
        return { xs, labels, posSuffix, negSuffix, posTotal, negTotal };
    } catch (e) {
        console.error('Error building sweep data:', e);
        return { xs: [], labels: [], posSuffix: [], negSuffix: [], posTotal: 0, negTotal: 0 };
    }
}

// Helper: lower bound index (first i where arr[i] >= value)
function lowerBound(arr, value) {
    let left = 0, right = arr.length;
    while (left < right) {
        const mid = (left + right) >> 1;
        if (arr[mid] < value) left = mid + 1; else right = mid;
    }
    return Math.max(0, Math.min(arr.length - 1, left));
}

// Cleanup function for switching views
function cleanupContinuous() {
    cancelPendingPlotUpdates();
    cancelPendingThresholdMetrics();

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
    trueDataGenCache = null;
    observedDataGenCache = null;
    hiddenViewDrawPending = false;
    lastPlotsQuality = "full";
    cachedCurveState = null;
    currentTrueR = 0.5;
    currentObservedR = 0.5;
    currentAnalysisR = 0.5;
}

// Drawing functions
function drawJointContours(r, type, options = {}) {
    drawDistributions(r, type, { esMetrics: options.esMetrics || null });

    const domain = [-4, 4];
    const scatterXScale = d3.scaleLinear().domain(domain).range([PLOT_CONFIG.margin.left, PLOT_CONFIG.margin.left + PLOT_AREA.width]);
    const scatterYScale = d3.scaleLinear().domain(domain).range([PLOT_CONFIG.margin.top + PLOT_AREA.height, PLOT_CONFIG.margin.top]);

    const svgScatter = d3.select(`#${type === "true" ? SELECTORS.scatterPlotTrue : SELECTORS.scatterPlotObserved}`)
        .selectAll("svg")
        .data([null])
        .join("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${PLOT_CONFIG.viewBoxWidth} ${PLOT_CONFIG.viewBoxHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("display", "block")
        .style("max-width", "100%");

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

    const urlParams = parseURLParams();
    const xAxisLabel = urlParams.xaxisLabel || "Predictor";
    const yAxisScatterLabel = urlParams.yaxisScatterLabel || "Outcome";

    // Avoid duplicating editable labels on redraw
    if (svgScatter.select(".x-label").empty()) {
        svgScatter.append("foreignObject")
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
    }

    if (svgScatter.select(".y-label").empty()) {
        svgScatter.append("foreignObject")
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
    }

    // Clip plot contents to the axes frame, and class coloring to the outer contour
    let defs = svgScatter.select("defs");
    if (defs.empty()) defs = svgScatter.append("defs");
    const clipId = `joint-clip-${type}`;
    const ellipseClipId = `joint-ellipse-clip-${type}`;

    defs.selectAll(`#${clipId}`).data([null]).join("clipPath")
        .attr("id", clipId)
        .selectAll("rect").data([null]).join("rect")
        .attr("x", PLOT_CONFIG.margin.left)
        .attr("y", PLOT_CONFIG.margin.top)
        .attr("width", PLOT_AREA.width)
        .attr("height", PLOT_AREA.height);

    svgScatter.selectAll(".joint-layer").remove();
    const layer = svgScatter.append("g")
        .attr("class", "joint-layer")
        .attr("clip-path", `url(#${clipId})`);

    const baseRate = getBaseRateFraction();
    const c = StatUtils.bivariateClassCutoff(baseRate);
    const cClamped = Math.max(domain[0], Math.min(domain[1], c));

    const line = d3.line()
        .x(d => scatterXScale(d.x))
        .y(d => scatterYScale(d.y))
        .curve(d3.curveLinearClosed);

    // Outermost contour defines where case/control coloring is visible
    const levels = [6.25, 4, 2.25, 1]; // outer → inner
    const outerPts = StatUtils.bivariateContourEllipse(r, levels[0], 180);

    defs.selectAll(`#${ellipseClipId}`).data([null]).join("clipPath")
        .attr("id", ellipseClipId)
        .selectAll("path").data([null]).join("path")
        .attr("d", line(outerPts));

    // Case / control fill only inside the joint distribution contour
    const shaded = layer.append("g")
        .attr("class", "joint-shaded")
        .attr("clip-path", `url(#${ellipseClipId})`);

    shaded.append("rect")
        .attr("class", "joint-region joint-region-case")
        .attr("x", scatterXScale(domain[0]))
        .attr("y", scatterYScale(domain[1]))
        .attr("width", scatterXScale(domain[1]) - scatterXScale(domain[0]))
        .attr("height", Math.max(0, scatterYScale(cClamped) - scatterYScale(domain[1])))
        .attr("fill", "teal")
        .attr("opacity", 0.28);

    shaded.append("rect")
        .attr("class", "joint-region joint-region-control")
        .attr("x", scatterXScale(domain[0]))
        .attr("y", scatterYScale(cClamped))
        .attr("width", scatterXScale(domain[1]) - scatterXScale(domain[0]))
        .attr("height", Math.max(0, scatterYScale(domain[0]) - scatterYScale(cClamped)))
        .attr("fill", "#777777")
        .attr("opacity", 0.22);

    // Dichotomization boundary only across the colored distribution
    shaded.append("line")
        .attr("class", "class-boundary")
        .attr("x1", scatterXScale(domain[0]))
        .attr("x2", scatterXScale(domain[1]))
        .attr("y1", scatterYScale(cClamped))
        .attr("y2", scatterYScale(cClamped))
        .attr("stroke", "teal")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "10,8")
        .attr("opacity", 0.95);

    // Contour strokes on top (outermost already used for clip)
    levels.forEach((level, idx) => {
        const pts = idx === 0 ? outerPts : StatUtils.bivariateContourEllipse(r, level, 160);
        layer.append("path")
            .attr("class", "joint-contour")
            .attr("d", line(pts))
            .attr("fill", "none")
            .attr("stroke", "#333333")
            .attr("stroke-width", 2.2 - idx * 0.25)
            .attr("opacity", 0.5 + idx * 0.08);
    });

    // Light scatter above contours. Drawn outside the clipped layer and filtered so
    // each glyph is fully inside the outer ellipse (no half-cut circles).
    svgScatter.selectAll(".joint-scatter").remove();
    const sample = options.samplePoints || [];
    if (sample.length > 0) {
        const pointRadiusPx = 6.5;
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        const oneMinusR2 = Math.max(1e-12, 1 - rr * rr);
        const domainSpan = domain[1] - domain[0];
        const rDataX = pointRadiusPx * domainSpan / PLOT_AREA.width;
        const rDataY = pointRadiusPx * domainSpan / PLOT_AREA.height;
        // Worst-case Mahalanobis growth for a Euclidean step of size ~rData
        const rData = Math.max(rDataX, rDataY);
        const mahalPad = rData / Math.sqrt(Math.max(1e-6, 1 - Math.abs(rr)));
        const outerRho = Math.sqrt(levels[0]);
        const maxRho = Math.max(0, outerRho - mahalPad);
        const maxQ = maxRho * maxRho;

        const fullyInside = sample.filter(d => {
            if (d.x < domain[0] + rDataX || d.x > domain[1] - rDataX) return false;
            if (d.y < domain[0] + rDataY || d.y > domain[1] - rDataY) return false;
            const q = (d.x * d.x - 2 * rr * d.x * d.y + d.y * d.y) / oneMinusR2;
            return q <= maxQ;
        });
        const stride = Math.max(1, Math.ceil(fullyInside.length / SCATTER_VIZ_POINTS));
        const plotPoints = fullyInside.filter((_, i) => i % stride === 0);

        svgScatter.append("g")
            .attr("class", "joint-scatter")
            .selectAll(".scatter-point")
            .data(plotPoints, d => `${d.x}-${d.y}-${d.trueClass}`)
            .join("circle")
            .attr("class", "scatter-point")
            .attr("r", pointRadiusPx)
            .attr("cx", d => scatterXScale(d.x))
            .attr("cy", d => scatterYScale(d.y))
            .attr("fill", d => (d.trueClass === 1 ? "teal" : "#666666"))
            .attr("opacity", 0.35);
    }
}

function drawDistributions(r, type, options = {}) {
    // Clear any existing SVG to avoid duplicate plots
    d3.select(`#${type === "true" ? SELECTORS.distributionPlotTrue : SELECTORS.distributionPlotObserved}`).selectAll("svg").remove();

    const xRange = [-4, 4];
    xScale.domain(xRange);

    const baseRate = getBaseRateFraction();
    const dens = StatUtils.bivariateGroupDensities(r, baseRate, {
        xMin: xRange[0],
        xMax: xRange[1],
        xPoints: 181,
        yNodes: 140
    });
    const tealDensity = dens.caseDensity;
    const grayDensity = dens.controlDensity;

    // Prefer analytical bivariate effect sizes when provided
    const esMetrics = options.esMetrics || StatUtils.bivariateEffectSizes(r, baseRate);

    document.getElementById(`${type}-rank-biserial-cont`).value = esMetrics.rankBiserial.toFixed(2);
    document.getElementById(`${type}-glass-d-cont`).value = esMetrics.glassD.toFixed(2);

    const metrics = {
        d: esMetrics.d,
        da: esMetrics.da,
        cohensU3: esMetrics.cohensU3,
        meanTeal: esMetrics.meanTeal,
        meanGray: esMetrics.meanGray,
        varianceTeal: esMetrics.varianceTeal,
        varianceGray: esMetrics.varianceGray
    };

    if (type === "true") {
        trueMetrics = metrics;
    } else if (type === "observed") {
        observedMetrics = metrics;
    }

    updateMetricsFromD(metrics, type);

    const maxYTeal = d3.max(tealDensity, d => d.y) || 0;
    const maxYGray = d3.max(grayDensity, d => d.y) || 0;
    const maxY = Math.max(maxYTeal, maxYGray, 0.1);

    yScale.domain([0, maxY * 1.1]).range([PLOT_CONFIG.margin.top + PLOT_AREA.height, PLOT_CONFIG.margin.top]);
    xScale.range([PLOT_CONFIG.margin.left, PLOT_CONFIG.margin.left + PLOT_AREA.width]);

    d3.select(`#${type === "true" ? SELECTORS.distributionPlotTrue : SELECTORS.distributionPlotObserved}`)
        .select("svg").remove();
    const newSvg = d3.select(`#${type === "true" ? SELECTORS.distributionPlotTrue : SELECTORS.distributionPlotObserved}`)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${PLOT_CONFIG.viewBoxWidth} ${PLOT_CONFIG.viewBoxHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("display", "block")
        .style("max-width", "100%");

    newSvg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${PLOT_CONFIG.margin.top + PLOT_AREA.height})`)
        .call(d3.axisBottom(xScale).tickFormat(() => ""))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-width", PLOT_CONFIG.tickWidth)
            .attr("y2", PLOT_CONFIG.tickSize))
        .call(g => g.selectAll("path.domain")
            .attr("stroke-width", PLOT_CONFIG.tickWidth));

    newSvg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${PLOT_CONFIG.margin.left},0)`)
        .call(d3.axisLeft(yScale).tickFormat(() => ""))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-width", PLOT_CONFIG.tickWidth)
            .attr("x2", -PLOT_CONFIG.tickSize))
        .call(g => g.selectAll("path.domain")
            .attr("stroke-width", PLOT_CONFIG.tickWidth));

    // Smooth analytical densities (same visual language as binary mode)
    const area = d3.area()
        .x(d => xScale(d.x))
        .y0(yScale(0))
        .y1(d => yScale(d.y));

    newSvg.append("path")
        .attr("class", "distribution gray-distribution")
        .datum(grayDensity)
        .attr("fill", "black")
        .attr("opacity", 0.3)
        .attr("d", area);

    newSvg.append("path")
        .attr("class", "distribution teal-distribution")
        .datum(tealDensity)
        .attr("fill", "teal")
        .attr("opacity", 0.4)
        .attr("d", area);

    const urlParamsDist = parseURLParams();
    const xAxisLabelDist = urlParamsDist.xaxisLabel || "Predictor";

    newSvg.selectAll(".x-label")
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
        .text(xAxisLabelDist);

    newSvg.selectAll(".y-label")
        .data([null])
        .join("foreignObject")
        .attr("class", "y-label")
        .attr("transform", `translate(${PLOT_CONFIG.margin.left - 90}, ${PLOT_CONFIG.margin.top + PLOT_AREA.height / 2 + 125}) rotate(-90)`)
        .attr("width", 300)
        .attr("height", 40)
        .append("xhtml:div")
        .attr("contenteditable", true)
        .style("text-align", "center")
        .style("font-size", `${PLOT_CONFIG.fontSize.axisLabel}px`)
        .style("color", "black")
        .text("Probability density");

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

    legendEnter.append("xhtml:div")
        .attr("contenteditable", true)
        .style("font-size", `${PLOT_CONFIG.fontSize.legendText}px`)
        .style("font-weight", "bold")
        .style("color", (d, i) => (i === 0 ? "#777777" : "teal"))
        .style("display", "inline")
        .text(d => d);

    legendEnter.merge(legend)
        .attr("x", PLOT_CONFIG.margin.left + 100)
        .attr("y", (d, i) => PLOT_CONFIG.margin.top + i * 34 + 30);

    newSvg.selectAll(".threshold-group").remove();
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
                // Line tracks the pointer continuously (no discrete snap).
                updateThresholdVisual(thresholdGroup);
                // Metrics stay on the current sample at full precision; coalesce Plotly/DCA work.
                updatePtDisplayContinuous();
                scheduleThresholdMetricsUpdate();
            })
            .on("end", function () {
                cancelPendingThresholdMetrics();
                updatePtDisplayContinuous();
                plotROC({ thresholdOnly: true });
            })
        );

    // Calculate plot area bounds based on viewBox and margins
    const plotTop = PLOT_CONFIG.margin.top;
    const plotBottom = PLOT_CONFIG.margin.top + PLOT_AREA.height;

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

    // Threshold above distributions, but under legend text
    thresholdGroup.raise();
    svg.selectAll(".legend-group").raise();
}

// Update threshold line / hitbox / arrows in place (keeps the active drag gesture intact)
function updateThresholdVisual(thresholdGroup) {
    const group = thresholdGroup || d3.select(
        `#${currentView === "true" ? SELECTORS.distributionPlotTrue : SELECTORS.distributionPlotObserved} .threshold-group`
    );
    if (group.empty()) return;

    const plotTop = PLOT_CONFIG.margin.top;
    const plotBottom = PLOT_CONFIG.margin.top + PLOT_AREA.height;
    const x = xScale(thresholdValue);

    group.select(".threshold-line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", plotTop)
        .attr("y2", plotBottom);

    group.select(".threshold-hitbox")
        .attr("x", x - 15);

    const arrowSize = 15;
    const arrowY = plotTop + 15;
    const arrowData = [
        { direction: "left", x: thresholdValue - 0.2, y: arrowY },
        { direction: "right", x: thresholdValue + 0.2, y: arrowY },
    ];
    group.selectAll(".threshold-arrow")
        .data(arrowData)
        .attr("d", d => {
            const ax = xScale(d.x);
            const ay = d.y;
            if (d.direction === "left") {
                return `M${ax},${ay} l${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
            }
            return `M${ax},${ay} l-${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
        });
}

function plotROC(options = {}) {
    const quality = options.quality || "full";
    const liveThresholdDrag = !!options.thresholdOnly;
    const reuseCurves = !!(liveThresholdDrag || options.reuseCurves) && cachedCurveState;
    const baseRate = getBaseRateFraction();
    const r = currentAnalysisR;

    let FPR, TPR, precision, recall, auc, prauc;

    if (reuseCurves) {
        ({ FPR, TPR, precision, recall, auc, prauc } = cachedCurveState);
    } else {
        const curves = StatUtils.bivariateDiscriminationCurves(r, baseRate, getQuadratureOptions(quality));
        FPR = curves.FPR;
        TPR = curves.TPR;
        precision = curves.precision;
        recall = curves.recall;
        auc = curves.auc;
        prauc = curves.prauc;
        cachedCurveState = { FPR, TPR, precision, recall, auc, prauc, baseRate, r };
    }

    // Threshold metrics from bivariate quadrature (not Monte Carlo)
    const yNodes = getQuadratureOptions(liveThresholdDrag ? "full" : quality).yNodes;
    const currentMetrics = StatUtils.bivariatePredictiveMetrics(r, baseRate, thresholdValue, yNodes);

    const metricsToUpdate = {
        "accuracy-value-cont": currentMetrics.accuracy,
        "sensitivity-value-cont": currentMetrics.sensitivity,
        "specificity-value-cont": currentMetrics.specificity,
        "balanced-accuracy-value-cont": currentMetrics.balancedAccuracy,
        "youden-value-cont": currentMetrics.youden,
        "f1-value-cont": currentMetrics.f1Score,
        "mcc-value-cont": currentMetrics.mcc,
        "npv-value-cont": currentMetrics.npv,
        "ppv-value-cont": currentMetrics.ppv,
        "lr-plus-value-cont": currentMetrics.lrPlus,
        "lr-minus-value-cont": currentMetrics.lrMinus,
        "dor-value-cont": currentMetrics.dor,
        "gmean-value-cont": currentMetrics.gMean,
        "posttest-plus-value-cont": currentMetrics.postTestProbPlus,
        "posttest-minus-value-cont": currentMetrics.postTestProbMinus,
        "kappa-value-cont": currentMetrics.kappa
    };

    Object.entries(metricsToUpdate).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = Number.isFinite(value) ? value.toFixed(2) : "∞";
        }
    });

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
            x: prauc < 0.27 ? 0.95 : 0.05,
            y: prauc < 0.27 ? 0.95 : 0.05,
            xref: "paper",
            yref: "paper",
            text: `PR-AUC: ${prauc.toFixed(2)}`,
            showarrow: false,
            font: { size: 16, color: "black", weight: "bold" },
            align: prauc < 0.27 ? "right" : "left",
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

    if (document.getElementById(SELECTORS.dcaPlot) && typeof DCAModule !== 'undefined') {
        DCAModule.plot('continuous', {
            sensitivity: currentMetrics.sensitivity,
            specificity: currentMetrics.specificity,
            baseRate: baseRate,
            FPR: FPR,
            TPR: TPR,
            currentThreshold: thresholdValue,
            currentThresholdProb: computePtFromThresholdContinuous(thresholdValue),
            currentMetrics: currentMetrics,
            thresholdRange: { min: -4, max: 4 },
            // During live threshold drags, skip temporal smoothing so the marker tracks continuously.
            usePreciseEstimates: false,
            interactionMode: false,
            disableSmoothing: liveThresholdDrag
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
    const baseRate = getBaseRateFraction();
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
function updatePlots(options = {}) {
    const quality = options.quality || "full";
    const visibleOnly = !!options.visibleOnly;

    // Get current values (r=1 is singular under perfect reliability)
    const MAX_PEARSON_R = 0.99;
    let trueR = parseFloat(document.getElementById("true-pearson-r-cont").value);
    if (!isNaN(trueR) && trueR > MAX_PEARSON_R) {
        trueR = MAX_PEARSON_R;
        document.getElementById("true-pearson-r-cont").value = trueR.toFixed(2);
        const effectSlider = document.getElementById("effect-slider-cont");
        if (effectSlider) effectSlider.value = trueR;
    }
    const reliabilityX = parseFloat(document.getElementById("reliability-x-number-cont").value);
    const reliabilityY = parseFloat(document.getElementById("reliability-y-number-cont").value);

    // Calculate observed R
    const observedR = computeObservedR(trueR, reliabilityX, reliabilityY);
    currentTrueR = trueR;
    currentObservedR = observedR;
    currentAnalysisR = (currentView === "true") ? trueR : observedR;

    // Update the readonly observed r and r-squared inputs
    document.getElementById("observed-pearson-r-cont").value = observedR.toFixed(2);
    document.getElementById("true-R-squared-cont").value = (trueR**2).toFixed(2);
    document.getElementById("observed-R-squared-cont").value = (observedR**2).toFixed(2);

    const baseRate = getBaseRateFraction();
    const quad = getQuadratureOptions(quality);
    // Analytical curves + effect sizes for both views
    const trueCurves = StatUtils.bivariateDiscriminationCurves(trueR, baseRate, quad);
    const observedCurves = StatUtils.bivariateDiscriminationCurves(observedR, baseRate, quad);
    const trueES = StatUtils.bivariateEffectSizes(trueR, baseRate, { auc: trueCurves.auc });
    const observedES = StatUtils.bivariateEffectSizes(observedR, baseRate, { auc: observedCurves.auc });

    // Monte Carlo sample: rank-biserial + light scatter overlay
    const trueDataGen = generateLabeledData(trueR);
    const observedDataGen = generateLabeledData(observedR);

    trueES.rankBiserial = computeEffectSizeMetrics(
        trueDataGen.tealData.map(d => d.x),
        trueDataGen.grayData.map(d => d.x)
    ).rankBiserial;
    observedES.rankBiserial = computeEffectSizeMetrics(
        observedDataGen.tealData.map(d => d.x),
        observedDataGen.grayData.map(d => d.x)
    ).rankBiserial;

    trueLabeledData = trueDataGen.labeledData;
    observedLabeledData = observedDataGen.labeledData;
    trueDataGenCache = trueDataGen;
    observedDataGenCache = observedDataGen;
    lastPlotsQuality = quality;

    // Refresh hidden-view first, then visible view last (shared scales for threshold drag)
    if (visibleOnly && currentView !== "true") {
        drawDistributions(trueR, "true", { esMetrics: trueES });
    }
    if (visibleOnly && currentView !== "observed") {
        drawDistributions(observedR, "observed", { esMetrics: observedES });
    }
    if (!visibleOnly || currentView === "true") {
        drawJointContours(trueR, "true", {
            esMetrics: trueES,
            samplePoints: trueDataGen.labeledData
        });
    }
    if (!visibleOnly || currentView === "observed") {
        drawJointContours(observedR, "observed", {
            esMetrics: observedES,
            samplePoints: observedDataGen.labeledData
        });
    }
    hiddenViewDrawPending = visibleOnly;

    // Set the CURRENT data / analysis r for ROC plot based on view
    currentLabeledData = (currentView === "true") ? trueLabeledData : observedLabeledData;
    currentAnalysisR = (currentView === "true") ? trueR : observedR;

    // Seed curve cache for the active view so threshold drags stay cheap
    const activeCurves = (currentView === "true") ? trueCurves : observedCurves;
    cachedCurveState = {
        FPR: activeCurves.FPR,
        TPR: activeCurves.TPR,
        precision: activeCurves.precision,
        recall: activeCurves.recall,
        auc: activeCurves.auc,
        prauc: activeCurves.prauc,
        baseRate,
        r: currentAnalysisR
    };

    // Update ROC/PR/DCA from analytics (reuse curves just computed above)
    plotROC({ quality, reuseCurves: true });

    // Ensure the correct scatter/distribution plots are visible
    togglePlotVisibility();

    if (options.syncPt !== false) {
        updatePtDisplayContinuous();
    }
}

function ensureVisibleViewDrawn() {
    if (!hiddenViewDrawPending) return;
    const trueR = currentTrueR;
    const observedR = currentObservedR;
    const baseRate = getBaseRateFraction();

    if (currentView === "true" && trueDataGenCache) {
        const es = StatUtils.bivariateEffectSizes(trueR, baseRate, {
            auc: cachedCurveState && cachedCurveState.r === trueR ? cachedCurveState.auc : undefined
        });
        es.rankBiserial = computeEffectSizeMetrics(
            trueDataGenCache.tealData.map(d => d.x),
            trueDataGenCache.grayData.map(d => d.x)
        ).rankBiserial;
        drawJointContours(trueR, "true", {
            esMetrics: es,
            samplePoints: trueDataGenCache.labeledData
        });
    } else if (currentView === "observed" && observedDataGenCache) {
        const es = StatUtils.bivariateEffectSizes(observedR, baseRate, {
            auc: cachedCurveState && cachedCurveState.r === observedR ? cachedCurveState.auc : undefined
        });
        es.rankBiserial = computeEffectSizeMetrics(
            observedDataGenCache.tealData.map(d => d.x),
            observedDataGenCache.grayData.map(d => d.x)
        ).rankBiserial;
        drawJointContours(observedR, "observed", {
            esMetrics: es,
            samplePoints: observedDataGenCache.labeledData
        });
    }
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
    
    const MAX_PEARSON_R = 0.99;
    const clampPearsonR = (r) => Math.min(Math.max(r, 0), MAX_PEARSON_R);

    effectSlider.addEventListener("input", (e) => {
        const sliderValue = clampPearsonR(parseFloat(e.target.value));
        effectInput.value = sliderValue.toFixed(2);
        scheduleInteractiveUpdate();
    });
    effectSlider.addEventListener("change", scheduleSettledUpdate);
    
    effectInput.addEventListener("change", () => {
        const r = clampPearsonR(parseFloat(effectInput.value));
        if (isNaN(r)) return;
        effectInput.value = r.toFixed(2);
        effectSlider.value = r;
        requestImmediateFullUpdate();
    });
    
    // Added listener for R^2 input
    rSquaredInput.addEventListener("change", () => {
        const rSquared = parseFloat(rSquaredInput.value);
        if (!isNaN(rSquared) && rSquared >= 0 && rSquared <= 1) {
            const r = clampPearsonR(Math.sqrt(rSquared));
            effectInput.value = r.toFixed(2);
            effectSlider.value = r; // Update slider value too
            requestImmediateFullUpdate();
        }
    });

    // Base rate slider and input
    const baseRateSlider = document.getElementById("base-rate-slider-cont");
    const baseRateInput = document.getElementById("base-rate-number-cont");
    
    baseRateSlider.addEventListener("input", () => {
        const percent = parseFloat(baseRateSlider.value);
        baseRateInput.value = isNaN(percent) ? "" : percent.toFixed(1);
        scheduleInteractiveUpdate();
    });
    baseRateSlider.addEventListener("change", scheduleSettledUpdate);

    baseRateInput.addEventListener("change", () => {
        let percent = parseFloat(baseRateInput.value);
        if (isNaN(percent)) return;
        percent = Math.min(Math.max(percent, 0.1), 99.9);
        baseRateInput.value = percent.toFixed(1);
        baseRateSlider.value = percent;
        requestImmediateFullUpdate();
    });

    bindRangeNumberPair("reliability-x-slider-cont", "reliability-x-number-cont", {
        decimals: 2,
        onSync: (source) => {
            if (source === "range") scheduleInteractiveUpdate();
            else requestImmediateFullUpdate();
        }
    });
    bindRangeNumberPair("reliability-y-slider-cont", "reliability-y-number-cont", {
        decimals: 2,
        onSync: (source) => {
            if (source === "range") scheduleInteractiveUpdate();
            else requestImmediateFullUpdate();
        }
    });
    document.getElementById("reliability-x-slider-cont").addEventListener("change", scheduleSettledUpdate);
    document.getElementById("reliability-y-slider-cont").addEventListener("change", scheduleSettledUpdate);

    // Plot toggle buttons
    const trueButton = document.getElementById("true-button-cont");
    const observedButton = document.getElementById("observed-button-cont");

    trueButton.addEventListener("click", () => {
        if (currentView === "true") return; // Do nothing if already selected
        currentView = "true";
        trueButton.classList.add("active");
        observedButton.classList.remove("active");
        updateMetricsHighlighting("true");
        currentLabeledData = trueLabeledData;
        currentAnalysisR = currentTrueR;
        cachedCurveState = null; // rebuild analytical curves for this view
        ensureVisibleViewDrawn();
        togglePlotVisibility();
        plotROC({ quality: lastPlotsQuality });
        updatePtDisplayContinuous();
    });

    observedButton.addEventListener("click", () => {
        if (currentView === "observed") return; // Do nothing if already selected
        currentView = "observed";
        observedButton.classList.add("active");
        trueButton.classList.remove("active");
        updateMetricsHighlighting("observed");
        currentLabeledData = observedLabeledData;
        currentAnalysisR = currentObservedR;
        cachedCurveState = null;
        ensureVisibleViewDrawn();
        togglePlotVisibility();
        plotROC({ quality: lastPlotsQuality });
        updatePtDisplayContinuous();
    });

    // Slider ↔ score (red line); number ↔ p_t
    const ptInputCont = document.getElementById('pt-input-cont');
    const scoreSliderCont = document.getElementById('threshold-slider-cont');
    if (scoreSliderCont) {
        scoreSliderCont.addEventListener('input', () => {
            const score = parseFloat(scoreSliderCont.value);
            if (isNaN(score)) return;
            setThresholdFromScoreContinuous(score);
        });
    }
    if (ptInputCont) {
        ptInputCont.addEventListener('change', () => {
            let pt = parseFloat(ptInputCont.value);
            if (isNaN(pt)) return;
            setThresholdFromPtControlsContinuous(pt);
        });
    }
}

// Main initialization function - Now much smaller and focused on orchestration
function initializeContinuous(initialThreshold) {
    // Clean up any existing state
    cleanupContinuous();
    
    // Set initial threshold if provided (after cleanup which resets it to 0)
    if (initialThreshold !== undefined) {
        thresholdValue = initialThreshold;
    }
    
    // Initialize DCA module if available
    if (typeof DCAModule !== 'undefined') {
        DCAModule.init('continuous', {
            plotSelector: SELECTORS.dcaPlot
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
function updateThreshold(newThreshold, options = {}) {
    thresholdValue = newThreshold;
    cancelPendingThresholdMetrics();
    // Update ROC/PR/DCA based on existing currentLabeledData without regenerating data
    plotROC({ thresholdOnly: !!cachedCurveState });
    // Redraw the threshold line on the active distribution plot
    const type = (currentView === "true") ? "true" : "observed";
    const metrics = (type === "true") ? trueMetrics : observedMetrics;
    drawThreshold(metrics, type);
    if (options.syncPt !== false) {
        updatePtDisplayContinuous();
    }
}

// Export for main.js
window.initializeContinuous = initializeContinuous;
window.cleanupContinuous = cleanupContinuous;
window.updateThreshold = updateThreshold;
window.requestImmediateFullUpdate = requestImmediateFullUpdate;
})();