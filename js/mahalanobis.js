(function() {
// Global variables to track datasets and colors
    let rocaucDatasets = [], prAucDatasets = [];
const colors = [
        '#008080', '#E63946', '#FFA726', '#1E88E5', 
        '#9C27B0', '#00A896', '#26A69A', '#7B1FA2'
    ];
    let nextColorIndex = 0;

    // Track active curves and chart instances
    let rocaucActiveCurve, prAucActiveCurve;
    let rocaucChart = null, prAucChart = null;

    function initializeMahalanobis() {
        const chartContainer = document.getElementById('chartContainer');
        chartContainer.style.display = 'flex';
        chartContainer.style.flexDirection = 'column';
        chartContainer.style.gap = '20px';
        
        let legendContainer = chartContainer.querySelector('.chart-legend');
        if (!legendContainer) {
            legendContainer = document.createElement('div');
            legendContainer.className = 'chart-legend';
            legendContainer.style.textAlign = 'center';
            legendContainer.style.marginTop = '10px';
            chartContainer.insertBefore(legendContainer, chartContainer.firstChild);
        }
        
        initializeRocAucChart();
        initializePrAucChart();
        setupInputListeners();
        updatePlot();
    }

    function setupInputListeners() {
        const setupInputPair = (sliderId, inputId) => {
        const slider = document.getElementById(sliderId);
        const input = document.getElementById(inputId);
            if (!slider || !input) return;
        
            const update = () => {
            input.value = slider.value;
                updatePlot();
            };
            slider.addEventListener('input', update);
        
            const inputUpdate = () => {
            slider.value = input.value;
                updatePlot();
            };
            input.addEventListener('input', inputUpdate);
        };

        ['targetRocAuc-slider', 'mahalanobis-base-rate-slider', 'effectSize-slider', 'correlation-slider', 'numVariables-slider'].forEach(id => {
            const idRoot = id.replace('-slider', '');
            setupInputPair(id, idRoot);
        });

    document.getElementById('record-mahalanobis').addEventListener('click', recordCurrentCurve);
    document.getElementById('reset-mahalanobis').addEventListener('click', resetChart);
    }

    function initializeRocAucChart() {
        if (rocaucChart) rocaucChart.destroy();
        const ctx = document.getElementById('rocAucPlot').getContext('2d');
        rocaucActiveCurve = createActiveCurveDataset();
        const thresholdValue = parseFloat(document.getElementById("targetRocAuc").value);
        rocaucChart = new Chart(ctx, createChartConfig(rocaucActiveCurve, 'ROC-AUC', 'Target ROC-AUC', false, true, thresholdValue, 0.5, 1));
    }

    function initializePrAucChart() {
        if (prAucChart) prAucChart.destroy();
        const ctx = document.getElementById('prAucPlot').getContext('2d');
        prAucActiveCurve = createActiveCurveDataset();
        
        const targetRocAuc = parseFloat(document.getElementById('targetRocAuc').value);
        const targetD = StatUtils.aucToD(targetRocAuc);
        const baseRate = percentageToFraction(document.getElementById('mahalanobis-base-rate').value);
        const thresholdValue = StatUtils.dToPRAUC(targetD, baseRate);

        prAucChart = new Chart(ctx, createChartConfig(prAucActiveCurve, 'PR-AUC', 'Target PR-AUC', true, false, thresholdValue, 0, 1));
    }

    function createChartConfig(activeCurve, yLabel, thresholdLabel, showXLabel, useLegendPlugin, thresholdValue, yMin = 0, yMax = undefined) {
        const numVariables = parseInt(document.getElementById("numVariables").value);
        const plugins = [targetLineLabelPlugin];
        if (useLegendPlugin) {
            plugins.push(window.customLegendPlugin);
        }
        const config = {
            type: 'line',
            data: {
                labels: Array.from({ length: numVariables }, (_, i) => i + 1),
                datasets: [createThresholdDataset(thresholdLabel, thresholdValue), activeCurve]
            },
            options: getChartOptions(yLabel, yMax, showXLabel, yMin),
            plugins: plugins
        };
        return config;
    }
    
    function createActiveCurveDataset() {
    const effectSize = parseFloat(document.getElementById("effectSize").value);
    const correlation = parseFloat(document.getElementById("correlation").value);
        return {
            label: `d = ${effectSize.toFixed(2)}, r<sub>ij</sub> = ${correlation.toFixed(2)}`,
            data: [],
            borderColor: colors[nextColorIndex],
            pointBackgroundColor: colors[nextColorIndex],
            borderWidth: 2,
            pointRadius: 5,
            pointStyle: 'circle',
            fill: false,
            isActive: true
        };
    }

    function createThresholdDataset(label, value) {
        const numVariables = parseInt(document.getElementById("numVariables").value);
        return {
            label: '',
            annotationLabel: label,
            data: Array(numVariables).fill(value),
        borderColor: '#000000',
        borderWidth: 3,
        borderDash: [8, 8],
        pointRadius: 0,
        fill: false
    };
    }

    function getChartOptions(yLabel, yMax, showXLabel = true, yMin = 0) {
    const yTicksConfig = {
        font: { size: 14 }
    };

    if (yLabel === 'PR-AUC') {
        yTicksConfig.stepSize = 0.2;
    } else if (yLabel === 'ROC-AUC') {
        yTicksConfig.stepSize = 0.1;
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
                    title: function(tooltipItems) {
                        if (tooltipItems.length > 0) {
                            const item = tooltipItems[0];
                            if (item.dataset.annotationLabel) return ''; // No title for target line
                            return `Predictors: ${item.label}`;
                        }
                        return '';
                    },
                    label: function(context) {
                        if (context.dataset.annotationLabel) return null; // No label for target line
                        return `${yLabel}: ${context.formattedValue}`;
                    }
                }
            }
        },
        scales: {
            x: {
                min: 1,
                max: parseInt(document.getElementById("numVariables").value),
                title: { display: showXLabel, text: 'Number of predictors', font: { size: 18 } },
                ticks: xTicksConfig,
                grid: { display: false, drawBorder: false }
            },
            y: {
                min: yMin,
                max: yMax,
                title: { display: true, text: yLabel, font: { size: 18 } },
                ticks: yTicksConfig,
                grid: { display: false, drawBorder: false }
            }
        }
    };
}

    function updatePlot() {
        if (!rocaucActiveCurve) return;

        const targetRocAuc = parseFloat(document.getElementById('targetRocAuc').value);
        const targetD = StatUtils.aucToD(targetRocAuc);
        const baseRate = percentageToFraction(document.getElementById('mahalanobis-base-rate').value);
        const effectSize = parseFloat(document.getElementById('effectSize').value);
        const correlation = parseFloat(document.getElementById('correlation').value);
        const numVariables = parseInt(document.getElementById('numVariables').value);

        document.getElementById('target-pr-auc').value = StatUtils.dToPRAUC(targetD, baseRate).toFixed(2);
        
        let rocaucValues = [], prAucValues = [];
        for (let i = 1; i <= numVariables; i++) {
            const d = computeMahalanobisD(i, effectSize, correlation);
            rocaucValues.push(StatUtils.dToAUC(d));
            prAucValues.push(StatUtils.dToPRAUC(d, baseRate));
        }

        updateChart(rocaucChart, rocaucValues, targetRocAuc, 'Target ROC-AUC', numVariables, 0.5, 1);
        updateChart(prAucChart, prAucValues, StatUtils.dToPRAUC(targetD, baseRate), 'Target PR-AUC', numVariables, 0, 1);
        updateActiveCurveLabel();
    }
    
    function updateChart(chart, data, threshold, thresholdLabel, numVariables, yMin = 0, yMax = undefined) {
    chart.data.labels = Array.from({ length: numVariables }, (_, i) => i + 1);
    chart.options.scales.x.max = numVariables;
    
    const activeCurve = chart.data.datasets[chart.data.datasets.length - 1];
    activeCurve.data = data;
    
    const thresholdDataset = chart.data.datasets[0];
    thresholdDataset.data = Array(numVariables).fill(threshold);
    thresholdDataset.annotationLabel = `${thresholdLabel}: ${threshold.toFixed(2)}`;
    
    if(yMax === undefined) yMax = threshold * 1.3;
    chart.options.scales.y.max = yMax;
    chart.options.scales.y.min = yMin;
    
    chart.update();
}

    const maxCurves = 4;

    function recordCurrentCurve() {
        if (rocaucDatasets.length >= maxCurves) return;

        const { targetRocAuc, baseRate, effectSize, correlation, numVariables } = getInputs();
        
        let rocaucValues = [], prAucValues = [];
        for (let i = 1; i <= numVariables; i++) {
            const d = computeMahalanobisD(i, effectSize, correlation);
            rocaucValues.push(StatUtils.dToAUC(d));
            prAucValues.push(StatUtils.dToPRAUC(d, baseRate));
        }

        addDataset(rocaucChart, rocaucDatasets, rocaucValues, effectSize, correlation, colors[nextColorIndex]);
        addDataset(prAucChart, prAucDatasets, prAucValues, effectSize, correlation, colors[nextColorIndex]);

        nextColorIndex = (nextColorIndex + 1) % colors.length;
        
        if (rocaucDatasets.length < maxCurves) {
            updateActiveCurveColor();
            updateActiveCurveLabel();
        } else {
            rocaucChart.data.datasets.pop();
            prAucChart.data.datasets.pop();
            rocaucActiveCurve = null;
            prAucActiveCurve = null;
            rocaucChart.update();
            prAucChart.update();
            document.getElementById('record-mahalanobis').disabled = true;
        }
    }

    function addDataset(chart, datasets, data, effectSize, correlation, color) {
    const newDataset = {
        label: `d = ${effectSize.toFixed(2)}, r<sub>ij</sub> = ${correlation.toFixed(2)}`,
            data: data,
        borderColor: color,
        pointBackgroundColor: color,
        borderWidth: 2,
        pointRadius: 5,
        pointStyle: 'circle',
        fill: false,
        isActive: false
    };
    datasets.push(newDataset);
        chart.data.datasets = [chart.data.datasets[0], ...datasets, chart.data.datasets[chart.data.datasets.length - 1]];
        chart.update();
}

