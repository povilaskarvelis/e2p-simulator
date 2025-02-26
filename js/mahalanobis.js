// Change to module-specific names to avoid conflict
const mahalanobisWidth = 600;
const mahalanobisHeight = 400;
const mahalanobisMargin = { top: 20, right: 30, bottom: 40, left: 50 };

// Clinical utility threshold (can be made adjustable later)
const CLINICAL_UTILITY_THRESHOLD = 2.5;

// Global variables to track datasets and colors
let datasets = [];
const colors = [
    '#008080', // Teal (keep this as primary)
    '#E63946', // Bright Red
    '#1E88E5', // Bright Blue
    '#FFA726', // Bright Orange
    '#9C27B0', // Bright Purple
    '#00A896', // Bright Teal
    '#26A69A', // Medium Teal
    '#7B1FA2'  // Deep Purple
];

// Track active curve and datasets
let activeCurve = null;
let dChart = null;
let nextColorIndex = 0; // Track which color to use next

function initializeMahalanobisPlot() {
    // Create SVG container
    const svg = d3.select("#mahalanobis-plot")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${mahalanobisWidth} ${mahalanobisHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Add axes
    const xScale = d3.scaleLinear()
        .domain([0, 10])  // Number of features
        .range([mahalanobisMargin.left, mahalanobisWidth - mahalanobisMargin.right]);

    const yScale = d3.scaleLinear()
        .domain([0, 5])   // Mahalanobis distance
        .range([mahalanobisHeight - mahalanobisMargin.bottom, mahalanobisMargin.top]);

    // Add X axis
    svg.append("g")
        .attr("transform", `translate(0,${mahalanobisHeight - mahalanobisMargin.bottom})`)
        .call(d3.axisBottom(xScale))
        .append("text")
        .attr("x", mahalanobisWidth / 2)
        .attr("y", 35)
        .attr("fill", "black")
        .text("Number of Features");

    // Add Y axis
    svg.append("g")
        .attr("transform", `translate(${mahalanobisMargin.left},0)`)
        .call(d3.axisLeft(yScale))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -35)
        .attr("x", -(mahalanobisHeight / 2))
        .attr("fill", "black")
        .text("Combined Effect Size (Mahalanobis D)");

    // Add clinical utility threshold line
    svg.append("line")
        .attr("class", "threshold-line")
        .attr("x1", mahalanobisMargin.left)
        .attr("x2", mahalanobisWidth - mahalanobisMargin.right)
        .attr("y1", yScale(CLINICAL_UTILITY_THRESHOLD))
        .attr("y2", yScale(CLINICAL_UTILITY_THRESHOLD))
        .style("stroke", "red")
        .style("stroke-dasharray", "4,4");

    // Add threshold label
    svg.append("text")
        .attr("class", "threshold-label")
        .attr("x", mahalanobisWidth - mahalanobisMargin.right)
        .attr("y", yScale(CLINICAL_UTILITY_THRESHOLD) - 5)
        .attr("text-anchor", "end")
        .style("fill", "red")
        .text("Clinical Utility Threshold");

    return { svg, xScale, yScale };
}

function updateMahalanobisPlot(features, plotElements) {
    const { svg, xScale, yScale } = plotElements;

    // Calculate cumulative Mahalanobis distance at each step
    const cumulativeD = features.reduce((acc, d) => {
        const lastD = acc.length > 0 ? acc[acc.length - 1] : 0;
        acc.push(Math.sqrt(d * d + lastD * lastD));
        return acc;
    }, []);

    // Create line generator
    const line = d3.line()
        .x((d, i) => xScale(i + 1))
        .y(d => yScale(d));

    // Update or create path
    const path = svg.selectAll(".mahalanobis-line")
        .data([cumulativeD]);

    path.enter()
        .append("path")
        .attr("class", "mahalanobis-line")
        .merge(path)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2);

    // Update or create points
    const points = svg.selectAll(".feature-point")
        .data(cumulativeD);

    points.enter()
        .append("circle")
        .attr("class", "feature-point")
        .merge(points)
        .attr("cx", (d, i) => xScale(i + 1))
        .attr("cy", d => yScale(d))
        .attr("r", 5)
        .attr("fill", "steelblue");

    points.exit().remove();

    // Update required features text
    const featuresNeeded = Math.ceil(
        (CLINICAL_UTILITY_THRESHOLD * CLINICAL_UTILITY_THRESHOLD) / 
        (features[0] * features[0])
    );

    d3.select("#features-needed")
        .text(featuresNeeded);

    d3.select("#mahalanobis-d")
        .text(cumulativeD[cumulativeD.length - 1].toFixed(2));
}

