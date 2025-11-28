// Binary outcome sample size calculator (Riley et al., BMJ 2020)
// Computes n from three criteria and displays summary + simple charts

(function(){
    function zForCI(ci){
        const level = parseFloat(ci);
        if (level >= 0.999) return 3.29;
        if (level >= 0.99) return 2.576;
        if (level >= 0.95) return 1.96;
        if (level >= 0.90) return 1.645;
        return 1.96;
    }

    function clamp01(x){ return Math.max(0, Math.min(1, x)); }

    function computeShrinkageN(p, S, r2cs){
        // Riley et al. formula: n = p / ((S-1) × [ln(1-R²_CS/S)])
        const denominator = (S - 1) * Math.log(1 - r2cs / S);
        if (!isFinite(denominator) || denominator <= 0) return NaN;
        return p / denominator;
    }

    function computeOptimismN(p, delta, r2cs){
        const k = -Math.log(1 - r2cs);
        if (!isFinite(k) || k <= 0) return NaN;
        return p / (delta * k);
    }

    // Removed mean risk precision criterion from calculations/plots

    // Mean absolute prediction error criterion (B2) based on van Smeden et al. (2016)
    // ln(MAPE) = -0.508 - 0.544 ln(n) + 0.259 ln(phi) + 0.504 ln(P)
    // => n = exp(( -0.508 + 0.259 ln(phi) + 0.504 ln(P) - ln(MAPE) ) / 0.544)
    function computeMapeN(p, targetMape, phi){
        const P = Math.max(1, p);
        const mape = Math.max(1e-6, targetMape);
        // Ensure phi <= 0.5 by symmetry
        let phiEff = Math.max(1e-6, Math.min(phi, 1 - phi));
        // Only validated for P <= 30
        if (P > 30) return NaN;
        const num = -0.508 + 0.259 * Math.log(phiEff) + 0.504 * Math.log(P) - Math.log(mape);
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

    function setHTML(id, text){
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function syncPair(sliderId, inputId){
        const s = document.getElementById(sliderId);
        const i = document.getElementById(inputId);
        if (!s || !i) return;
        s.addEventListener('input', () => { i.value = s.value; update(); });
        i.addEventListener('input', () => { s.value = i.value; update(); });
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
        const p = val('ssb-p');
        const r2cs = Math.max(0.0001, Math.min(0.9, val('ssb-r2cs')));
        const prevInput = val('ssb-prevalence');
        const S = Math.max(0.7, Math.min(0.99, val('ssb-shrinkage')));
        const delta = Math.max(0.001, Math.min(0.2, val('ssb-delta')));
        // mean risk precision inputs removed
        const targetEPP = Math.max(1, val('ssb-epp')) || 10;
        const targetMAPE = Math.max(0.001, val('ssb-mape') || 0.05);

        if (p == null || r2cs == null || prevInput == null || S == null || delta == null) return;
        const prevPct = Math.max(0.001, Math.min(0.999, percentageToFraction(prevInput)));

        const nS = computeShrinkageN(p, S, r2cs);
        const nMAPE = (p <= 30) ? computeMapeN(p, targetMAPE, prevPct) : 0;
        const nRequired = Math.max(nS||0, nMAPE||0);

        setHTML('ssb-n-s', formatInt(nS));
        // Removed R² optimism output
        setHTML('ssb-n-required', formatInt(nRequired));

        const events = (nRequired * prevPct);
        const nonevents = nRequired - events;
        const epp = events / Math.max(1, p);
        setHTML('ssb-events', formatInt(events));
        setHTML('ssb-nonevents', formatInt(nonevents));
        setHTML('ssb-epp', isFinite(epp) ? (Math.floor(epp*10)/10).toString() : '-');

        // Update results summary table
        const tableContainer = document.getElementById('ssb-results-table');
        if (tableContainer) {
            const nEPP = (targetEPP * p) / Math.max(1e-6, prevPct);
            const isSHigher = nS >= (nMAPE || 0);
            const isMAPEHigher = !isSHigher;

            tableContainer.innerHTML = `
                <div class="summary-main">
                    <span class="summary-main-label">Required Sample Size</span>
                    <span class="summary-main-value">N = ${formatInt(nRequired)}</span>
                </div>
                <div class="summary-detail">
                    <p class="summary-detail-header">Based on the maximum of:</p>
                    <div class="summary-detail-row">
                        <div class="summary-item ${isSHigher ? 'highlight' : ''}">
                            <span class="item-label">Shrinkage (S)</span>
                            <span class="item-value">${formatInt(nS)}</span>
                        </div>
                        <div class="summary-item ${isMAPEHigher ? 'highlight' : ''}">
                            <span class="item-label">MAPE (&delta;)</span>
                            <span class="item-value">${formatInt(nMAPE)}</span>
                        </div>
                    </div>
                </div>
                <div class="summary-reference">
                    <span class="ref-label">EPV = ${targetEPP} (for reference only):</span>
                    <span class="ref-value">N = ${formatInt(nEPP)}</span>
                </div>
            `;
        }

        // Chart: superimpose 4 criteria vs p
        const xsP = [];
        const series = [];
        // Use consistent Mahalanobis color palette order
        const palette = ['#888888', '#008080', '#E63946', '#FFA726', '#1E88E5', '#9C27B0', '#00A896', '#26A69A', '#7B1FA2'];
        const pMax = p;
        const step = Math.max(1, Math.floor(pMax/20));
        const ysS = [], ysEPP = [], ysMAPE = [];
        for (let pp = 1; pp <= pMax; pp += step) {
            xsP.push(pp);
            ysS.push(computeShrinkageN(pp, S, r2cs));
            // Reference: EPP target => n = EPP * p / prevalence
            ysEPP.push((targetEPP * pp) / Math.max(1e-6, prevPct));
            ysMAPE.push(pp <= 30 ? computeMapeN(pp, targetMAPE, prevPct) : NaN);
        }
        // Order series so EPV appears first, Shrinkage second, MAPE third, all using palette
        series.push({ label: `EPV (${targetEPP})`, data: ysEPP, borderColor: palette[0], pointBackgroundColor: palette[0], pointRadius: 5, pointStyle: 'circle', borderWidth: 2, tension: 0.2, fill: false });
        series.push({ label: 'Shrinkage (S)', data: ysS, borderColor: palette[1], pointBackgroundColor: palette[1], pointRadius: 5, pointStyle: 'circle', borderWidth: 2, tension: 0.2, fill: false });
        series.push({ label: 'MAPE (δ)', data: ysMAPE, borderColor: palette[2], pointBackgroundColor: palette[2], pointRadius: 5, pointStyle: 'circle', borderWidth: 2, tension: 0.2, fill: false });
        drawMultiLineChart('ssbPlot', xsP, series, 'Required sample size by criterion vs predictor parameters (p)', 'Number of predictors (p)', p);
    }

    function init(){
        const pairs = [
            ['ssb-p-slider','ssb-p'],
            ['ssb-r2cs-slider','ssb-r2cs'],
            ['ssb-prevalence-slider','ssb-prevalence'],
            ['ssb-shrinkage-slider','ssb-shrinkage'],
            ['ssb-delta-slider','ssb-delta'],
            ['ssb-margin-slider','ssb-margin'],
            ['ssb-epp-slider','ssb-epp'],
            ['ssb-mape-slider','ssb-mape'],
        ];
        pairs.forEach(([a,b])=>syncPair(a,b));
        const ci = document.getElementById('ssb-ci');
        if (ci) ci.addEventListener('change', update);
        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset();
        }
        update();
    }

    document.addEventListener('DOMContentLoaded', init);
})();



