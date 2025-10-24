(function() {
// Calibration Module for E2P Simulator
// Explores calibration drift from test set to deployment

// ============================================================================
// Constants and Configuration
// ============================================================================

const CONFIG = {
    // All calculations are now analytical - no sampling used
    defaultTestEffectSize: 2.5,
    defaultTestICC1: 0.7,
    defaultTestICC2: 0.7,
    defaultTestKappa: 1.0,
    defaultTestBaseRate: 0.5,
    defaultDeploymentEffectSize: 2.5,
    defaultDeploymentICC1: 0.4,
    defaultDeploymentICC2: 0.4,
    defaultDeploymentKappa: 1.0,
    defaultDeploymentBaseRate: 0.3
};

// ============================================================================
// State Variables
// ============================================================================

let state = {
    // Test set parameters
    testEffectSize: CONFIG.defaultTestEffectSize,
    testICC1: CONFIG.defaultTestICC1,
    testICC2: CONFIG.defaultTestICC2,
    testKappa: CONFIG.defaultTestKappa,
    testBaseRate: CONFIG.defaultTestBaseRate,
    
    // Deployment set parameters
    deploymentEffectSize: CONFIG.defaultDeploymentEffectSize,
    deploymentICC1: CONFIG.defaultDeploymentICC1,
    deploymentICC2: CONFIG.defaultDeploymentICC2,
    deploymentKappa: CONFIG.defaultDeploymentKappa,
    deploymentBaseRate: CONFIG.defaultDeploymentBaseRate,
    
    // Model parameters (fitted on test set)
    modelBeta0: null,
    modelBeta1: null,
    
    // Threshold value for calibration exploration
    thresholdValue: 0,
    
    // Data
    testData: null,
    deploymentData: null,
    calibrationData: null
};

// ============================================================================
// Utility Functions
// ============================================================================

// Generate random normal samples
function randomNormal(mean, stdDev, size) {
    const samples = [];
    for (let i = 0; i < size; i++) {
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        samples.push(mean + z * stdDev);
    }
    return samples;
}

// Normal CDF (using error function approximation)
function normalCDF(x, mean = 0, stdDev = 1) {
    const z = (x - mean) / stdDev;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
}

// Normal PDF
function normalPDF(x, mean = 0, stdDev = 1) {
    const z = (x - mean) / stdDev;
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

// Logistic function
function logistic(x) {
    return 1 / (1 + Math.exp(-x));
}

// Apply measurement reliability to observations
function applyReliability(trueValues, reliability) {
    const errorVariance = (1 - reliability);
    return trueValues.map(trueVal => {
        const error = randomNormal(0, Math.sqrt(errorVariance), 1)[0];
        return trueVal + error;
    });
}

// Wilson score confidence interval for proportions
function wilsonInterval(successes, total, confidence = 0.95) {
    if (total === 0) return { lower: 0, upper: 1 };
    
    const p = successes / total;
    const z = 1.96; // 95% confidence
    const denominator = 1 + z * z / total;
    const centre = (p + z * z / (2 * total)) / denominator;
    const margin = z * Math.sqrt((p * (1 - p) / total + z * z / (4 * total * total))) / denominator;
    
    return {
        lower: Math.max(0, centre - margin),
        upper: Math.min(1, centre + margin)
    };
}

// Calculate ROC-AUC analytically
function calculateROCAUC(distParams) {
    // For two normal distributions with known parameters, AUC can be calculated analytically
    // AUC = P(X1 > X0) where X1 ~ N(μ1, σ1²) and X0 ~ N(μ0, σ0²)
    // This equals Φ((μ1 - μ0) / sqrt(σ0² + σ1²))
    
    const mu0 = distParams.group0.mean;
    const mu1 = distParams.group1.mean;
    const sigma0 = distParams.group0.stdDev;
    const sigma1 = distParams.group1.stdDev;
    
    const delta = mu1 - mu0;
    const pooledSD = Math.sqrt(sigma0 * sigma0 + sigma1 * sigma1);
    
    // Use the normal CDF to get the AUC
    const auc = normalCDF(delta / pooledSD, 0, 1);
    
    return auc;
}

// ============================================================================
// Data Generation Functions
// ============================================================================

function generateDataset(effectSize, icc1, icc2, kappa, baseRate, sampleSize) {
    // Calculate the kappa effect on mean separation
    const kappaFactor = Math.sin((Math.PI / 2) * kappa);
    const adjustedEffectSize = effectSize * kappaFactor;
    
    // Calculate group sizes based on base rate
    const n0 = Math.round(sampleSize * (1 - baseRate));
    const n1 = Math.round(sampleSize * baseRate);
    
    // Generate true scores for both groups with kappa-adjusted separation
    // Group 0: mean = 0, Group 1: mean = adjustedEffectSize
    const trueScores0 = randomNormal(0, 1, n0);
    const trueScores1 = randomNormal(adjustedEffectSize, 1, n1);
    
    // Apply measurement reliability separately for each group
    // This increases variance: SD_observed = SD_true / sqrt(ICC)
    const observedScores0 = applyReliability(trueScores0, icc1);
    const observedScores1 = applyReliability(trueScores1, icc2);
    
    // Combine and create dataset
    const X = [...observedScores0, ...observedScores1];
    const y = [...Array(n0).fill(0), ...Array(n1).fill(1)];
    
    return { X, y, n0, n1 };
}

function generateTestData() {
    // Only calculate distribution parameters - no need to generate samples
    // since we use analytical solutions for everything
    const distParams = calculateDistributionParams(
        state.testEffectSize,
        state.testICC1,
        state.testICC2,
        state.testKappa,
        state.testBaseRate
    );
    
    state.testData = { distParams };
    return state.testData;
}

function generateDeploymentData() {
    // Only calculate distribution parameters - no need to generate samples
    // since we use analytical solutions for everything
    const distParams = calculateDistributionParams(
        state.deploymentEffectSize,
        state.deploymentICC1,
        state.deploymentICC2,
        state.deploymentKappa,
        state.deploymentBaseRate
    );
    
    state.deploymentData = { distParams };
    return state.deploymentData;
}

function calculateDistributionParams(effectSize, icc1, icc2, kappa, baseRate) {
    // ICC affects only the width (standard deviation) of distributions
    // Var(observed) = Var(true) / ICC
    // So SD(observed) = SD(true) / sqrt(ICC) = 1 / sqrt(ICC)
    const obsStdDev1 = 1 / Math.sqrt(icc1);
    const obsStdDev2 = 1 / Math.sqrt(icc2);
    
    // Kappa affects the separation between means (not ICC!)
    // Group 0 always has mean = 0
    // Group 1 mean is scaled by kappa: sin(pi/2 * kappa)
    const kappaFactor = Math.sin((Math.PI / 2) * kappa);
    const obsEffectSize = effectSize * kappaFactor;
    
    // Note: The observed Cohen's d will be attenuated by BOTH:
    // 1. Wider distributions (lower ICC → larger denominators)
    // 2. Smaller mean separation (lower kappa → smaller numerator)
    
    return {
        group0: { mean: 0, stdDev: obsStdDev1 },
        group1: { mean: obsEffectSize, stdDev: obsStdDev2 },
        baseRate: baseRate
    };
}

// ============================================================================
// Model Fitting and Prediction
// ============================================================================

function fitLogisticModel() {
    // Store test set distribution parameters for Bayesian prediction
    // This explicitly uses variance information from ICC values
    const params = state.testData.distParams;
    
    state.modelParams = {
        mean0: params.group0.mean,
        std0: params.group0.stdDev,
        mean1: params.group1.mean,
        std1: params.group1.stdDev,
        baseRate: params.baseRate
    };
    
    return state.modelParams;
}

function predictRisk(x) {
    // Use Bayesian posterior probability: P(Y=1|X=x)
    // P(Y=1|X=x) = P(X=x|Y=1)·P(Y=1) / [P(X=x|Y=0)·P(Y=0) + P(X=x|Y=1)·P(Y=1)]
    // This explicitly uses the variance (std dev) from ICC values
    
    if (!state.modelParams) {
        console.error("Model not fitted yet");
        return 0.5;
    }
    
    const { mean0, std0, mean1, std1, baseRate } = state.modelParams;
    
    // Calculate likelihoods (PDFs) - these explicitly use the standard deviations
    // which are affected by ICC: std = 1/sqrt(ICC)
    const likelihood0 = normalPDF(x, mean0, std0);
    const likelihood1 = normalPDF(x, mean1, std1);
    
    // Prior probabilities
    const prior0 = 1 - baseRate;
    const prior1 = baseRate;
    
    // Posterior probability using Bayes rule
    const numerator = likelihood1 * prior1;
    const denominator = likelihood0 * prior0 + likelihood1 * prior1;
    
    // Avoid division by zero
    if (denominator === 0 || denominator < 1e-300) {
        return baseRate;
    }
    
    return numerator / denominator;
}

// ============================================================================
// Calibration Calculations
// ============================================================================

function calculateCalibration() {
    // Calculate analytical calibration curve (no sampling noise)
    const analyticalCurve = calculateAnalyticalCalibrationCurve();
    
    // Calculate calibration metrics analytically
    const metrics = calculateCalibrationMetrics(null, null, null);
    
    state.calibrationData = { 
        analyticalCurve,
        metrics
    };
    return state.calibrationData;
}

function calculateAnalyticalCalibrationCurve() {
    // Generate smooth calibration curve by computing predicted and true probabilities
    // across a fine grid of X values, then plotting true vs predicted
    const xMin = -4;
    const xMax = Math.max(6, state.testEffectSize + 4, state.deploymentEffectSize + 4);
    const nPoints = 500; // Fine grid for smooth curve
    
    const testParams = state.testData.distParams;
    const deployParams = state.deploymentData.distParams;
    
    const points = [];
    
    for (let i = 0; i < nPoints; i++) {
        const x = xMin + (xMax - xMin) * i / (nPoints - 1);
        
        // Predicted probability from test set parameters
        const likelihood0_test = normalPDF(x, testParams.group0.mean, testParams.group0.stdDev);
        const likelihood1_test = normalPDF(x, testParams.group1.mean, testParams.group1.stdDev);
        const prior0_test = 1 - testParams.baseRate;
        const prior1_test = testParams.baseRate;
        const denom_test = likelihood0_test * prior0_test + likelihood1_test * prior1_test;
        const pPred = denom_test > 1e-300 ? (likelihood1_test * prior1_test) / denom_test : testParams.baseRate;
        
        // True probability from deployment set parameters
        const likelihood0_deploy = normalPDF(x, deployParams.group0.mean, deployParams.group0.stdDev);
        const likelihood1_deploy = normalPDF(x, deployParams.group1.mean, deployParams.group1.stdDev);
        const prior0_deploy = 1 - deployParams.baseRate;
        const prior1_deploy = deployParams.baseRate;
        const denom_deploy = likelihood0_deploy * prior0_deploy + likelihood1_deploy * prior1_deploy;
        const pTrue = denom_deploy > 1e-300 ? (likelihood1_deploy * prior1_deploy) / denom_deploy : deployParams.baseRate;
        
        // Weight by the marginal density in deployment set (for sorting/filtering)
        const weight = likelihood0_deploy * prior0_deploy + likelihood1_deploy * prior1_deploy;
        
        if (weight > 1e-300) {
            points.push({
                x: x,
                predicted: pPred,
                observed: pTrue,
                weight: weight
            });
        }
    }
    
    // Sort by predicted probability for a smooth curve
    points.sort((a, b) => a.predicted - b.predicted);
    
    return points;
}

function calculateCalibrationMetrics() {
    // All metrics computed analytically using known distribution parameters
    const { calibrationSlope, calibrationIntercept, brierScore, ece } = calculateAnalyticalMetrics();
    
    return {
        brierScore: brierScore.toFixed(3),
        ece: ece.toFixed(3),
        calibrationSlope: calibrationSlope.toFixed(3),
        calibrationIntercept: calibrationIntercept.toFixed(3)
    };
}

function calculateAnalyticalMetrics() {
    // Compute all calibration metrics analytically using known distribution parameters
    // Generate a fine grid of x values covering the range of both distributions
    const xMin = -4;
    const xMax = Math.max(6, state.testEffectSize + 4, state.deploymentEffectSize + 4);
    const nPoints = 1000; // Fine grid for accurate calculation
    const dx = (xMax - xMin) / nPoints;
    
    const testParams = state.testData.distParams;
    const deployParams = state.deploymentData.distParams;
    
    // For each x value, compute predicted probability (from test) and true probability (from deployment)
    let sumPredicted = 0;
    let sumTrue = 0;
    let sumPredSquared = 0;
    let sumTrueSquared = 0;
    let sumPredTimesTrue = 0;
    let sumBrier = 0;
    let sumAbsCalibError = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < nPoints; i++) {
        const x = xMin + i * dx;
        
        // Predicted probability from test set parameters
        const likelihood0_test = normalPDF(x, testParams.group0.mean, testParams.group0.stdDev);
        const likelihood1_test = normalPDF(x, testParams.group1.mean, testParams.group1.stdDev);
        const prior0_test = 1 - testParams.baseRate;
        const prior1_test = testParams.baseRate;
        const denom_test = likelihood0_test * prior0_test + likelihood1_test * prior1_test;
        const pPred = denom_test > 1e-300 ? (likelihood1_test * prior1_test) / denom_test : testParams.baseRate;
        
        // True probability from deployment set parameters
        const likelihood0_deploy = normalPDF(x, deployParams.group0.mean, deployParams.group0.stdDev);
        const likelihood1_deploy = normalPDF(x, deployParams.group1.mean, deployParams.group1.stdDev);
        const prior0_deploy = 1 - deployParams.baseRate;
        const prior1_deploy = deployParams.baseRate;
        const denom_deploy = likelihood0_deploy * prior0_deploy + likelihood1_deploy * prior1_deploy;
        const pTrue = denom_deploy > 1e-300 ? (likelihood1_deploy * prior1_deploy) / denom_deploy : deployParams.baseRate;
        
        // Weight by the marginal density in deployment set (how often we see this x value)
        const weight = likelihood0_deploy * prior0_deploy + likelihood1_deploy * prior1_deploy;
        
        if (weight > 1e-300) {
            sumPredicted += pPred * weight;
            sumTrue += pTrue * weight;
            sumPredSquared += pPred * pPred * weight;
            sumTrueSquared += pTrue * pTrue * weight;
            sumPredTimesTrue += pPred * pTrue * weight;
            
            // Brier score: E[(pPred - pTrue)^2]
            sumBrier += Math.pow(pPred - pTrue, 2) * weight;
            
            // ECE: E[|pPred - pTrue|]
            sumAbsCalibError += Math.abs(pPred - pTrue) * weight;
            
            totalWeight += weight;
        }
    }
    
    if (totalWeight > 0) {
        const meanPred = sumPredicted / totalWeight;
        const meanTrue = sumTrue / totalWeight;
        const covPredTrue = (sumPredTimesTrue / totalWeight) - (meanPred * meanTrue);
        const varPred = (sumPredSquared / totalWeight) - (meanPred * meanPred);
        
        const slope = varPred > 1e-10 ? covPredTrue / varPred : 1;
        const intercept = meanTrue - slope * meanPred;
        const brierScore = sumBrier / totalWeight;
        const ece = sumAbsCalibError / totalWeight;
        
        return { 
            calibrationSlope: slope, 
            calibrationIntercept: intercept,
            brierScore: brierScore,
            ece: ece
        };
    }
    
    return { 
        calibrationSlope: 1, 
        calibrationIntercept: 0,
        brierScore: 0,
        ece: 0
    };
}

// ============================================================================
// Plotting Functions
// ============================================================================

function plotTestDistributions() {
    const plotDiv = document.getElementById('calibration-test-plot');
    if (!plotDiv) return;
    
    // Generate x values for plotting
    const xMin = -4;
    const xMax = Math.max(8, state.testEffectSize + 4, state.deploymentEffectSize + 4);
    const xValues = [];
    for (let x = xMin; x <= xMax; x += 0.05) {
        xValues.push(x);
    }
    
    // Test set distributions
    const testParams = state.testData.distParams;
    const testGroup0Y = xValues.map(x => 
        normalPDF(x, testParams.group0.mean, testParams.group0.stdDev) * (1 - testParams.baseRate)
    );
    const testGroup1Y = xValues.map(x => 
        normalPDF(x, testParams.group1.mean, testParams.group1.stdDev) * testParams.baseRate
    );
    
    const traces = [
        {
            x: xValues,
            y: testGroup0Y,
            name: 'Group 1',
            mode: 'lines',
            line: { color: '#555555', width: 0 },
            fill: 'tozeroy',
            fillcolor: 'rgba(85, 85, 85, 0.3)',
            legendgroup: 'group1',
            hovertemplate: 'x: %{x:.2f}<br>Density: %{y:.3f}<extra></extra>'
        },
        {
            x: xValues,
            y: testGroup1Y,
            name: 'Group 2',
            mode: 'lines',
            line: { color: 'teal', width: 0 },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 128, 128, 0.3)',
            legendgroup: 'group2',
            hovertemplate: 'x: %{x:.2f}<br>Density: %{y:.3f}<extra></extra>'
        }
    ];
    
    const layout = {
        title: {
            text: 'Test Set',
            font: { size: 16 },
            xanchor: 'left',
            yanchor: 'top',
            x: 0.09,
            y: 0.85
        },
        xaxis: {
            title: '',
            zeroline: false,
            showgrid: false,
            showticklabels: false,
            showline: true,
            linecolor: '#333',
            linewidth: 1
        },
        yaxis: {
            title: '',
            zeroline: false,
            showgrid: false,
            showticklabels: false,
            showline: true,
            linecolor: '#333',
            linewidth: 1
        },
        showlegend: false,
        hovermode: 'closest',
        margin: { t: 50, r: 30, b: 50, l: 60 },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };
    
    const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: true
    };
    
    Plotly.newPlot(plotDiv, traces, layout, config).then(() => {
        addEditableLegend(plotDiv, ['Group 1', 'Group 2']);
        addAUCDisplay(plotDiv, calculateROCAUC(testParams));
        drawThresholdOnTestPlot();
    });
}