// Initialize with current effect size when binary version loads
function initializeMahalanobisSection() {
    const plotElements = initializeMahalanobisPlot();
    const currentD = parseFloat(document.getElementById("true-difference-number-bin").value);
    updateMahalanobisPlot([currentD], plotElements);
    return plotElements;
}

// Export for use in main.js
window.initializeMahalanobisSection = initializeMahalanobisSection;
window.updateMahalanobisPlot = updateMahalanobisPlot;

function initializeMahalanobis() {
    // Initialize the chart
    initializeChart();

    // Set up event listeners
    const setupInputPair = (sliderId, inputId, callback = updatePlot) => {
        const slider = document.getElementById(sliderId);
        const input = document.getElementById(inputId);
        
        slider.addEventListener('input', () => {
            input.value = slider.value;
            callback();
        });
        
        input.addEventListener('input', () => {
            slider.value = input.value;
            callback();
        });
    };
    
    setupInputPair('effectSize-slider', 'effectSize');
    setupInputPair('correlation-slider', 'correlation');
    setupInputPair('numVariables-slider', 'numVariables');
    
    // Record button saves the current curve
    document.getElementById('record-mahalanobis').addEventListener('click', recordCurrentCurve);
    document.getElementById('reset-mahalanobis').addEventListener('click', resetChart);
    document.getElementById('neededD').addEventListener('input', updatePlot);

    // Initial plot
    updatePlot();
}

function updatePlot() {
    // Get inputs
    const neededD = parseFloat(document.getElementById('neededD').value);
    const effectSize = parseFloat(document.getElementById('effectSize').value);
    const correlation = parseFloat(document.getElementById('correlation').value);
    const numVariables = parseInt(document.getElementById('numVariables').value);
    
    // Calculate formula
    let xValues = [];
    let yValues = [];
    
    for (let i = 1; i <= numVariables; i++) {
        xValues.push(i);
        const d = computeMahalanobisD(i, effectSize, correlation);
        yValues.push(d);
    }
    
    // Update x-axis scale to match the number of predictors
    dChart.options.scales.x.max = numVariables;
    dChart.data.labels = Array.from({ length: numVariables }, (_, i) => i + 1);
    
    // Update active curve without recording
    updateActiveCurve(xValues, yValues);
    
    // Update the label with current parameters
    updateActiveCurveLabel();
}

function recordCurrentCurve() {
    // Get inputs
    const neededD = parseFloat(document.getElementById('neededD').value);
    const effectSize = parseFloat(document.getElementById('effectSize').value);
    const correlation = parseFloat(document.getElementById('correlation').value);
    const numVariables = parseInt(document.getElementById('numVariables').value);
    
    // Calculate formula
    let xValues = [];
    let yValues = [];
    
    for (let i = 1; i <= numVariables; i++) {
        xValues.push(i);
        const d = computeMahalanobisD(i, effectSize, correlation);
        yValues.push(d);
    }
    
    // Record the dataset
    addDataset(xValues, yValues, neededD, effectSize, correlation, colors[nextColorIndex]);
    
    // Update color index for next curve
    nextColorIndex = (nextColorIndex + 1) % colors.length;
    
    // Update active curve color to match the next color it will be saved as
    activeCurve.borderColor = `${colors[nextColorIndex]}80`; // Add 50% transparency
    dChart.update();
}

