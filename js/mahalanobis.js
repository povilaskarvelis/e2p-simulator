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
    // Reset datasets when initializing
    datasets = [];
    
    document.getElementById('calculate-mahalanobis').addEventListener('click', calculateAndPlot);
    document.getElementById('reset-mahalanobis').addEventListener('click', resetPlot);
}

function calculateAndPlot() {
    // Get user inputs
    const maxNumVariables = parseInt(document.getElementById("numVariables").value);
    const effectSize = parseFloat(document.getElementById("effectSize").value);
    const correlation = parseFloat(document.getElementById("correlation").value);
    const neededD = parseFloat(document.getElementById("neededD").value);

    // Input validation
    if (!validateInputs(maxNumVariables, effectSize, correlation, neededD)) return;

    // Compute D for each number of variables
    const numVariablesArray = Array.from({ length: maxNumVariables }, (_, i) => i + 1);
    const dValues = numVariablesArray.map(k => computeMahalanobisD(k, effectSize, correlation));

    // Add the new line to the plot
    const newDataset = {
        label: `d = ${effectSize}, r = ${correlation}`,
        data: dValues,
        borderColor: getRandomColor(),
        borderWidth: 2,
        fill: false
    };

    // Add the new line to the plot
    datasets.push(newDataset);

    // Display the plot
    displayPlot(numVariablesArray, neededD);
}

function validateInputs(maxNumVariables, effectSize, correlation, neededD) {
    if (isNaN(maxNumVariables) || maxNumVariables <= 0) {
        alert("Please enter a valid max number of variables (positive integer).");
        return false;
    }
    if (isNaN(effectSize) || effectSize <= 0) {
        alert("Please enter a valid effect size (positive number).");
        return false;
    }
    if (isNaN(correlation) || correlation < 0 || correlation > 1) {
        alert("Please enter a valid correlation range (between 0 and 1).");
        return false;
    }
    if (isNaN(neededD) || neededD <= 0) {
        alert("Please enter a valid needed Mahalanobis D (positive number).");
        return false;
    }
    return true;
}

function computeMahalanobisD(numVariables, effectSize, correlation) {
    // Your existing computeMahalanobisD function
    const variance = 1;
    const covarianceMatrix = Array.from({ length: numVariables }, () =>
        Array.from({ length: numVariables }, () => 0)
    );

    for (let i = 0; i < numVariables; i++) {
        for (let j = 0; j < numVariables; j++) {
            covarianceMatrix[i][j] = i === j ? variance : correlation;
        }
    }

    const inverseCovarianceMatrix = math.inv(covarianceMatrix);
    const effectSizeVector = Array(numVariables).fill(effectSize);

    let D2 = 0;
    for (let i = 0; i < numVariables; i++) {
        for (let j = 0; j < numVariables; j++) {
            D2 += effectSizeVector[i] * inverseCovarianceMatrix[i][j] * effectSizeVector[j];
        }
    }

    return Math.sqrt(D2);
}

function displayPlot(xValues, neededD) {
    const ctx = document.getElementById('dPlot').getContext('2d');

    // Properly destroy existing chart if it exists
    if (window.dChart && window.dChart.destroy instanceof Function) {
        window.dChart.destroy();
    }
    window.dChart = null;

    const neededDataset = {
        label: `Needed D = ${neededD}`,
        data: Array(xValues.length).fill(neededD),
        borderColor: '#000000',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
    };

    const allDatasets = [...datasets, neededDataset];

    // Update button color
    document.getElementById('calculate-mahalanobis').style.backgroundColor = 'black';

    window.dChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: xValues,
            datasets: allDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: {
                            size: 14
                        }
                    }
                }
            },
            elements: {
                line: {
                    tension: 0.1,
                    borderWidth: 3
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,  // Remove grid
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
                    grid: {
                        display: false,  // Remove grid
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Mahalanobis D',
                        font: { size: 16 }
                    },
                    ticks: { font: { size: 12 } }
                }
            },
            layout: {
                padding: { top: 10, bottom: 10 }
            }
        }
    });
}

function getRandomColor() {
    return colors[datasets.length % colors.length];
}

function resetPlot() {
    // Clear all datasets except the needed D line
    datasets = [];
    
    // Get the current needed D value
    const neededD = parseFloat(document.getElementById("neededD").value);
    
    // Redraw the plot with just the needed D line
    displayPlot(Array.from({ length: 50 }, (_, i) => i + 1), neededD);
}

// Export for main.js
window.initializeMahalanobis = initializeMahalanobis; 