function addEditableLegend(plotDiv, legendData) {
    // Remove any existing legend overlay
    d3.select(plotDiv).select('.legend-overlay').remove();
    
    // Get the plotly plot dimensions
    const plotlyPlot = plotDiv.querySelector('.plotly');
    if (!plotlyPlot) return;
    
    // Create SVG overlay for legend
    const svg = d3.select(plotDiv)
        .append('svg')
        .attr('class', 'legend-overlay')
        .style('position', 'absolute')
        .style('top', '0')
        .style('left', '0')
        .style('width', '100%')
        .style('height', '100%')
        .style('pointer-events', 'none');
    
    const legendGroup = svg.append('g')
        .attr('class', 'legend-group-container')
        .attr('transform', 'translate(80, 60)');
    
    // Add legend items
    legendData.forEach((label, i) => {
        const legendItem = legendGroup.append('foreignObject')
            .attr('class', 'legend-item')
            .attr('width', 300)
            .attr('height', 50)
            .attr('x', 0)
            .attr('y', i * 16)
            .style('pointer-events', 'auto');
        
        legendItem.append('xhtml:div')
            .attr('contenteditable', true)
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('color', i === 0 ? '#555555' : 'teal')
            .style('display', 'inline')
            .style('white-space', 'nowrap')
            .style('overflow', 'visible')
            .style('outline', 'none')
            .text(label);
    });
}

