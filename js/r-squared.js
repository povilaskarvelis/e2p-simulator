// Multivariate R² Calculator
function initializeR2Calculator() {
    // Initialize the chart
    let r2Chart = null;
    let datasets = [];
    let activeCurve = null;
    let nextColorIndex = 0;
    
    // Store initial values
    const initialValues = {
        neededR2: 0.6,
        predictorCorrelation: 0.2,
        collinearity: 0.1,
        numPredictors: 20
    };
    
    // Define colors similar to Mahalanobis calculator
    const colors = [
        '#008080', // Teal (primary)
        '#E63946', // Bright Red
        '#1E88E5', // Bright Blue
        '#FFA726', // Bright Orange
        '#9C27B0', // Bright Purple
        '#00A896', // Bright Teal
        '#26A69A', // Medium Teal
        '#7B1FA2'  // Deep Purple
    ];
    
    // Get DOM elements
    const neededR2Input = document.getElementById('needed-r2');
    const predictorCorrelationInput = document.getElementById('predictor-correlation');
    const predictorCorrelationSlider = document.getElementById('predictor-correlation-slider');
    const collinearityInput = document.getElementById('collinearity');
    const collinearitySlider = document.getElementById('collinearity-slider');
    const numPredictorsInput = document.getElementById('num-predictors-r2');
    const numPredictorsSlider = document.getElementById('num-predictors-r2-slider');
    const recordButton = document.getElementById('record-r2');
    const resetButton = document.getElementById('reset-r2');
    
    // Add event listeners
    // Sync sliders with inputs
    function syncInputAndSlider(input, slider, updateFn) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            updateFn();
        });
        
        input.addEventListener('input', () => {
            slider.value = input.value;
            updateFn();
        });
    }
    
    syncInputAndSlider(predictorCorrelationInput, predictorCorrelationSlider, updateR2Plot);
    syncInputAndSlider(collinearityInput, collinearitySlider, updateR2Plot);
    syncInputAndSlider(numPredictorsInput, numPredictorsSlider, updateR2Plot);
    
    neededR2Input.addEventListener('input', updateR2Plot);
    recordButton.addEventListener('click', recordR2Curve);
    resetButton.addEventListener('click', resetCalculator);
    
    // Initialize the chart when the calculator loads
    initializeR2Chart();
    
    // Function to calculate multivariate R²
    function calculateMultivariateR2(p, predictorCorrelation, collinearity) {
        // p = number of predictors
        // predictorCorrelation = correlation of each predictor (r)
        // collinearity = correlation between predictors (r_ij)
        
        // Calculate R² using the formula: R² = (pr²)/(1+(p-1)r_ij)
        const numerator = p * predictorCorrelation * predictorCorrelation;
        const denominator = 1 + (p - 1) * collinearity;
        
        const r2 = numerator / denominator;
        
        return Math.min(r2, 1.0); // Cap at 1.0
    }
    
    // Function to ensure legend container exists
    function ensureLegendContainer() {
        const chartContainer = document.getElementById('r2PlotContainer');
        let legendContainer = chartContainer.querySelector('.chart-legend');
        if (!legendContainer) {
            legendContainer = document.createElement('div');
            legendContainer.className = 'chart-legend';
            legendContainer.style.marginBottom = '10px';
            legendContainer.style.textAlign = 'center';
            chartContainer.insertBefore(legendContainer, chartContainer.firstChild);
        }
        return legendContainer;
    }
    
    // Function to get current parameter values
    function getCurrentParams() {
        return {
            neededR2: parseFloat(neededR2Input.value),
            predictorCorrelation: parseFloat(predictorCorrelationInput.value),
            collinearity: parseFloat(collinearityInput.value),
            numPredictors: parseInt(numPredictorsInput.value)
        };
    }
    
    // Function to create chart configuration
    function createChartConfig(xValues, targetR2, activeCurve) {
        return {
            type: 'line',
            data: {
                labels: xValues,
                datasets: [
                    {
                        label: `Needed R² = ${targetR2}`,
                        data: Array(xValues.length).fill(targetR2),
                        borderColor: 'black',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0
                    },
                    activeCurve
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                transitions: { active: { animation: { duration: 0 } } },
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Number of predictors',
                            font: { size: 16 }
                        },
                        ticks: { font: { size: 12 } },
                        min: 1,
                        max: xValues.length,
                        grid: { display: false }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'R² value',
                            font: { size: 16 }
                        },
                        ticks: { font: { size: 12 } },
                        min: 0,
                        max: 1,
                        grid: { display: false }
                    }
                }
            },
            plugins: [customLegendPlugin]
        };
    }
    
    // Function to initialize the R² chart
    function initializeR2Chart() {
        const ctx = document.getElementById('r2Plot').getContext('2d');
        
        // Destroy existing chart if it exists
        if (r2Chart) {
            r2Chart.destroy();
        }
        
        // Get current parameters
        const params = getCurrentParams();
        
        // Generate data for the initial plot
        const xValues = Array.from({length: params.numPredictors}, (_, i) => i + 1);
        
        // Create the active curve data
        const r2Values = xValues.map(n => 
            calculateMultivariateR2(n, params.predictorCorrelation, params.collinearity));
        
        // Create active curve
        activeCurve = {
            label: `r=${params.predictorCorrelation.toFixed(2)}, r_ij=${params.collinearity.toFixed(2)}`,
            data: r2Values,
            borderColor: colors[nextColorIndex % colors.length] + '80', // 50% opacity
            backgroundColor: `${colors[nextColorIndex % colors.length]}20`,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            fill: false,
            borderDash: [] // Solid line
        };
        
        // Ensure legend container exists
        ensureLegendContainer();
        
        // Create chart
        r2Chart = new Chart(ctx, createChartConfig(xValues, params.neededR2, activeCurve));
    }

    // Function to update the R² plot based on current parameters
    function updateR2Plot() {
        if (!r2Chart) return;
        
        // Get current parameters
        const params = getCurrentParams();
        
        // Update x-axis scale and labels
        const xValues = Array.from({length: params.numPredictors}, (_, i) => i + 1);
        r2Chart.data.labels = xValues;
        r2Chart.options.scales.x.max = params.numPredictors;
        
        // Update the target line
        r2Chart.data.datasets[0].label = `Target R² = ${params.neededR2}`;
        r2Chart.data.datasets[0].data = Array(params.numPredictors).fill(params.neededR2);
        
        // Generate data for the plot
        const r2Values = xValues.map(n => 
            calculateMultivariateR2(n, params.predictorCorrelation, params.collinearity));
        
        // Update active curve data and label
        activeCurve.data = r2Values;
        activeCurve.label = `r=${params.predictorCorrelation.toFixed(2)}, r_ij=${params.collinearity.toFixed(2)}`;
        
        // Update the chart
        r2Chart.update();
    }

    // Function to record the current R² curve
    function recordR2Curve() {
        if (!r2Chart) {
            console.error('Chart not initialized');
            return;
        }
        const params = getCurrentParams();
        
        // Create a new dataset with the current parameters
        const r2Values = Array.from({length: params.numPredictors}, (_, i) => 
            calculateMultivariateR2(i + 1, params.predictorCorrelation, params.collinearity));
        
        // Create a new dataset with a different color
        const newDataset = {
            label: `r=${params.predictorCorrelation.toFixed(2)}, r_ij=${params.collinearity.toFixed(2)}`,
            data: r2Values,
            borderColor: colors[nextColorIndex % colors.length],
            backgroundColor: `${colors[nextColorIndex % colors.length]}20`,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            fill: false
        };
        
        // Add to datasets array and increment color index
        datasets.push(newDataset);
        nextColorIndex++;
        
        // Ensure all datasets have consistent length
        const currentLabels = r2Chart.data.labels;
        datasets.forEach(dataset => {
            if (dataset.data.length < currentLabels.length) {
                // Extend dataset if needed
                while (dataset.data.length < currentLabels.length) {
                    const n = dataset.data.length + 1;
                    // Extract parameters from label
                    const labelMatch = dataset.label.match(/r=([\d\.]+), r_ij=([\d\.]+)/);
                    if (labelMatch) {
                        const r = parseFloat(labelMatch[1]);
                        const rij = parseFloat(labelMatch[2]);
                        dataset.data.push(calculateMultivariateR2(n, r, rij));
                    }
                }
            } else if (dataset.data.length > currentLabels.length) {
                // Trim dataset if needed
                dataset.data = dataset.data.slice(0, currentLabels.length);
            }
        });
        
        // Update chart datasets (keep target line first, then recorded datasets, then active curve)
        r2Chart.data.datasets = [
            r2Chart.data.datasets[0], // Target line
            ...datasets, // All recorded datasets
            activeCurve // Current active curve
        ];
        
        // Update the chart
        r2Chart.update();
        
        // Update the active curve to use the next color (with transparency)
        activeCurve.borderColor = colors[nextColorIndex % colors.length] + '80'; // 50% opacity
        r2Chart.update();
    }
    
    // Function to reset the calculator
    function resetCalculator() {
        // Clear all datasets
        datasets = [];
        nextColorIndex = 0;
        
        // Reset all inputs to initial values
        neededR2Input.value = initialValues.neededR2;
        predictorCorrelationInput.value = initialValues.predictorCorrelation;
        predictorCorrelationSlider.value = initialValues.predictorCorrelation;
        collinearityInput.value = initialValues.collinearity;
        collinearitySlider.value = initialValues.collinearity;
        numPredictorsInput.value = initialValues.numPredictors;
        numPredictorsSlider.value = initialValues.numPredictors;
        
        // Reset chart and update plot
        initializeR2Chart();
    }
}

// Initialize the R² calculator when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeR2Calculator();
}); 