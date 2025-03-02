// Statistical utility functions
const StatUtils = {
    
    // Normal probability density function
    normalPDF: function(x, mean, stdDev) {
        return Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2)) / (stdDev * Math.sqrt(2 * Math.PI));
    },
    
    // Error function used in normal CDF calculation
    erf: function(z) {
        const sign = z < 0 ? -1 : 1;
        z = Math.abs(z);
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1 / (1 + p * z);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
        return sign * y;
    },
    
    // Normal cumulative distribution function
    normalCDF: function(x, mu = 0, sigma = 1) {
        return 0.5 * (1 + this.erf((x - mu) / (Math.sqrt(2) * sigma)));
    },
    
    // Compute observed correlation from true correlation and reliabilities
    attenuateCorrelation: function(trueR, reliabilityX, reliabilityY) {
        return trueR * Math.sqrt(reliabilityX * reliabilityY);
    },
    
    // Convert between effect sizes
    dToR: function(d) {
        return d / Math.sqrt(d * d + 4);
    },
    
    rToD: function(r) {
        return 2 * r / Math.sqrt(1 - r * r);
    },
    
    dToAUC: function(d) {
        return this.normalCDF(d / Math.sqrt(2), 0, 1);
    },
    
    dToOddsRatio: function(d) {
        return Math.exp(d * Math.PI / Math.sqrt(3));
    },

    dToLogOddsRatio: function(d) {
        return d * Math.PI / Math.sqrt(3);
    },
    
};

// Make utilities available globally
window.StatUtils = StatUtils;

// Utility functions for shared behavior

// Common layout settings for Plotly plots
function getCommonPlotlyLayout() {
    return {
        margin: { l: 50, r: 40, b: 50, t: 10, pad: 0 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true
    };
}

// Common configuration settings for Plotly plots
function getCommonPlotlyConfig() {
    return {
        responsive: true,
        displayModeBar: false,
        scrollZoom: false,
        staticPlot: false
    };
}

// Format a number to specified precision, with defaults
function formatNumber(value, precision = 2) {
    return parseFloat(value).toFixed(precision);
}

// Ensure value is clamped between min and max
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Debounce function to limit event firing
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Function to ensure plots are responsive
function makeResizablePlot(plotId) {
    function resizePlot() {
        Plotly.relayout(plotId, {
            autosize: true
        });
    }
    
    const debouncedResize = debounce(resizePlot, 250);
    window.addEventListener('resize', debouncedResize);
    return debouncedResize;
}

// Convert decimal to percentage for display
function toPercentage(decimal, precision = 1) {
    return (decimal * 100).toFixed(precision) + '%';
} 