function addAUCDisplay(plotDiv, auc) {
    // Remove any existing AUC overlay
    d3.select(plotDiv).select('.auc-overlay').remove();
    
    // Get the plotly plot dimensions
    const plotlyPlot = plotDiv.querySelector('.plotly');
    if (!plotlyPlot) return;
    
    // Create SVG overlay for AUC
    const svg = d3.select(plotDiv)
        .append('svg')
        .attr('class', 'auc-overlay')
        .style('position', 'absolute')
        .style('top', '0')
        .style('left', '0')
        .style('width', '100%')
        .style('height', '100%')
        .style('pointer-events', 'none');
    
    // Add AUC text in top right corner
    const aucText = svg.append('text')
        .attr('class', 'auc-text')
        .attr('x', '95%')
        .attr('y', '60')
        .attr('text-anchor', 'end')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .text(`AUC: ${auc.toFixed(3)}`);
}

function plotDeploymentDistributions() {
    const plotDiv = document.getElementById('calibration-deploy-plot');
    if (!plotDiv) return;
    
    // Generate x values for plotting
    const xMin = -4;
    const xMax = Math.max(8, state.testEffectSize + 4, state.deploymentEffectSize + 4);
    const xValues = [];
    for (let x = xMin; x <= xMax; x += 0.05) {
        xValues.push(x);
    }
    
    // Deployment set distributions
    const deployParams = state.deploymentData.distParams;
    const deployGroup0Y = xValues.map(x => 
        normalPDF(x, deployParams.group0.mean, deployParams.group0.stdDev) * (1 - deployParams.baseRate)
    );
    const deployGroup1Y = xValues.map(x => 
        normalPDF(x, deployParams.group1.mean, deployParams.group1.stdDev) * deployParams.baseRate
    );
    
    const traces = [
        {
            x: xValues,
            y: deployGroup0Y,
            name: 'Group 1',
            mode: 'lines',
            line: { color: '#555555', width: 0 },
            fill: 'tozeroy',
            fillcolor: 'rgba(85, 85, 85, 0.3)',
            showlegend: false,
            hovertemplate: 'x: %{x:.2f}<br>Density: %{y:.3f}<extra></extra>'
        },
        {
            x: xValues,
            y: deployGroup1Y,
            name: 'Group 2',
            mode: 'lines',
            line: { color: 'teal', width: 0 },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 128, 128, 0.3)',
            showlegend: false,
            hovertemplate: 'x: %{x:.2f}<br>Density: %{y:.3f}<extra></extra>'
        }
    ];
    
    const layout = {
        title: {
            text: 'Deployment Set',
            font: { size: 16 },
            xanchor: 'left',
            yanchor: 'top',
            x: 0.09,
            y: 0.85
        },
        xaxis: {
            title: '',
            zeroline: false,
            showgrid: false,
            showticklabels: false,
            showline: true,
            linecolor: '#333',
            linewidth: 1
        },
        yaxis: {
            title: '',
            zeroline: false,
            showgrid: false,
            showticklabels: false,
            showline: true,
            linecolor: '#333',
            linewidth: 1
        },
        showlegend: false,
        hovermode: 'closest',
        margin: { t: 50, r: 30, b: 50, l: 60 },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };
    
    const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: true
    };
    
    Plotly.newPlot(plotDiv, traces, layout, config).then(() => {
        addAUCDisplay(plotDiv, calculateROCAUC(deployParams));
        drawThresholdOnDeploymentPlot();
    });
}