function initializeChart() {
    // Reset datasets when initializing
    datasets = [];
    nextColorIndex = 0;
    
    // Destroy any existing chart instance
    if (dChart) {
        dChart.destroy();
        dChart = null;
    }
    
    // Set up initial chart with just the threshold line
    const neededD = parseFloat(document.getElementById("neededD").value);
    const numVariables = parseInt(document.getElementById("numVariables").value);
    const ctx = document.getElementById('dPlot').getContext('2d');
    
    // Get initial parameter values
    const effectSize = parseFloat(document.getElementById("effectSize").value);
    const correlation = parseFloat(document.getElementById("correlation").value);
    
    // Create a threshold dataset
    const thresholdDataset = {
        label: `Needed D = ${neededD}`,
        data: Array(numVariables).fill(neededD),
        borderColor: '#000000',
        borderWidth: 3,
        borderDash: [8, 8],
        pointRadius: 0,
        fill: false
    };
    
    // Create an active curve dataset with parameters in the label
    activeCurve = {
        label: `d = ${effectSize.toFixed(2)}, r = ${correlation.toFixed(2)}`,
        data: [],
        borderColor: `${colors[nextColorIndex]}80`, // Add 50% transparency with hex alpha
        borderWidth: 3,
        pointRadius: 5,
        pointStyle: 'circle',
        fill: false
    };
    
    // Initialize chart with threshold first, then active curve
    dChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: numVariables }, (_, i) => i + 1),
            datasets: [thresholdDataset, activeCurve]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: false // Hide the default legend
                }
            },
            scales: {
                x: {
                    min: 1,
                    max: numVariables,
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Number of predictors',
                        font: { size: 16 }
                    },
                    ticks: { font: { size: 12 } }
                },
                y: {
                    min: 0,
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Mahalanobis D',
                        font: { size: 16 }
                    },
                    ticks: { 
                        font: { size: 12 },
                        callback: function(value, index, values) {
                            if (index === values.length - 1) {
                                return '';
                            }
                            return value;
                        }
                    }
                }
            }
        },
        plugins: [window.customLegendPlugin]
    });
    
    // Create a container for our custom legend
    const chartContainer = document.getElementById('chartContainer');
    
    // Check if legend container already exists
    let legendContainer = chartContainer.querySelector('.chart-legend');
    if (!legendContainer) {
        // Only create a new legend container if one doesn't exist
        legendContainer = document.createElement('div');
        legendContainer.className = 'chart-legend';
        legendContainer.style.textAlign = 'center';
        legendContainer.style.marginTop = '10px';
        chartContainer.insertBefore(legendContainer, chartContainer.firstChild);
    }
}

function updateActiveCurve(xValues, yValues) {
    // Update the active curve data
    activeCurve.data = yValues;
    
    // Update the needed D threshold
    const neededD = parseFloat(document.getElementById("neededD").value);
    const numVariables = parseInt(document.getElementById('numVariables').value);
    
    const thresholdDataset = dChart.data.datasets.find(ds => ds.label.startsWith('Needed D'));
    thresholdDataset.data = Array(numVariables).fill(neededD);
    thresholdDataset.label = `Needed D = ${neededD}`;
    
    // Update chart
    dChart.update();
}

function addDataset(xValues, yValues, neededD, effectSize, correlation, color) {
    // Create a new dataset with the current parameters
    const newDataset = {
        label: `d = ${effectSize.toFixed(2)}, r = ${correlation.toFixed(2)}`,
        data: yValues,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 5,
        pointStyle: 'circle',
        fill: false
    };
    
    // Add the new dataset to our collection
    datasets.push(newDataset);
    
    // Get the threshold dataset (first one)
    const thresholdDataset = dChart.data.datasets[0];
    
    // Rebuild the datasets array with threshold first, then saved datasets, then active curve
    dChart.data.datasets = [
        thresholdDataset,
        ...datasets,
        activeCurve
    ];
    
    // Update chart
    dChart.update();
}

function resetChart() {
    // Clear all datasets except active curve and threshold
    datasets = [];
    nextColorIndex = 0;
    
    // Update active curve color
    activeCurve.borderColor = `${colors[nextColorIndex]}80`;
    
    // Reset the chart
    const neededD = parseFloat(document.getElementById("neededD").value);
    const numVariables = parseInt(document.getElementById("numVariables").value);
    
    // Keep only the threshold and active curve in that order
    dChart.data.datasets = [
        {
            label: `Needed D = ${neededD}`,
            data: Array(numVariables).fill(neededD),
            borderColor: '#000000',
            borderWidth: 3,
            borderDash: [8, 8],
            pointRadius: 0,
            fill: false
        },
        activeCurve
    ];
    
    // Update chart
    dChart.update();
}

// Use simplified formula for when all predictors have same effect size and correlations
function computeMahalanobisD(numVariables, effectSize, correlation) {
    // For identical effect sizes and uniform correlations, we can use this formula:
    return effectSize * Math.sqrt(numVariables / (1 + (numVariables-1) * correlation));
}

// Function to update the active curve label with current parameters
function updateActiveCurveLabel() {
    const effectSize = parseFloat(document.getElementById("effectSize").value);
    const correlation = parseFloat(document.getElementById("correlation").value);
    
    // Update the label with current parameters
    activeCurve.label = `d = ${effectSize.toFixed(2)}, r = ${correlation.toFixed(2)}`;
    
    // Update the chart to reflect the new label
    dChart.update();
}

// Export for main.js
window.initializeMahalanobis = initializeMahalanobis;

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