function resetChart() {
        rocaucDatasets = [];
        prAucDatasets = [];
    nextColorIndex = 0;
    
        rocaucActiveCurve = createActiveCurveDataset();
        prAucActiveCurve = createActiveCurveDataset();
        rocaucChart.data.datasets = [rocaucChart.data.datasets[0], rocaucActiveCurve];
        prAucChart.data.datasets = [prAucChart.data.datasets[0], prAucActiveCurve];
        
        document.getElementById('record-mahalanobis').disabled = false;
        
        updateActiveCurveColor();
        updatePlot();
    }

    function updateActiveCurveColor() {
        const solidColor = colors[nextColorIndex];
        rocaucActiveCurve.borderColor = solidColor;
        rocaucActiveCurve.pointBackgroundColor = solidColor;
        prAucActiveCurve.borderColor = solidColor;
        prAucActiveCurve.pointBackgroundColor = solidColor;
        rocaucChart.update();
        prAucChart.update();
    }
    
    function getInputs() {
        return {
            targetRocAuc: parseFloat(document.getElementById('targetRocAuc').value),
            baseRate: percentageToFraction(document.getElementById('mahalanobis-base-rate').value),
            effectSize: parseFloat(document.getElementById('effectSize').value),
            correlation: parseFloat(document.getElementById('correlation').value),
            numVariables: parseInt(document.getElementById('numVariables').value)
        };
    }
    
    function updateActiveCurveLabel() {
        if (!rocaucActiveCurve) return;

        const { effectSize, correlation } = getInputs();
        const label = `d = ${effectSize.toFixed(2)}, r<sub>ij</sub> = ${correlation.toFixed(2)}`;
        rocaucActiveCurve.label = label;
        prAucActiveCurve.label = label;
    rocaucChart.update();
        prAucChart.update();
}

function computeMahalanobisD(numVariables, effectSize, correlation) {
    return effectSize * Math.sqrt(numVariables / (1 + (numVariables-1) * correlation));
}

window.initializeMahalanobis = initializeMahalanobis;
})();