function plotCalibration() {
    const plotDiv = document.getElementById('calibration-plot');
    if (!plotDiv) return;
    
    const { analyticalCurve } = state.calibrationData;
    
    // Prepare data for plotting - use analytical curve (no sampling noise)
    const xPredicted = analyticalCurve.map(p => p.predicted);
    const yObserved = analyticalCurve.map(p => p.observed);
    
    // Perfect calibration line
    const perfectLine = {
        x: [0, 1],
        y: [0, 1],
        name: 'Perfect Calibration',
        mode: 'lines',
        line: { color: '#888888', width: 3, dash: 'dash' },
        hoverinfo: 'skip'
    };
    
    // Observed calibration - smooth analytical curve
    const observedCalibration = {
        x: xPredicted,
        y: yObserved,
        name: 'Observed',
        mode: 'lines',
        line: { color: 'black', width: 3 },
        hovertemplate: 'Predicted: %{x:.3f}<br>Observed: %{y:.3f}<extra></extra>'
    };
    
    // Calculate initial marker position at threshold
    const testParams = state.testData.distParams;
    const deployParams = state.deploymentData.distParams;
    const x = state.thresholdValue;
    
    const likelihood0_test = normalPDF(x, testParams.group0.mean, testParams.group0.stdDev);
    const likelihood1_test = normalPDF(x, testParams.group1.mean, testParams.group1.stdDev);
    const prior0_test = 1 - testParams.baseRate;
    const prior1_test = testParams.baseRate;
    const denom_test = likelihood0_test * prior0_test + likelihood1_test * prior1_test;
    const pPred = denom_test > 1e-300 ? (likelihood1_test * prior1_test) / denom_test : testParams.baseRate;
    
    const likelihood0_deploy = normalPDF(x, deployParams.group0.mean, deployParams.group0.stdDev);
    const likelihood1_deploy = normalPDF(x, deployParams.group1.mean, deployParams.group1.stdDev);
    const prior0_deploy = 1 - deployParams.baseRate;
    const prior1_deploy = deployParams.baseRate;
    const denom_deploy = likelihood0_deploy * prior0_deploy + likelihood1_deploy * prior1_deploy;
    const pObs = denom_deploy > 1e-300 ? (likelihood1_deploy * prior1_deploy) / denom_deploy : deployParams.baseRate;
    
    // Threshold marker
    const thresholdMarker = {
        x: [pPred],
        y: [pObs],
        type: 'scatter',
        mode: 'markers',
        marker: { color: 'red', size: 10 },
        showlegend: false,
        hovertemplate: `Threshold: ${x.toFixed(2)}<br>Predicted: ${pPred.toFixed(3)}<br>Observed: ${pObs.toFixed(3)}<extra></extra>`
    };
    
    const traces = [perfectLine, observedCalibration, thresholdMarker];
    
    const layout = {
        xaxis: {
            title: 'Predicted Probability (from Test Set)',
            range: [0, 1],
            zeroline: true,
            showgrid: false
        },
        yaxis: {
            title: 'Observed Frequency (in Deployment)',
            range: [0, 1],
            zeroline: true,
            showgrid: false
        },
        showlegend: true,
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(255,255,255,0.9)',
            bordercolor: '#ddd',
            borderwidth: 1
        },
        hovermode: 'closest',
        margin: { t: 50, r: 30, b: 50, l: 60 },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };
    
    const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: true
    };
    
    Plotly.newPlot(plotDiv, traces, layout, config);
}

