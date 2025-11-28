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
    dToR: function(d,p) {
        // Convert d to point-biserial correlation using base rate p
        // When p = 0.5, this reduces to the standard formula d / sqrt(d^2 + 4)
        return d / Math.sqrt(d * d + 1/(p * (1-p)));
    },
    
    rToD: function(r) {
        return 2 * r / Math.sqrt(1 - r * r);
    },

    // Simple numerical integration using trapezoidal rule
    trapezoidalIntegration: function(func, a, b, n = 1000) {
        const h = (b - a) / n;
        let sum = (func(a) + func(b)) / 2;
        for (let i = 1; i < n; i++) {
            sum += func(a + i * h);
        }
        return sum * h;
    },

    // Inverse normal CDF approximation (for computing quantiles)
    normalInverseCDF: function(p) {
        // Beasley-Springer-Moro algorithm approximation
        if (p <= 0) return -Infinity;
        if (p >= 1) return Infinity;
        if (p === 0.5) return 0;
        
        const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
        const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
        const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
        const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

        let r, x;
        if (p < 0.02425) {
            r = Math.sqrt(-2 * Math.log(p));
            x = (((((c[1] * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) * r + c[6]) / ((((d[1] * r + d[2]) * r + d[3]) * r + d[4]) * r + 1);
        } else if (p > 0.97575) {
            r = Math.sqrt(-2 * Math.log(1 - p));
            x = -(((((c[1] * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) * r + c[6]) / ((((d[1] * r + d[2]) * r + d[3]) * r + d[4]) * r + 1);
        } else {
            r = p - 0.5;
            const r2 = r * r;
            x = (((((a[1] * r2 + a[2]) * r2 + a[3]) * r2 + a[4]) * r2 + a[5]) * r2 + a[6]) * r / (((((b[1] * r2 + b[2]) * r2 + b[3]) * r2 + b[4]) * r2 + b[5]) * r2 + 1);
        }
        return x;
    },

    rToPRAUCTrapezoidal: function(r, baseRate, numPoints = 500) {
        if (r < 0 || r > 1 || baseRate <= 0 || baseRate >= 1) {
            return baseRate; // Return base rate as fallback
        }
        if (baseRate === 0) return 0;
        if (baseRate === 1) return 1;

        // Convert to notation consistent with the Python code
        const x = baseRate; // base rate
        const c = this.normalInverseCDF(1 - x); // threshold for top x proportion
        const varEpsilon = 1 - r * r;
        const sigmaEpsilon = Math.sqrt(varEpsilon);

        // Integrand function: P(X > t | Y = y) * φ(y)
        const integrand = (y, t) => {
            const prob = 1 - this.normalCDF(t, r * y, sigmaEpsilon);
            return prob * this.normalPDF(y, 0, 1);
        };

        // Calculate approximate parameters for positive class distribution
        const phiC = this.normalPDF(c, 0, 1);
        const EY1 = phiC / x;
        const mu1Approx = r * EY1;
        const sigma1Approx = Math.sqrt(varEpsilon + r * r * (1 + c * (phiC / x) - Math.pow(phiC / x, 2)));

        // Define threshold range
        const tMin = mu1Approx - 6 * sigma1Approx;
        const tMax = mu1Approx + 6 * sigma1Approx;

        const recall = [];
        const precision = [];

        // Generate thresholds
        for (let i = 0; i < numPoints; i++) {
            const t = tMin + (i / (numPoints - 1)) * (tMax - tMin);

            // Calculate recall: P(X > t | Y > c)
            const integralPos = this.trapezoidalIntegration(y => integrand(y, t), c, 10, 200);
            const pXGtTZ1 = integralPos / x;
            recall.push(pXGtTZ1);

            // Calculate precision
            const integralNeg = this.trapezoidalIntegration(y => integrand(y, t), -10, c, 200);
            const pXGtTZ0 = integralNeg / (1 - x);
            
            const tp = x * pXGtTZ1;
            const fp = (1 - x) * pXGtTZ0;
            const prec = (tp + fp > 0) ? tp / (tp + fp) : 0;
            precision.push(prec);
        }

        // Sort by recall for proper integration
        const sortedIndices = recall.map((_, i) => i).sort((a, b) => recall[a] - recall[b]);
        const recallSorted = sortedIndices.map(i => recall[i]);
        const precisionSorted = sortedIndices.map(i => precision[i]);

        // Calculate PR-AUC using trapezoidal rule
        let prAuc = 0;
        for (let i = 1; i < recallSorted.length; i++) {
            prAuc += (recallSorted[i] - recallSorted[i-1]) * (precisionSorted[i] + precisionSorted[i-1]) / 2;
        }

        return Math.max(0, Math.min(1, prAuc));
    },

    // For backward compatibility, keep the simulation version but rename it
    rToPRAUCviaSimulation: function(r, baseRate) {
        return this.rToPRAUCTrapezoidal(r, baseRate);
    },
    
    dToAUC: function(d) {
        return this.normalCDF(d / Math.sqrt(2), 0, 1);
    },

    aucToD: function(auc) {
        if (auc <= 0.5) return 0;
        return this.normalInverseCDF(auc) * Math.sqrt(2);
    },
    
    dToOddsRatio: function(d) {
        return Math.exp(d * Math.PI / Math.sqrt(3));
    },

    dToLogOddsRatio: function(d) {
        return d * Math.PI / Math.sqrt(3);
    },

    dToPRAUC: function(d, baseRate) {
        if (baseRate <= 0) return 0;
        if (baseRate >= 1) return 1;

        const n_points = 500; // More points for better accuracy
        const thresholds = [];
        // Generate thresholds in descending order
        const min_thresh = Math.min(0, d) - 6; 
        const max_thresh = Math.max(0, d) + 6;
        for (let i = 0; i < n_points; i++) {
            thresholds.push(max_thresh - (i / (n_points - 1)) * (max_thresh - min_thresh));
        }

        let points = thresholds.map(t => {
            const recall = 1 - this.normalCDF(t, d, 1);
            const fpr = 1 - this.normalCDF(t, 0, 1);
            
            const tpr = recall;
            const numerator = baseRate * tpr;
            const denominator = numerator + (1 - baseRate) * fpr;
            
            let precision = 1.0;
            if (denominator > 1e-9) {
                precision = numerator / denominator;
            }

            return { recall, precision };
        });
        
        const final_points = [{ recall: 0, precision: 1.0 }];
        final_points.push(...points);
        final_points.push({ recall: 1.0, precision: baseRate });
        
        const unique_points = [];
        const seen_recalls = new Set();
        for(const p of final_points){
            if(!seen_recalls.has(p.recall)){
                unique_points.push(p);
                seen_recalls.add(p.recall);
            }
        }

        let area = 0.0;
        for (let i = 1; i < unique_points.length; i++) {
            area += (unique_points[i].recall - unique_points[i - 1].recall) * 
                    (unique_points[i].precision + unique_points[i - 1].precision) / 2.0;
        }

        return Math.max(0, Math.min(1, area));
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

// Convert percentage-based UI value to fraction (0-1)
function percentageToFraction(value) {
    const numeric = parseFloat(value);
    if (isNaN(numeric)) return 0;
    const clamped = clamp(numeric, 0, 100);
    return clamped / 100;
}

// Convert fraction (0-1) to percentage for UI controls
function fractionToPercentage(value) {
    const numeric = parseFloat(value);
    if (isNaN(numeric)) return 0;
    const clamped = clamp(numeric, 0, 1);
    return clamped * 100;
}

window.percentageToFraction = percentageToFraction;
window.fractionToPercentage = fractionToPercentage;