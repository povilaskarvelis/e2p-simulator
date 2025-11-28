(function() {
    // --- State variables ---
    let r2Chart = null, prAucChart = null;
    let r2Datasets = [], prAucDatasets = [];
    let r2ActiveCurve, prAucActiveCurve;
    let nextColorIndex = 0;
    
    const colors = ['#008080', '#E63946', '#FFA726', '#1E88E5', '#9C27B0', '#00A896', '#26A69A', '#7B1FA2'];

    const initialValues = {
        targetR2: 0.8,
        baseRate: 15, // Stored as percentage for UI controls
        predictorCorrelation: 0.25,
        collinearity: 0.05,
        numPredictors: 20
    };

    // --- DOM element retrieval ---
    const getDOMElements = () => ({
        targetR2Input: document.getElementById('target-r2'),
        targetR2Slider: document.getElementById('target-r2-slider'),
        r2BaseRateInput: document.getElementById('r2-base-rate'),
        r2BaseRateSlider: document.getElementById('r2-base-rate-slider'),
        predictorCorrelationInput: document.getElementById('predictor-correlation'),
        predictorCorrelationSlider: document.getElementById('predictor-correlation-slider'),
        collinearityInput: document.getElementById('collinearity'),
        collinearitySlider: document.getElementById('collinearity-slider'),
        numPredictorsInput: document.getElementById('num-predictors-r2'),
        numPredictorsSlider: document.getElementById('num-predictors-r2-slider'),
        recordButton: document.getElementById('record-r2'),
        resetButton: document.getElementById('reset-r2')
    });

    // --- Main Initialization ---
    function initializeR2Calculator() {
        const elements = getDOMElements();
        setupEventListeners(elements);
        
        const chartContainer = document.getElementById('r2PlotContainer');
        chartContainer.style.display = 'flex';
        chartContainer.style.flexDirection = 'column';
        chartContainer.style.gap = '20px';
        
        ensureLegendContainer(chartContainer);

        initializeR2Chart(elements);
        initializePrAucChart(elements);
        
        updatePlots();
    }

    // --- Event Listeners ---
    function setupEventListeners(elements) {
        const inputs = [
            { input: elements.targetR2Input, slider: elements.targetR2Slider },
            { input: elements.r2BaseRateInput, slider: elements.r2BaseRateSlider },
            { input: elements.predictorCorrelationInput, slider: elements.predictorCorrelationSlider },
            { input: elements.collinearityInput, slider: elements.collinearitySlider },
            { input: elements.numPredictorsInput, slider: elements.numPredictorsSlider }
        ];

        inputs.forEach(({ input, slider }) => {
            slider.addEventListener('input', () => {
                input.value = slider.value;
                updatePlots();
            });
            input.addEventListener('input', () => {
                slider.value = input.value;
                updatePlots();
            });
        });

        elements.recordButton.addEventListener('click', recordCurrentCurve);
        elements.resetButton.addEventListener('click', resetCalculator);
    }

    // --- Chart Initialization ---
    function initializeR2Chart() {
        if (r2Chart) r2Chart.destroy();
        const ctx = document.getElementById('r2Plot').getContext('2d');
        r2ActiveCurve = createActiveCurveDataset();
        r2Chart = new Chart(ctx, createChartConfig(r2ActiveCurve, 'R²', 1, false, true));
    }
    
    function initializePrAucChart() {
        if (prAucChart) prAucChart.destroy();
        const ctx = document.getElementById('r2PrAucPlot').getContext('2d');
        prAucActiveCurve = createActiveCurveDataset();
        prAucChart = new Chart(ctx, createChartConfig(prAucActiveCurve, 'PR-AUC', 1, true, false));
    }

    // --- Chart Configuration ---
    function createChartConfig(activeCurve, yLabel, yMax, showXLabel, useLegendPlugin) {
        const { numPredictors } = getInputs();
        const xValues = Array.from({ length: numPredictors }, (_, i) => i + 1);

        const plugins = [window.targetLineLabelPlugin];
        if (useLegendPlugin) {
            plugins.push(window.customLegendPlugin);
        }

        const config = {
            type: 'line',
            data: {
                labels: xValues,
                datasets: [createThresholdDataset(), activeCurve]
            },
            options: getChartOptions(yLabel, yMax, showXLabel),
            plugins: plugins
        };
        
        return config;
    }

    function getChartOptions(yLabel, yMax, showXLabel) {
        const yTicksConfig = { font: { size: 14 } };
        if (yLabel === 'PR-AUC') {
            yTicksConfig.stepSize = 0.2;
        }

        const xTicksConfig = { font: { size: 14 } };
        if (!showXLabel) {
            xTicksConfig.display = false;
        }

        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => `Predictors: ${tooltipItems[0].label}`,
                        label: (context) => `${yLabel}: ${context.formattedValue}`
                    }
                }
            },
            scales: {
                x: {
                    min: 1,
                    max: getInputs().numPredictors,
                    title: { display: showXLabel, text: 'Number of predictors', font: { size: 18 } },
                    ticks: xTicksConfig,
                    grid: { display: false }
                },
                y: {
                    min: 0,
                    max: yMax,
                    title: { display: true, text: yLabel, font: { size: 18 } },
                    ticks: yTicksConfig,
                    grid: { display: false }
                }
            }
        };
    }

    // --- Dataset Creation ---
    function createActiveCurveDataset() {
        const { predictorCorrelation, collinearity } = getInputs();
        return {
            label: `r = ${predictorCorrelation.toFixed(2)}, r<sub>ij</sub> = ${collinearity.toFixed(2)}`,
            data: [],
            borderColor: colors[nextColorIndex],
            pointBackgroundColor: colors[nextColorIndex],
            borderWidth: 2,
            pointRadius: 5,
            fill: false,
            isActive: true
        };
    }

    function createThresholdDataset() {
        return {
            label: '',
            annotationLabel: '',
            data: [],
            borderColor: '#000000',
            borderWidth: 3,
            borderDash: [8, 8],
            pointRadius: 0,
            fill: false
        };
    }

    // --- Plot Update Logic ---
    function updatePlots() {
        if (!r2ActiveCurve) return;

        const { targetR2, baseRate, predictorCorrelation, collinearity, numPredictors } = getInputs();
        
        // Update PR-AUC input field
        const r = Math.sqrt(targetR2);
        const targetPrAuc = StatUtils.rToPRAUCviaSimulation(r, baseRate);
        document.getElementById('r2-target-pr-auc').value = targetPrAuc.toFixed(2);
        
        // Generate data
        const xValues = Array.from({ length: numPredictors }, (_, i) => i + 1);
        const r2Values = xValues.map(p => calculateMultivariateR2(p, predictorCorrelation, collinearity));
        const prAucValues = r2Values.map(r2 => StatUtils.rToPRAUCviaSimulation(Math.sqrt(r2), baseRate));
        
        // Update charts
        updateChart(r2Chart, xValues, r2Values, targetR2, `Target R²: ${targetR2.toFixed(2)}`);
        updateChart(prAucChart, xValues, prAucValues, targetPrAuc, `Target PR-AUC: ${targetPrAuc.toFixed(2)}`);
        
        updateActiveCurveLabel();
    }

    function updateChart(chart, xValues, yValues, threshold, thresholdLabel) {
        chart.data.labels = xValues;
        chart.options.scales.x.max = xValues.length;
        
        const thresholdDataset = chart.data.datasets[0];
        thresholdDataset.data = Array(xValues.length).fill(threshold);
        thresholdDataset.annotationLabel = thresholdLabel;

        const activeCurve = chart.data.datasets[chart.data.datasets.length - 1];
        activeCurve.data = yValues;

        chart.update();
    }
    
    function updateActiveCurveLabel() {
        if (!r2ActiveCurve) return;

        const { predictorCorrelation, collinearity } = getInputs();
        const label = `r = ${predictorCorrelation.toFixed(2)}, r<sub>ij</sub> = ${collinearity.toFixed(2)}`;
        r2ActiveCurve.label = label;
        prAucActiveCurve.label = label;
        r2Chart.update();
        prAucChart.update();
    }

    // --- Curve Recording and Resetting ---
    const maxCurves = 4;

    function recordCurrentCurve() {
        if (r2Datasets.length >= maxCurves) return;

        const { baseRate, predictorCorrelation, collinearity, numPredictors } = getInputs();
        const xValues = Array.from({ length: numPredictors }, (_, i) => i + 1);

        const r2Values = xValues.map(p => calculateMultivariateR2(p, predictorCorrelation, collinearity));
        const prAucValues = r2Values.map(r2 => StatUtils.rToPRAUCviaSimulation(Math.sqrt(r2), baseRate));
        
        addDataset(r2Chart, r2Datasets, r2Values, predictorCorrelation, collinearity);
        addDataset(prAucChart, prAucDatasets, prAucValues, predictorCorrelation, collinearity);

        nextColorIndex = (nextColorIndex + 1) % colors.length;
        
        if (r2Datasets.length < maxCurves) {
            updateActiveCurveColor();
            updateActiveCurveLabel();
        } else {
            r2Chart.data.datasets.pop();
            prAucChart.data.datasets.pop();
            r2ActiveCurve = null;
            prAucActiveCurve = null;
            r2Chart.update();
            prAucChart.update();
            getDOMElements().recordButton.disabled = true;
        }
    }

    function addDataset(chart, datasets, data, predictorCorrelation, collinearity) {
        const newDataset = {
            label: `r = ${predictorCorrelation.toFixed(2)}, r<sub>ij</sub> = ${collinearity.toFixed(2)}`,
            data: data,
            borderColor: colors[nextColorIndex],
            pointBackgroundColor: colors[nextColorIndex],
            borderWidth: 2,
            pointRadius: 5,
            fill: false,
            isActive: false
        };
        datasets.push(newDataset);
        chart.data.datasets = [chart.data.datasets[0], ...datasets, chart.data.datasets[chart.data.datasets.length - 1]];
        chart.update();
    }
    
    function resetCalculator() {
        r2Datasets = [];
        prAucDatasets = [];
        nextColorIndex = 0;

        const elements = getDOMElements();
        elements.targetR2Input.value = initialValues.targetR2;
        elements.targetR2Slider.value = initialValues.targetR2;
        elements.r2BaseRateInput.value = initialValues.baseRate;
        elements.r2BaseRateSlider.value = initialValues.baseRate;
        elements.predictorCorrelationInput.value = initialValues.predictorCorrelation;
        elements.predictorCorrelationSlider.value = initialValues.predictorCorrelation;
        elements.collinearityInput.value = initialValues.collinearity;
        elements.collinearitySlider.value = initialValues.collinearity;
        elements.numPredictorsInput.value = initialValues.numPredictors;
        elements.numPredictorsSlider.value = initialValues.numPredictors;
        
        r2ActiveCurve = createActiveCurveDataset();
        prAucActiveCurve = createActiveCurveDataset();
        r2Chart.data.datasets = [r2Chart.data.datasets[0], r2ActiveCurve];
        prAucChart.data.datasets = [prAucChart.data.datasets[0], prAucActiveCurve];
        
        elements.recordButton.disabled = false;

        updateActiveCurveColor();
        updatePlots();
    }
    
    function updateActiveCurveColor() {
        const solidColor = colors[nextColorIndex];
        r2ActiveCurve.borderColor = solidColor;
        r2ActiveCurve.pointBackgroundColor = solidColor;
        prAucActiveCurve.borderColor = solidColor;
        prAucActiveCurve.pointBackgroundColor = solidColor;
        r2Chart.update();
        prAucChart.update();
    }
    
    // --- Helper Functions ---
    function getInputs() {
        const elements = getDOMElements();
        return {
            targetR2: parseFloat(elements.targetR2Input.value),
            baseRate: percentageToFraction(elements.r2BaseRateInput.value),
            predictorCorrelation: parseFloat(elements.predictorCorrelationInput.value),
            collinearity: parseFloat(elements.collinearityInput.value),
            numPredictors: parseInt(elements.numPredictorsInput.value)
        };
    }
    
    function calculateMultivariateR2(p, r, rij) {
        const numerator = p * r * r;
        const denominator = 1 + (p - 1) * rij;
        return Math.min(numerator / denominator, 1.0);
    }

    function ensureLegendContainer(chartContainer) {
        let legendContainer = chartContainer.querySelector('.chart-legend');
        if (!legendContainer) {
            legendContainer = document.createElement('div');
            legendContainer.className = 'chart-legend';
            chartContainer.insertBefore(legendContainer, chartContainer.firstChild);
        }
    }

    // --- Export ---
    window.initializeR2Calculator = initializeR2Calculator;
    document.addEventListener('DOMContentLoaded', initializeR2Calculator);
})();