// ============================================================================
// Threshold Functions
// ============================================================================

function drawThresholdOnTestPlot() {
    const plotDiv = document.getElementById('calibration-test-plot');
    if (!plotDiv) return;
    
    const plotlyDiv = d3.select(plotDiv).select('.plotly');
    if (plotlyDiv.empty()) return;
    
    // Get the plot's dimensions
    const fullLayout = plotDiv._fullLayout;
    if (!fullLayout) return;
    
    const xaxis = fullLayout.xaxis;
    const yaxis = fullLayout.yaxis;
    
    // Remove existing threshold if any
    d3.select(plotDiv).select('.threshold-overlay').remove();
    
    // Create SVG overlay for threshold
    const svg = d3.select(plotDiv)
        .append('svg')
        .attr('class', 'threshold-overlay')
        .style('position', 'absolute')
        .style('top', '0')
        .style('left', '0')
        .style('width', '100%')
        .style('height', '100%')
        .style('pointer-events', 'none');
    
    const thresholdGroup = svg.append('g')
        .attr('class', 'threshold-group')
        .style('pointer-events', 'auto')
        .style('cursor', 'ew-resize');
    
    // Calculate x position for threshold
    const xPos = xaxis.l2p(state.thresholdValue) + fullLayout.margin.l;
    const yStart = fullLayout.margin.t;
    const yEnd = fullLayout.height - fullLayout.margin.b;
    
    // Draw threshold line
    thresholdGroup.append('line')
        .attr('class', 'threshold-line')
        .attr('x1', xPos)
        .attr('x2', xPos)
        .attr('y1', yStart)
        .attr('y2', yEnd)
        .attr('stroke', 'red')
        .attr('stroke-width', 4);
    
    // Add invisible hitbox for easier dragging
    thresholdGroup.append('rect')
        .attr('class', 'threshold-hitbox')
        .attr('x', xPos - 10)
        .attr('y', yStart)
        .attr('width', 20)
        .attr('height', yEnd - yStart)
        .attr('fill', 'transparent');
    
    // Add drag behavior
    thresholdGroup.call(d3.drag()
        .on('drag', function(event) {
            const xDomain = xaxis.range;
            let newX = event.x;
            
            // Constrain to plot area
            newX = Math.max(fullLayout.margin.l + xDomain[0], Math.min(fullLayout.margin.l + xaxis._length, newX));
            
            // Convert to data coordinates
            const newThreshold = xaxis.p2d(newX - fullLayout.margin.l);
            state.thresholdValue = newThreshold;
            
            // Update line position
            d3.select(this).select('.threshold-line')
                .attr('x1', newX)
                .attr('x2', newX);
            
            d3.select(this).select('.threshold-hitbox')
                .attr('x', newX - 10);
            
            // Update deployment plot threshold
            updateThresholdOnDeploymentPlot();
            
            // Update calibration marker
            updateCalibrationMarker();
        }));
    
    thresholdGroup.raise();
}

