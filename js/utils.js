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
    
    // Quantile function for normal distribution (inverse of normalCDF)
    qnorm: function(p) {
        if (p <= 0 || p >= 1) {
            return p <= 0 ? -Infinity : Infinity;
        }
        
        // Approximation for normal quantile function
        const a1 = -3.969683028665376e+01;
        const a2 = 2.209460984245205e+02;
        const a3 = -2.759285104469687e+02;
        const a4 = 1.383577518672690e+02;
        const a5 = -3.066479806614716e+01;
        const a6 = 2.506628277459239e+00;
        
        const b1 = -5.447609879822406e+01;
        const b2 = 1.615858368580409e+02;
        const b3 = -1.556989798598866e+02;
        const b4 = 6.680131188771972e+01;
        const b5 = -1.328068155288572e+01;
        
        const c1 = -7.784894002430293e-03;
        const c2 = -3.223964580411365e-01;
        const c3 = -2.400758277161838e+00;
        const c4 = -2.549732539343734e+00;
        const c5 = 4.374664141464968e+00;
        const c6 = 2.938163982698783e+00;
        
        const d1 = 7.784695709041462e-03;
        const d2 = 3.224671290700398e-01;
        const d3 = 2.445134137142996e+00;
        const d4 = 3.754408661907416e+00;
        
        // Define break-points
        const plow = 0.02425;
        const phigh = 1 - plow;
        
        let q, r;
        
        if (p < plow) {
            // Rational approximation for lower region
            q = Math.sqrt(-2 * Math.log(p));
            return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
                   ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        } else if (p <= phigh) {
            // Rational approximation for central region
            q = p - 0.5;
            r = q * q;
            return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
                   (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
        } else {
            // Rational approximation for upper region
            q = Math.sqrt(-2 * Math.log(1 - p));
            return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
                    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        }
    }
};

// Make utilities available globally
window.StatUtils = StatUtils; 