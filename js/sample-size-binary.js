// Binary outcome sample size calculator (Riley et al., BMJ 2020)
// Computes the BMJ binary-outcome criteria while presenting one educational result

(function(){
    function computeShrinkageN(p, S, r2cs){
        return window.E2PStatCore.binaryShrinkageSampleSize(p, r2cs, S);
    }

    function computeOptimismN(p, delta, r2cs, prevalence){
        return window.E2PStatCore.binaryNagelkerkeOptimismSampleSize(
            p,
            r2cs,
            prevalence,
            delta
        );
    }

    function computeRiskPrecisionN(prevalence, margin){
        return window.E2PStatCore.binaryOverallRiskSampleSize(
            prevalence,
            margin
        );
    }

    // Mean absolute prediction error criterion (B2) based on van Smeden et al. (2016)
    // ln(MAPE) = -0.508 - 0.544 ln(n) + 0.259 ln(phi) + 0.504 ln(p)
    // => n = exp(( -0.508 + 0.259 ln(phi) + 0.504 ln(p) - ln(MAPE) ) / 0.544)
    function computeMapeN(p, targetMape, phi){
        const predictorParameters = Math.max(1, p);
        const mape = Math.max(1e-6, targetMape);
        // Ensure phi <= 0.5 by symmetry
        let phiEff = Math.max(1e-6, Math.min(phi, 1 - phi));
        // Only validated for p <= 30
        if (predictorParameters > 30) return NaN;
        const num = -0.508 + 0.259 * Math.log(phiEff) + 0.504 * Math.log(predictorParameters) - Math.log(mape);
        const den = 0.544;
        return Math.exp(num / den);
    }

    function formatInt(x){
        if (!isFinite(x) || isNaN(x)) return '-';
        return Math.ceil(Math.max(0, x)).toLocaleString();
    }

    function val(id){
        const el = document.getElementById(id);
        if (!el) return null;
        if (el.tagName === 'SELECT' || el.type === 'select-one') return el.value;
        const v = parseFloat(el.value);
        return isNaN(v) ? null : v;
    }

    function formatPercentage(proportion){
        return Number((proportion * 100).toFixed(1)).toString();
    }

    function setCoxSnellMessage(validation, limit, prevalence, shrinkage){
        const message = document.getElementById('ssb-r2cs-message');
        const r2Input = document.getElementById('ssb-r2cs');
        const r2Slider = document.getElementById('ssb-r2cs-slider');
        const r2Value = val('ssb-r2cs');
        const atLimit =
            Number.isFinite(r2Value) &&
            Number.isFinite(limit.selectableMaximum) &&
            Math.abs(r2Value - limit.selectableMaximum) < 1e-12;
        let messageText = '';

        if (!validation.valid) {
            messageText = validation.errors[0] || 'Enter a valid Cox–Snell R².';
        } else if (atLimit && limit.limitingConstraint === 'base-rate') {
            messageText =
                `Cox–Snell R² stops here: its maximum is ${limit.theoreticalMaximum.toFixed(3)} ` +
                `at a ${formatPercentage(prevalence)}% base rate.`;
        } else if (atLimit && limit.limitingConstraint === 'shrinkage') {
            messageText =
                `Cox–Snell R² stops here: it must remain below S = ${shrinkage.toFixed(2)}.`;
        }

        if (message) {
            message.hidden = messageText === '';
            message.textContent = messageText;
        }

        [r2Input, r2Slider].forEach((element) => {
            if (element) {
                element.setAttribute('aria-invalid', validation.valid ? 'false' : 'true');
            }
        });
    }

    function syncPair(sliderId, inputId){
        const s = document.getElementById(sliderId);
        const i = document.getElementById(inputId);
        if (!s || !i) return;
        const constraints = () => ({
            min: Number(s.min),
            max: Number(s.max),
            step: Number(s.step)
        });
        const stepDecimals = (() => {
            const stepText = String(s.step || '');
            if (stepText.includes('e-')) {
                return Number(stepText.split('e-')[1]) || 0;
            }
            return (stepText.split('.')[1] || '').length;
        })();

        const normalize = (rawValue) => {
            const { min, max, step } = constraints();
            let value = Number(rawValue);
            if (!Number.isFinite(value)) return null;
            if (Number.isFinite(min)) value = Math.max(min, value);
            if (Number.isFinite(max)) value = Math.min(max, value);
            if (Number.isFinite(step) && step > 0) {
                const stepBase = Number.isFinite(min) ? min : 0;
                value = stepBase + Math.round((value - stepBase) / step) * step;
                if (Number.isFinite(min)) value = Math.max(min, value);
                if (Number.isFinite(max)) value = Math.min(max, value);
            }
            return Number(value.toFixed(stepDecimals)).toString();
        };

        const setInvalid = (invalid) => {
            i.setAttribute('aria-invalid', invalid ? 'true' : 'false');
        };

        const updateTrack = () => {
            if (!s.classList.contains('criterion-slider--mape')) return;
            const { min, max } = constraints();
            const progress = Math.max(0, Math.min(100,
                ((Number(s.value) - min) / (max - min)) * 100
            ));
            s.style.setProperty('--criterion-slider-progress', `${progress}%`);
        };

        s.addEventListener('input', () => {
            i.value = s.value;
            setInvalid(false);
            updateTrack();
            update();
        });

        i.addEventListener('input', () => {
            const { min, max } = constraints();
            const value = Number(i.value);
            const inRange =
                Number.isFinite(value) &&
                (!Number.isFinite(min) || value >= min) &&
                (!Number.isFinite(max) || value <= max);

            if (!inRange) {
                setInvalid(true);
                return;
            }

            const normalized = normalize(value);
            if (normalized == null) return;
            s.value = normalized;
            i.value = normalized;
            setInvalid(false);
            updateTrack();
            update();
        });

        i.addEventListener('change', () => {
            const normalized = normalize(i.value);
            const committed = normalized == null ? s.value : normalized;
            s.value = committed;
            i.value = committed;
            setInvalid(false);
            updateTrack();
            update();
        });

        setInvalid(false);
        updateTrack();
    }

    function drawMultiLineChart(canvasId, xs, series, chartTitle, xAxisTitle, pVal){
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === 'undefined') return;
        if (ctx._chart) { ctx._chart.destroy(); }
        const plugins = [];
        if (window.customLegendPlugin) plugins.push(window.customLegendPlugin);

        const tickOptions = {
            font: { size: 14 },
            callback: function(value) {
                if (value <= 0 || value > pVal) return null;
                if (Number.isInteger(value)) return value;
                return null;
            }
        };

        if (pVal <= 10) {
            tickOptions.stepSize = 1;
        } else {
            tickOptions.maxTicksLimit = 10;
        }

        ctx._chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xs,
                datasets: series
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    title: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: n ${Math.ceil(ctx.parsed.y)}` } }
                },
                scales: {
                    x: {
                        min: 0,
                        max: pVal + 1,
                        type: 'linear',
                        title: { display: true, text: xAxisTitle, font: { size: 18 } },
                        ticks: tickOptions,
                        grid: { display: false, drawBorder: false }
                    },
                    y: { beginAtZero: true, title: { display: true, text: 'Required sample size (N)', font: { size: 18 } }, ticks: { font: { size: 14 } }, grid: { display: false, drawBorder: false } }
                }
            },
            plugins
        });
    }

    function update(){
        const pValue = val('ssb-p-slider');
        const prevInput = val('ssb-prevalence-slider');
        const S = val('ssb-shrinkage-slider');
        const targetEPV = Math.max(1, Math.round(val('ssb-epv-slider') || 10));
        const targetMAPE = Math.max(0.001, Math.min(0.2, val('ssb-mape-slider') || 0.05));
        const targetR2Difference = Math.max(
            0.005,
            Math.min(0.1, val('ssb-r2-difference-slider') || 0.05)
        );
        const riskMargin = Math.max(
            0.005,
            Math.min(0.2, val('ssb-risk-margin-slider') || 0.05)
        );

        if (pValue == null || prevInput == null || S == null || targetMAPE == null) return;
        const p = Math.max(1, Math.round(pValue));
        const prevPct = Math.max(0.001, Math.min(0.999, percentageToFraction(prevInput)));
        const limit = window.E2PStatCore.selectableCoxSnellR2Limit(prevPct, S);
        const r2Input = document.getElementById('ssb-r2cs');
        const r2Slider = document.getElementById('ssb-r2cs-slider');

        if (Number.isFinite(limit.selectableMaximum)) {
            const maximum = limit.selectableMaximum.toFixed(2);
            [r2Input, r2Slider].forEach((element) => {
                if (element) element.max = maximum;
            });

            const currentR2 = val('ssb-r2cs-slider');
            if (
                Number.isFinite(currentR2) &&
                currentR2 > limit.selectableMaximum
            ) {
                r2Input.value = maximum;
            }
            if (Number.isFinite(currentR2) && r2Slider && r2Input) {
                r2Slider.value = r2Input.value;
                r2Input.value = r2Slider.value;
            }
        }

        const r2cs = val('ssb-r2cs-slider');
        if (r2cs == null) {
            const message = document.getElementById('ssb-r2cs-message');
            if (message) message.hidden = true;
            return;
        }
        const validation = window.E2PStatCore.validateCoxSnellInputs(r2cs, S, prevPct);
        setCoxSnellMessage(validation, limit, prevPct, S);

        if (!validation.valid) {
            const tableContainer = document.getElementById('ssb-results-table');
            if (tableContainer) {
                tableContainer.textContent = '';
            }

            const chartCanvas = document.getElementById('ssbPlot');
            if (chartCanvas && chartCanvas._chart) {
                chartCanvas._chart.destroy();
                chartCanvas._chart = null;
            }
            return;
        }

        const nS = computeShrinkageN(p, S, r2cs);
        const nOptimism = computeOptimismN(
            p,
            targetR2Difference,
            r2cs,
            prevPct
        );
        const nRisk = computeRiskPrecisionN(prevPct, riskMargin);
        const nMAPE = (p <= 30) ? computeMapeN(p, targetMAPE, prevPct) : NaN;
        const nOverfitting = Math.max(nS, nOptimism);
        const conceptualCriteria = [
            {
                label: 'Estimating the overall outcome proportion precisely',
                value: nRisk
            },
            {
                label: 'Limiting average prediction error',
                value: nMAPE
            },
            {
                label: 'Limiting overfitting and optimism',
                value: nOverfitting
            }
        ].filter((criterion) => Number.isFinite(criterion.value));
        const nRequired = Math.ceil(
            Math.max(...conceptualCriteria.map((criterion) => criterion.value))
        );

        const nEPV = (targetEPV * p) / prevPct;

        // Update results summary table
        const tableContainer = document.getElementById('ssb-results-table');
        if (tableContainer) {
            const isHighest = (value) =>
                Number.isFinite(value) && Math.ceil(value) === nRequired;
            const mapeValue = Number.isFinite(nMAPE)
                ? formatInt(nMAPE)
                : 'Not available';
            const mapeBoundaryNote = p > 30
                ? `<div class="summary-reference">
                    MAPE applies only through 30 predictor parameters and is omitted here.
                    The change after 30 reflects that limit, not a benefit of adding parameters.
                </div>`
                : '';

            tableContainer.innerHTML = `
                <div class="summary-main">
                    <span class="summary-main-label">Required Sample Size</span>
                    <span class="summary-main-value">N = ${formatInt(nRequired)}</span>
                </div>
                <div class="summary-detail">
                    <p class="summary-detail-header">Based on the maximum of:</p>
                    <div class="summary-detail-row">
                        <div class="summary-item ${isHighest(nRisk) ? 'highlight' : ''}">
                            <span class="item-label">Outcome proportion precision</span>
                            <span class="item-value">${formatInt(nRisk)}</span>
                        </div>
                        <div class="summary-item ${isHighest(nMAPE) ? 'highlight' : ''}">
                            <span class="item-label">MAPE</span>
                            <span class="item-value">${mapeValue}</span>
                        </div>
                        <div class="summary-item ${isHighest(nS) ? 'highlight' : ''}">
                            <span class="item-label">Shrinkage</span>
                            <span class="item-value">${formatInt(nS)}</span>
                        </div>
                        <div class="summary-item ${isHighest(nOptimism) ? 'highlight' : ''}">
                            <span class="item-label">R² optimism</span>
                            <span class="item-value">${formatInt(nOptimism)}</span>
                        </div>
                    </div>
                </div>
                <div class="summary-reference">
                    EPV rule (${targetEPV} events per predictor parameter): N = ${formatInt(nEPV)}.
                </div>
                ${mapeBoundaryNote}
            `;
        }

        // Chart: retain the criterion-specific lines. In particular, MAPE ends
        // at p = 30 rather than producing an artificial drop in a maximum line.
        const xsP = [];
        const ysRisk = [];
        const ysEPV = [];
        const ysMAPE = [];
        const ysShrinkage = [];
        const ysOptimism = [];
        const pMax = p;
        for (let pp = 1; pp <= pMax; pp += 1) {
            xsP.push(pp);
            ysRisk.push(computeRiskPrecisionN(prevPct, riskMargin));
            ysEPV.push((targetEPV * pp) / prevPct);
            ysMAPE.push(
                pp <= 30 ? computeMapeN(pp, targetMAPE, prevPct) : null
            );
            ysShrinkage.push(computeShrinkageN(pp, S, r2cs));
            ysOptimism.push(
                computeOptimismN(pp, targetR2Difference, r2cs, prevPct)
            );
        }
        const series = [
            {
                label: `EPV rule of thumb (${targetEPV})`,
                data: ysEPV,
                borderColor: '#888888',
                pointBackgroundColor: '#888888',
                pointRadius: 5,
                pointStyle: 'circle',
                borderWidth: 2,
                tension: 0.2,
                fill: false
            },
            {
                label: 'Overall outcome proportion precision',
                data: ysRisk,
                borderColor: '#008080',
                pointBackgroundColor: '#008080',
                pointRadius: 5,
                pointStyle: 'circle',
                borderWidth: 2,
                tension: 0.2,
                fill: false
            },
            {
                label: 'Shrinkage',
                data: ysShrinkage,
                borderColor: '#E63946',
                pointBackgroundColor: '#E63946',
                pointRadius: 5,
                pointStyle: 'circle',
                borderWidth: 2,
                tension: 0.2,
                fill: false
            },
            {
                label: 'Average prediction error (MAPE; p ≤ 30)',
                data: ysMAPE,
                borderColor: '#FFA726',
                pointBackgroundColor: '#FFA726',
                pointRadius: 5,
                pointStyle: 'circle',
                borderWidth: 2,
                tension: 0.2,
                spanGaps: false,
                fill: false
            },
            {
                label: 'Nagelkerke R² optimism',
                data: ysOptimism,
                borderColor: '#1E88E5',
                pointBackgroundColor: '#1E88E5',
                pointRadius: 5,
                pointStyle: 'circle',
                borderWidth: 2,
                tension: 0.2,
                fill: false
            }
        ];
        drawMultiLineChart('ssbPlot', xsP, series, '', 'Predictor parameters (p)', p);
    }

    function init(){
        const pairs = [
            ['ssb-p-slider','ssb-p'],
            ['ssb-r2cs-slider','ssb-r2cs'],
            ['ssb-prevalence-slider','ssb-prevalence'],
            ['ssb-epv-slider','ssb-epv'],
            ['ssb-shrinkage-slider','ssb-shrinkage'],
            ['ssb-r2-difference-slider','ssb-r2-difference'],
            ['ssb-risk-margin-slider','ssb-risk-margin'],
            ['ssb-mape-slider','ssb-mape'],
        ];
        pairs.forEach(([a,b])=>syncPair(a,b));
        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset();
        }
        update();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