function drawThresholdOnDeploymentPlot() {
    const plotDiv = document.getElementById('calibration-deploy-plot');
    if (!plotDiv) return;
    
    const plotlyDiv = d3.select(plotDiv).select('.plotly');
    if (plotlyDiv.empty()) return;
    
    // Get the plot's dimensions
    const fullLayout = plotDiv._fullLayout;
    if (!fullLayout) return;
    
    const xaxis = fullLayout.xaxis;
    const yaxis = fullLayout.yaxis;
    
    // Remove existing threshold if any
    d3.select(plotDiv).select('.threshold-overlay').remove();
    
    // Create SVG overlay for threshold
    const svg = d3.select(plotDiv)
        .append('svg')
        .attr('class', 'threshold-overlay')
        .style('position', 'absolute')
        .style('top', '0')
        .style('left', '0')
        .style('width', '100%')
        .style('height', '100%')
        .style('pointer-events', 'none');
    
    const thresholdGroup = svg.append('g')
        .attr('class', 'threshold-group')
        .style('pointer-events', 'auto')
        .style('cursor', 'ew-resize');
    
    // Calculate x position for threshold
    const xPos = xaxis.l2p(state.thresholdValue) + fullLayout.margin.l;
    const yStart = fullLayout.margin.t;
    const yEnd = fullLayout.height - fullLayout.margin.b;
    
    // Draw threshold line
    thresholdGroup.append('line')
        .attr('class', 'threshold-line')
        .attr('x1', xPos)
        .attr('x2', xPos)
        .attr('y1', yStart)
        .attr('y2', yEnd)
        .attr('stroke', 'red')
        .attr('stroke-width', 4);
    
    // Add invisible hitbox for easier dragging
    thresholdGroup.append('rect')
        .attr('class', 'threshold-hitbox')
        .attr('x', xPos - 10)
        .attr('y', yStart)
        .attr('width', 20)
        .attr('height', yEnd - yStart)
        .attr('fill', 'transparent');
    
    // Add drag behavior
    thresholdGroup.call(d3.drag()
        .on('drag', function(event) {
            const xDomain = xaxis.range;
            let newX = event.x;
            
            // Constrain to plot area
            newX = Math.max(fullLayout.margin.l + xDomain[0], Math.min(fullLayout.margin.l + xaxis._length, newX));
            
            // Convert to data coordinates
            const newThreshold = xaxis.p2d(newX - fullLayout.margin.l);
            state.thresholdValue = newThreshold;
            
            // Update line position
            d3.select(this).select('.threshold-line')
                .attr('x1', newX)
                .attr('x2', newX);
            
            d3.select(this).select('.threshold-hitbox')
                .attr('x', newX - 10);
            
            // Update test plot threshold
            updateThresholdOnTestPlot();
            
            // Update calibration marker
            updateCalibrationMarker();
        }));
    
    thresholdGroup.raise();
}

