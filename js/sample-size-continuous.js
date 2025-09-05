// Continuous outcome sample size calculator (Riley et al., BMJ 2020 + Stat Med 2019)
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

    function formatInt(x){
        if (!isFinite(x) || isNaN(x)) return '-';
        return Math.ceil(Math.max(0, x)).toLocaleString();
    }

    // Criterion 1: target shrinkage via adjusted R2 approximation
    function computeShrinkageN(p, R2, S){
        // Riley et al. formula: n = p / ((S-1) × [ln(1-R²/S)])
        const denominator = (S - 1) * Math.log(1 - R2 / S);
        if (!isFinite(denominator) || denominator <= 0) return NaN;
        return p / denominator;
    }

    // Criterion 2: residual SD precision (N = 234 + p for ≤10% multiplicative error)
    function computeResidualSDN(p){
        return 234 + p;
    }

    // Criterion 3: optimism-based correction (n ≥ 1 + (p * (1 - R²)) / δ)
    function computeOptimismN(p, R, delta){
        return 1 + (p * (1 - R * R)) / delta;
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
        const p = Math.max(1, val('ssc-p'));
        const R2 = Math.max(0.0001, Math.min(0.95, val('ssc-r2')));
        const S = Math.max(0.7, Math.min(0.99, val('ssc-shrinkage')));
        const delta = Math.max(0.001, Math.min(0.1, val('ssc-delta')));

        if ([p,R2,S,delta].some(v=>v==null)) return;

        const nS = computeShrinkageN(p, R2, S);
        const nResidualSD = computeResidualSDN(p);
        const nOptimism = computeOptimismN(p, R2, delta);
        const nRequired = Math.max(nS||0, nResidualSD||0, nOptimism||0);

        setHTML('ssc-n-s', formatInt(nS));
        setHTML('ssc-n-required', formatInt(nRequired));

        // Update results summary table
        const tableContainer = document.getElementById('ssc-results-table');
        if (tableContainer) {
            const isResidualSDHigher = nResidualSD >= (nS || 0) && nResidualSD >= (nOptimism || 0);
            const isSHigher = nS >= (nResidualSD || 0) && nS >= (nOptimism || 0);
            const isOptimismHigher = nOptimism >= (nS || 0) && nOptimism >= (nResidualSD || 0);

            tableContainer.innerHTML = `
                <div class="summary-main">
                    <span class="summary-main-label">Required Sample Size</span>
                    <span class="summary-main-value">N = ${formatInt(nRequired)}</span>
                </div>
                <div class="summary-detail">
                    <p class="summary-detail-header">Based on the maximum of:</p>
                    <div class="summary-detail-row">
                        <div class="summary-item ${isResidualSDHigher ? 'highlight' : ''}">
                            <span class="item-label">Residual SD precision</span>
                            <span class="item-value">${formatInt(nResidualSD)}</span>
                        </div>
                        <div class="summary-item ${isSHigher ? 'highlight' : ''}">
                            <span class="item-label">Shrinkage (S)</span>
                            <span class="item-value">${formatInt(nS)}</span>
                        </div>
                        <div class="summary-item ${isOptimismHigher ? 'highlight' : ''}">
                            <span class="item-label">Optimism (δ)</span>
                            <span class="item-value">${formatInt(nOptimism)}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Chart: superimpose criteria vs p
        const xsP = [];
        const series = [];
        // Use consistent Mahalanobis color palette order
        const palette = ['#008080', '#E63946', '#FFA726', '#1E88E5', '#9C27B0', '#00A896', '#26A69A', '#7B1FA2'];
        const pMax = p;
        const step = Math.max(1, Math.floor(pMax/20));
        const ysS = [], ysResidualSD = [], ysOptimism = [];
        for (let pp = 1; pp <= pMax; pp += step) {
            xsP.push(pp);
            ysS.push(computeShrinkageN(pp, R2, S));
            ysResidualSD.push(computeResidualSDN(pp));
            ysOptimism.push(computeOptimismN(pp, R2, delta));
        }
        // Order series: Residual SD first, Shrinkage second, Optimism third
        series.push({ label: 'Residual SD precision', data: ysResidualSD, borderColor: palette[0], pointBackgroundColor: palette[0], pointRadius: 5, pointStyle: 'circle', borderWidth: 2, tension: 0.2, fill: false });
        series.push({ label: 'Shrinkage (S)', data: ysS, borderColor: palette[1], pointBackgroundColor: palette[1], pointRadius: 5, pointStyle: 'circle', borderWidth: 2, tension: 0.2, fill: false });
        series.push({ label: 'Optimism (δ)', data: ysOptimism, borderColor: palette[2], pointBackgroundColor: palette[2], pointRadius: 5, pointStyle: 'circle', borderWidth: 2, tension: 0.2, fill: false });
        drawMultiLineChart('sscPlot', xsP, series, 'Required sample size by criterion vs predictor parameters (p)', 'Number of predictors (p)', p);
    }

    function init(){
        const pairs = [
            ['ssc-p-slider','ssc-p'],
            ['ssc-r2-slider','ssc-r2'],
            ['ssc-shrinkage-slider','ssc-shrinkage'],
            ['ssc-delta-slider','ssc-delta'],
        ];
        pairs.forEach(([a,b])=>syncPair(a,b));
        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset();
        }
        update();
    }

    document.addEventListener('DOMContentLoaded', init);
})();



