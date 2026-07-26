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
    
    // Equal-groups conversion, kept for parity with the Python/R `r_to_d`.
    // For the exact inverse of dToR at an arbitrary base rate use pointBiserialToD.
    rToD: function(r) {
        return 2 * r / Math.sqrt(1 - r * r);
    },

    // Exact inverse of dToR: recovers d from a point-biserial r at base rate p.
    // Reduces to rToD when p = 0.5.
    pointBiserialToD: function(r, p) {
        if (Math.abs(r) >= 1) return Math.sign(r) * Infinity;
        const pp = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
        return r / Math.sqrt(pp * (1 - pp) * (1 - r * r));
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

    // -------------------------------------------------------------------------
    // Two-normal binary model (matches binary.js):
    //   controls ~ N(0, sigma0²), cases ~ N(mu, sigma1²), prior P(case) = baseRate
    // -------------------------------------------------------------------------

    // P(case | X = x) by Bayes' theorem.
    twoNormalPosterior: function(x, mu, sigma0, sigma1, baseRate) {
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const f0 = this.normalPDF(x, 0, sigma0);
        const f1 = this.normalPDF(x, mu, sigma1);
        const den = f1 * p + f0 * (1 - p);
        return den === 0 ? 0.5 : (f1 * p) / den;
    },

    // Solve P(case | X = x) = targetPt for x, returning { roots } in ascending order.
    //
    // With equal SDs the posterior increases monotonically and there is exactly one
    // solution. Unequal SDs make the posterior log-odds quadratic in x, so it turns
    // around: a target can then be met at two scores, one either side of the turning
    // point, or at none at all, because the posterior's range is bounded by its value at
    // that turning point. Callers must therefore handle an empty list.
    twoNormalScoresForPosterior: function(targetPt, mu, sigma0, sigma1, baseRate) {
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const pt = Math.min(Math.max(targetPt, 1e-12), 1 - 1e-12);
        const prec0 = 1 / (sigma0 * sigma0);
        const prec1 = 1 / (sigma1 * sigma1);

        // logit(pt) - logit(posterior(x)) = a x² + b x + c
        const a = (prec1 - prec0) / 2;
        const b = -mu * prec1;
        const c = (mu * mu * prec1) / 2
            + Math.log(pt / (1 - pt))
            + Math.log((1 - p) / p)
            + Math.log(sigma1 / sigma0);

        if (Math.abs(a) < 1e-12) {
            if (Math.abs(b) < 1e-12) return { roots: [] };
            return { roots: [-c / b] };
        }

        const disc = b * b - 4 * a * c;
        if (disc < 0) return { roots: [] };

        const sq = Math.sqrt(disc);
        return { roots: [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].sort((x, y) => x - y) };
    },

    // -------------------------------------------------------------------------
    // Bivariate-normal continuous model (matches continuous.js Monte Carlo):
    //   X,Y ~ BVN(0,0,1,1,r); positive class = top `baseRate` of Y; score = X
    // -------------------------------------------------------------------------

    bivariateClassCutoff: function(baseRate) {
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        return this.normalInverseCDF(1 - p);
    },

    bivariateResidualSD: function(r) {
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        return Math.sqrt(Math.max(1e-12, 1 - rr * rr));
    },

    // Standard bivariate normal density, unit variances, correlation r
    bivariateNormalPDF: function(x, y, r) {
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        const oneMinusR2 = Math.max(1e-12, 1 - rr * rr);
        const q = (x * x - 2 * rr * x * y + y * y) / oneMinusR2;
        return Math.exp(-0.5 * q) / (2 * Math.PI * Math.sqrt(oneMinusR2));
    },

    // Ellipse polyline for Mahalanobis contour Q = mahalanobisSq under unit-variance BVN
    bivariateContourEllipse: function(r, mahalanobisSq, numPoints = 128) {
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        const a = Math.sqrt(Math.max(0, mahalanobisSq * (1 + rr))); // axis along (1,1)
        const b = Math.sqrt(Math.max(0, mahalanobisSq * (1 - rr))); // axis along (1,-1)
        const pts = [];
        for (let i = 0; i <= numPoints; i++) {
            const t = (2 * Math.PI * i) / numPoints;
            const u = a * Math.cos(t);
            const v = b * Math.sin(t);
            pts.push({
                x: (u + v) / Math.SQRT2,
                y: (u - v) / Math.SQRT2
            });
        }
        return pts;
    },

    // Moments of X | case (Y > c) and X | control (Y ≤ c)
    bivariateGroupMoments: function(r, baseRate) {
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const c = this.bivariateClassCutoff(p);
        const phiC = this.normalPDF(c, 0, 1);
        const ey1 = phiC / p;
        const ey0 = -phiC / (1 - p);
        const vy1 = 1 + c * phiC / p - ey1 * ey1;
        const vy0 = 1 - c * phiC / (1 - p) - ey0 * ey0;
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        const resid = 1 - rr * rr;
        return {
            c,
            meanTeal: rr * ey1,
            meanGray: rr * ey0,
            varianceTeal: rr * rr * Math.max(vy1, 0) + resid,
            varianceGray: rr * rr * Math.max(vy0, 0) + resid,
            baseRate: p
        };
    },

    bivariateEffectSizes: function(r, baseRate, options = {}) {
        const m = this.bivariateGroupMoments(r, baseRate);
        const p = m.baseRate;
        const pooledVar = (1 - p) * m.varianceGray + p * m.varianceTeal;
        const pooledSD = Math.sqrt(Math.max(pooledVar, 1e-12));
        const nonpooledSD = Math.sqrt(Math.max((m.varianceGray + m.varianceTeal) / 2, 1e-12));
        const delta = m.meanTeal - m.meanGray;
        const d = delta / pooledSD;
        const da = delta / nonpooledSD;
        const glassD = delta / Math.sqrt(Math.max(m.varianceGray, 1e-12));
        const cohensU3 = this.normalCDF(da, 0, 1);
        // Rank-biserial = 2*AUC - 1 under the Mann–Whitney definition; AUC optional
        // to avoid rebuilding a full ROC curve when the caller already has one.
        const auc = options.auc != null ? options.auc : this.bivariateROCAUC(r, p, {
            curvePoints: options.curvePoints || 240,
            yNodes: options.yNodes || 100
        });
        const rankBiserial = 2 * auc - 1;
        return {
            d,
            da,
            glassD,
            cohensU3,
            rankBiserial,
            meanTeal: m.meanTeal,
            meanGray: m.meanGray,
            varianceTeal: m.varianceTeal,
            varianceGray: m.varianceGray,
            auc
        };
    },

    // Joint mass helpers via 1D quadrature over Y
    _integrateXExceeds: function(r, t, y0, y1, n) {
        const sigma = this.bivariateResidualSD(r);
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        return this.trapezoidalIntegration(
            y => (1 - this.normalCDF(t, rr * y, sigma)) * this.normalPDF(y, 0, 1),
            y0,
            y1,
            n
        );
    },

    // P(Y > c | X = t) under unit-variance BVN = 1 - Φ((c - r t) / sqrt(1-r²))
    bivariatePosteriorProb: function(r, baseRate, threshold) {
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const c = this.bivariateClassCutoff(p);
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        const sigma = this.bivariateResidualSD(rr);
        return 1 - this.normalCDF((c - rr * threshold) / sigma, 0, 1);
    },

    // Score threshold t such that P(Y > c | X = t) = pt (closed form)
    bivariateThresholdFromPt: function(r, baseRate, pt) {
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const target = Math.min(Math.max(pt, 1e-12), 1 - 1e-12);
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        if (Math.abs(rr) < 1e-12) return 0;
        const c = this.bivariateClassCutoff(p);
        const sigma = this.bivariateResidualSD(rr);
        const z = this.normalInverseCDF(1 - target);
        return (c - sigma * z) / rr;
    },

    bivariateSensSpec: function(r, baseRate, threshold, yNodes = 160) {
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const c = this.bivariateClassCutoff(p);
        // Integrate far enough into the tails for stable masses
        const yLo = Math.min(c - 8, -8);
        const yHi = Math.max(c + 8, 8);
        const nPos = Math.max(40, Math.round(yNodes * Math.min(1, (yHi - c) / 8)));
        const nNeg = Math.max(40, Math.round(yNodes * Math.min(1, (c - yLo) / 8)));

        const massPos = this._integrateXExceeds(r, threshold, c, yHi, nPos);
        const massNeg = this._integrateXExceeds(r, threshold, yLo, c, nNeg);
        const sensitivity = Math.min(1, Math.max(0, massPos / p));
        const fpr = Math.min(1, Math.max(0, massNeg / (1 - p)));
        const specificity = 1 - fpr;
        return { sensitivity, specificity, fpr, baseRate: p };
    },

    bivariatePredictiveMetrics: function(r, baseRate, threshold, yNodes = 160) {
        const { sensitivity, specificity, fpr, baseRate: p } =
            this.bivariateSensSpec(r, baseRate, threshold, yNodes);
        const ppvDenom = p * sensitivity + (1 - p) * fpr;
        const npvDenom = p * (1 - sensitivity) + (1 - p) * specificity;
        const ppv = ppvDenom > 0 ? (p * sensitivity) / ppvDenom : 0;
        const npv = npvDenom > 0 ? ((1 - p) * specificity) / npvDenom : 0;
        const accuracy = p * sensitivity + (1 - p) * specificity;
        const balancedAccuracy = (sensitivity + specificity) / 2;
        const f1Score = (ppv + sensitivity) > 0 ? 2 * ppv * sensitivity / (ppv + sensitivity) : 0;

        // Population confusion rates (fractions of total)
        const tp = p * sensitivity;
        const fn = p * (1 - sensitivity);
        const tn = (1 - p) * specificity;
        const fp = (1 - p) * fpr;
        const mccDen = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
        const mcc = mccDen > 0 ? ((tp * tn - fp * fn) / mccDen) : 0;

        const lrPlus = (1 - specificity) > 0 ? sensitivity / (1 - specificity) : Infinity;
        const lrMinus = specificity > 0 ? (1 - sensitivity) / specificity : Infinity;
        const dor = (isFinite(lrPlus) && isFinite(lrMinus) && lrMinus > 0) ? lrPlus / lrMinus : Infinity;
        const youden = sensitivity + specificity - 1;
        const gMean = Math.sqrt(Math.max(0, sensitivity * specificity));

        const pYesTrue = p;
        const pYesPred = tp + fp;
        const peChance = pYesTrue * pYesPred + (1 - pYesTrue) * (1 - pYesPred);
        const kappa = (1 - peChance) !== 0 ? (accuracy - peChance) / (1 - peChance) : 0;

        const preTestOdds = p / (1 - p);
        const postTestOddsPlus = preTestOdds * lrPlus;
        const postTestOddsMinus = preTestOdds * lrMinus;
        const postTestProbPlus = isFinite(postTestOddsPlus)
            ? postTestOddsPlus / (1 + postTestOddsPlus) : 1;
        const postTestProbMinus = isFinite(postTestOddsMinus)
            ? postTestOddsMinus / (1 + postTestOddsMinus) : 0;

        return {
            sensitivity,
            specificity,
            fpr,
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
            baseRate: p
        };
    },

    bivariateThresholdRange: function(r, baseRate) {
        const m = this.bivariateGroupMoments(r, baseRate);
        const sd1 = Math.sqrt(Math.max(m.varianceTeal, 1e-12));
        const sd0 = Math.sqrt(Math.max(m.varianceGray, 1e-12));
        const tMin = Math.min(m.meanTeal - 6 * sd1, m.meanGray - 6 * sd0, -4);
        const tMax = Math.max(m.meanTeal + 6 * sd1, m.meanGray + 6 * sd0, 4);
        return { tMin, tMax };
    },

    // Mixture-component densities of X for case / control under BVN dichotomization.
    // Returns f(x, case) = f(x|case)*p and f(x, control) = f(x|control)*(1-p), matching
    // the binary-mode plot scaling (area under both curves sums to 1).
    bivariateGroupDensities: function(r, baseRate, options = {}) {
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const c = this.bivariateClassCutoff(p);
        const sigma = this.bivariateResidualSD(r);
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        const xMin = options.xMin != null ? options.xMin : -4;
        const xMax = options.xMax != null ? options.xMax : 4;
        const xPoints = options.xPoints || 161;
        const yNodes = options.yNodes || 140;

        const yLo = Math.min(c - 8, -8);
        const yHi = Math.max(c + 8, 8);
        const posGrid = this._makeYGrid(c, yHi, yNodes);
        const negGrid = this._makeYGrid(yLo, c, yNodes);
        const posPhiW = posGrid.y.map((yy, i) => this.normalPDF(yy, 0, 1) * posGrid.w[i]);
        const negPhiW = negGrid.y.map((yy, i) => this.normalPDF(yy, 0, 1) * negGrid.w[i]);
        const posMean = posGrid.y.map(yy => rr * yy);
        const negMean = negGrid.y.map(yy => rr * yy);

        const caseDensity = [];
        const controlDensity = [];
        for (let i = 0; i < xPoints; i++) {
            const x = xMin + (i / (xPoints - 1)) * (xMax - xMin);
            let densCase = 0;
            for (let j = 0; j < posGrid.y.length; j++) {
                densCase += this.normalPDF(x, posMean[j], sigma) * posPhiW[j];
            }
            let densCtrl = 0;
            for (let j = 0; j < negGrid.y.length; j++) {
                densCtrl += this.normalPDF(x, negMean[j], sigma) * negPhiW[j];
            }
            caseDensity.push({ x, y: densCase });
            controlDensity.push({ x, y: densCtrl });
        }
        return { caseDensity, controlDensity, baseRate: p };
    },

    // Build a trapezoid weight grid on [y0, y1]
    _makeYGrid: function(y0, y1, n) {
        const nodes = Math.max(8, n | 0);
        const h = (y1 - y0) / nodes;
        const y = new Array(nodes + 1);
        const w = new Array(nodes + 1);
        for (let i = 0; i <= nodes; i++) {
            y[i] = y0 + i * h;
            w[i] = (i === 0 || i === nodes) ? 0.5 * h : h;
        }
        return { y, w };
    },

    // Build ROC + PR curves and AUCs under the bivariate continuous model
    bivariateDiscriminationCurves: function(r, baseRate, options = {}) {
        const curvePoints = options.curvePoints || 400;
        const yNodes = options.yNodes || 140;
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const c = this.bivariateClassCutoff(p);
        const sigma = this.bivariateResidualSD(r);
        const rr = Math.min(Math.max(r, -0.999999), 0.999999);
        const { tMin, tMax } = this.bivariateThresholdRange(r, p);

        const yLo = Math.min(c - 8, -8);
        const yHi = Math.max(c + 8, 8);
        const posGrid = this._makeYGrid(c, yHi, yNodes);
        const negGrid = this._makeYGrid(yLo, c, yNodes);
        const posPhiW = posGrid.y.map((yy, i) => this.normalPDF(yy, 0, 1) * posGrid.w[i]);
        const negPhiW = negGrid.y.map((yy, i) => this.normalPDF(yy, 0, 1) * negGrid.w[i]);
        const posMean = posGrid.y.map(yy => rr * yy);
        const negMean = negGrid.y.map(yy => rr * yy);

        const FPR = [];
        const TPR = [];
        const precision = [];
        const recall = [];
        const thresholds = [];

        for (let i = 0; i < curvePoints; i++) {
            // High threshold → low FPR/TPR first (standard ROC sweep direction)
            const t = tMax - (i / (curvePoints - 1)) * (tMax - tMin);
            let massPos = 0;
            for (let j = 0; j < posGrid.y.length; j++) {
                massPos += (1 - this.normalCDF(t, posMean[j], sigma)) * posPhiW[j];
            }
            let massNeg = 0;
            for (let j = 0; j < negGrid.y.length; j++) {
                massNeg += (1 - this.normalCDF(t, negMean[j], sigma)) * negPhiW[j];
            }
            const sensitivity = Math.min(1, Math.max(0, massPos / p));
            const fpr = Math.min(1, Math.max(0, massNeg / (1 - p)));
            FPR.push(fpr);
            TPR.push(sensitivity);
            recall.push(sensitivity);
            const precDenom = p * sensitivity + (1 - p) * fpr;
            precision.push(precDenom > 0 ? (p * sensitivity) / precDenom : 1);
            thresholds.push(t);
        }

        // ROC-AUC via trapezoid on sorted FPR (robust to tiny numeric non-monotonicity)
        const rocPts = FPR.map((fpr, i) => ({ fpr, tpr: TPR[i] }))
            .sort((a, b) => a.fpr - b.fpr);
        let auc = 0;
        for (let i = 1; i < rocPts.length; i++) {
            auc += (rocPts[i].fpr - rocPts[i - 1].fpr) *
                (rocPts[i].tpr + rocPts[i - 1].tpr) / 2;
        }
        auc = Math.min(1, Math.max(0, auc));

        // PR-AUC
        const prPoints = recall.map((rec, i) => ({ recall: rec, precision: precision[i] }));
        prPoints.push({ recall: 0, precision: 1 });
        prPoints.push({ recall: 1, precision: p });
        prPoints.sort((a, b) => a.recall - b.recall);
        const unique = [];
        let last = -1;
        for (const pt of prPoints) {
            if (pt.recall !== last) {
                unique.push(pt);
                last = pt.recall;
            }
        }
        let prauc = 0;
        for (let i = 1; i < unique.length; i++) {
            prauc += (unique[i].recall - unique[i - 1].recall) *
                (unique[i].precision + unique[i - 1].precision) / 2;
        }
        prauc = Math.min(1, Math.max(0, prauc));

        return { FPR, TPR, precision, recall, thresholds, auc, prauc, baseRate: p, tMin, tMax };
    },

    bivariateROCAUC: function(r, baseRate, options = {}) {
        return this.bivariateDiscriminationCurves(r, baseRate, {
            curvePoints: options.curvePoints || 320,
            yNodes: options.yNodes || 120
        }).auc;
    },

    bivariateOptimalThreshold: function(r, baseRate, metricType = 'youden', options = {}) {
        const curvePoints = options.curvePoints || 600;
        const yNodes = options.yNodes || 140;
        const p = Math.min(Math.max(baseRate, 1e-12), 1 - 1e-12);
        const { tMin, tMax } = this.bivariateThresholdRange(r, p);
        let bestValue = -Infinity;
        let bestT = 0;
        for (let i = 0; i < curvePoints; i++) {
            const t = tMin + (i / (curvePoints - 1)) * (tMax - tMin);
            const m = this.bivariatePredictiveMetrics(r, p, t, yNodes);
            const value = metricType === 'f1' ? m.f1Score : m.youden;
            if (value > bestValue) {
                bestValue = value;
                bestT = t;
            }
        }
        // Local refine
        const span = (tMax - tMin) / curvePoints * 8;
        const refineN = 80;
        for (let i = 0; i < refineN; i++) {
            const t = bestT - span + (2 * span) * (i / (refineN - 1));
            const m = this.bivariatePredictiveMetrics(r, p, t, yNodes);
            const value = metricType === 'f1' ? m.f1Score : m.youden;
            if (value > bestValue) {
                bestValue = value;
                bestT = t;
            }
        }
        return bestT;
    },

    rToPRAUCTrapezoidal: function(r, baseRate, numPoints = 500) {
        if (baseRate <= 0) return 0;
        if (baseRate >= 1) return 1;
        if (r < -1 || r > 1) return baseRate;
        return this.bivariateDiscriminationCurves(r, baseRate, {
            curvePoints: numPoints,
            yNodes: 180
        }).prauc;
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

// Ensure value is clamped between min and max
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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