function updateThresholdOnTestPlot() {
    const plotDiv = document.getElementById('calibration-test-plot');
    if (!plotDiv) return;
    
    const fullLayout = plotDiv._fullLayout;
    if (!fullLayout) return;
    
    const xaxis = fullLayout.xaxis;
    const xPos = xaxis.l2p(state.thresholdValue) + fullLayout.margin.l;
    
    const thresholdGroup = d3.select(plotDiv).select('.threshold-group');
    if (thresholdGroup.empty()) return;
    
    thresholdGroup.select('.threshold-line')
        .attr('x1', xPos)
        .attr('x2', xPos);
    
    thresholdGroup.select('.threshold-hitbox')
        .attr('x', xPos - 10);
}

function updateThresholdOnDeploymentPlot() {
    const plotDiv = document.getElementById('calibration-deploy-plot');
    if (!plotDiv) return;
    
    const fullLayout = plotDiv._fullLayout;
    if (!fullLayout) return;
    
    const xaxis = fullLayout.xaxis;
    const xPos = xaxis.l2p(state.thresholdValue) + fullLayout.margin.l;
    
    const thresholdGroup = d3.select(plotDiv).select('.threshold-group');
    if (thresholdGroup.empty()) return;
    
    thresholdGroup.select('.threshold-line')
        .attr('x1', xPos)
        .attr('x2', xPos);
    
    thresholdGroup.select('.threshold-hitbox')
        .attr('x', xPos - 10);
}

function updateCalibrationMarker() {
    // Calculate predicted and observed probabilities at threshold
    const testParams = state.testData.distParams;
    const deployParams = state.deploymentData.distParams;
    const x = state.thresholdValue;
    
    // Predicted probability from test set
    const likelihood0_test = normalPDF(x, testParams.group0.mean, testParams.group0.stdDev);
    const likelihood1_test = normalPDF(x, testParams.group1.mean, testParams.group1.stdDev);
    const prior0_test = 1 - testParams.baseRate;
    const prior1_test = testParams.baseRate;
    const denom_test = likelihood0_test * prior0_test + likelihood1_test * prior1_test;
    const pPred = denom_test > 1e-300 ? (likelihood1_test * prior1_test) / denom_test : testParams.baseRate;
    
    // Observed probability from deployment set
    const likelihood0_deploy = normalPDF(x, deployParams.group0.mean, deployParams.group0.stdDev);
    const likelihood1_deploy = normalPDF(x, deployParams.group1.mean, deployParams.group1.stdDev);
    const prior0_deploy = 1 - deployParams.baseRate;
    const prior1_deploy = deployParams.baseRate;
    const denom_deploy = likelihood0_deploy * prior0_deploy + likelihood1_deploy * prior1_deploy;
    const pObs = denom_deploy > 1e-300 ? (likelihood1_deploy * prior1_deploy) / denom_deploy : deployParams.baseRate;
    
    // Update calibration plot with marker
    const plotDiv = document.getElementById('calibration-plot');
    if (!plotDiv) return;
    
    const marker = {
        x: [pPred],
        y: [pObs],
        type: 'scatter',
        mode: 'markers',
        marker: { color: 'red', size: 10 },
        showlegend: false,
        hovertemplate: `Threshold: ${x.toFixed(2)}<br>Predicted: ${pPred.toFixed(3)}<br>Observed: ${pObs.toFixed(3)}<extra></extra>`
    };
    
    // Get existing traces
    const existingData = plotDiv.data || [];
    
    // Replace or add marker (it should be the third trace)
    if (existingData.length >= 3) {
        Plotly.update(plotDiv, {x: [[pPred]], y: [[pObs]]}, {}, [2]);
    } else {
        Plotly.addTraces(plotDiv, marker);
    }
}

// ============================================================================
// UI Update Functions
// ============================================================================

function updateMetricsDisplay() {
    const metrics = state.calibrationData.metrics;
    
    // Update each metric value
    document.getElementById('calib-brier-score').textContent = metrics.brierScore;
    document.getElementById('calib-ece').textContent = metrics.ece;
    document.getElementById('calib-slope').textContent = metrics.calibrationSlope;
    document.getElementById('calib-intercept').textContent = metrics.calibrationIntercept;
}

function updateAll() {
    // Regenerate data
    generateTestData();
    generateDeploymentData();
    
    // Fit model on test set
    fitLogisticModel();
    
    // Calculate calibration on deployment set
    calculateCalibration();
    
    // Update plots
    plotTestDistributions();
    plotDeploymentDistributions();
    plotCalibration();
    
    // Update metrics
    updateMetricsDisplay();
}

// ============================================================================
// Event Handlers
// ============================================================================

function setupEventListeners() {
    // Helper function to create slider/number pair listener
    function setupControl(sliderId, numberId, stateKey, decimalPlaces = 2) {
        const slider = document.getElementById(sliderId);
        const number = document.getElementById(numberId);
        
        if (slider && number) {
            slider.addEventListener('input', (e) => {
                state[stateKey] = parseFloat(e.target.value);
                number.value = state[stateKey].toFixed(decimalPlaces);
                updateAll();
            });
            
            number.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                if (value >= min && value <= max) {
                    state[stateKey] = value;
                    slider.value = value;
                    updateAll();
                }
            });
        }
    }
    
    // Test set controls
    setupControl('calib-test-effectsize-slider', 'calib-test-effectsize-number', 'testEffectSize', 1);
    setupControl('calib-test-icc1-slider', 'calib-test-icc1-number', 'testICC1', 2);
    setupControl('calib-test-icc2-slider', 'calib-test-icc2-number', 'testICC2', 2);
    setupControl('calib-test-kappa-slider', 'calib-test-kappa-number', 'testKappa', 2);
    setupControl('calib-test-baserate-slider', 'calib-test-baserate-number', 'testBaseRate', 3);
    
    // Deployment set controls
    setupControl('calib-deploy-effectsize-slider', 'calib-deploy-effectsize-number', 'deploymentEffectSize', 1);
    setupControl('calib-deploy-icc1-slider', 'calib-deploy-icc1-number', 'deploymentICC1', 2);
    setupControl('calib-deploy-icc2-slider', 'calib-deploy-icc2-number', 'deploymentICC2', 2);
    setupControl('calib-deploy-kappa-slider', 'calib-deploy-kappa-number', 'deploymentKappa', 2);
    setupControl('calib-deploy-baserate-slider', 'calib-deploy-baserate-number', 'deploymentBaseRate', 3);
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
    // Initialize data
    generateTestData();
    generateDeploymentData();
    fitLogisticModel();
    calculateCalibration();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initial plots
    plotTestDistributions();
    plotDeploymentDistributions();
    plotCalibration();
    updateMetricsDisplay();
    
    console.log("Calibration module initialized");
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM is already ready, initialize immediately
    init();
}

})();

