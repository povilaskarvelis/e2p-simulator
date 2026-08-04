// Continuous outcome sample size calculator (Riley et al., BMJ 2020 + Stat Med 2019)
// Computes the Riley criteria while presenting one educational result

(function(){
    function val(id){
        const el = document.getElementById(id);
        if (!el) return null;
        if (el.tagName === 'SELECT' || el.type === 'select-one') return el.value;
        const v = parseFloat(el.value);
        return isNaN(v) ? null : v;
    }

    function formatInt(x){
        if (!isFinite(x) || isNaN(x)) return '-';
        return Math.ceil(Math.max(0, x)).toLocaleString();
    }

    // Criterion 1: continuous-outcome Copas shrinkage calculation
    function computeShrinkageN(p, R2, S){
        return window.E2PStatCore.continuousShrinkageSampleSize(p, R2, S);
    }

    // Criterion 2: residual SD precision (N = 234 + p for ≤10% multiplicative error)
    function computeResidualSDN(p){
        return 234 + p;
    }

    // Criterion 3: optimism-based correction (n ≥ 1 + (p * (1 - R²)) / δ)
    function computeOptimismN(p, R2, delta){
        return window.E2PStatCore.continuousOptimismSampleSize(p, R2, delta);
    }

    function syncPair(sliderId, inputId){
        const s = document.getElementById(sliderId);
        const i = document.getElementById(inputId);
        if (!s || !i) return;
        const updateTrack = () => {
            if (!s.classList.contains('criterion-slider--continuous-optimism')) return;
            const min = Number(s.min);
            const max = Number(s.max);
            const progress = Math.max(0, Math.min(100,
                ((Number(s.value) - min) / (max - min)) * 100
            ));
            s.style.setProperty('--criterion-slider-progress', `${progress}%`);
        };
        s.addEventListener('input', () => { i.value = s.value; updateTrack(); update(); });
        i.addEventListener('input', () => { s.value = i.value; updateTrack(); update(); });
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
        const pInput = val('ssc-p');
        const r2Input = val('ssc-r2');
        const shrinkageInput = val('ssc-shrinkage');
        const deltaInput = val('ssc-delta');

        if ([pInput, r2Input, shrinkageInput, deltaInput].some(v=>v==null)) return;
        const p = Math.max(1, Math.round(pInput));
        const R2 = Math.max(0.0001, Math.min(0.95, r2Input));
        const S = Math.max(0.7, Math.min(0.99, shrinkageInput));
        const delta = Math.max(0.001, Math.min(0.1, deltaInput));

        const nS = computeShrinkageN(p, R2, S);
        const nResidualSD = computeResidualSDN(p);
        const nOptimism = computeOptimismN(p, R2, delta);
        const nRequired = Math.ceil(Math.max(nS, nResidualSD, nOptimism));

        // Update results summary table
        const tableContainer = document.getElementById('ssc-results-table');
        if (tableContainer) {
            const isHighest = (value) =>
                Number.isFinite(value) && Math.ceil(value) === nRequired;

            tableContainer.innerHTML = `
                <div class="summary-main">
                    <span class="summary-main-label">Required Sample Size</span>
                    <span class="summary-main-value">N = ${formatInt(nRequired)}</span>
                </div>
                <div class="summary-detail">
                    <p class="summary-detail-header">Based on the maximum of:</p>
                    <div class="summary-detail-row">
                        <div class="summary-item ${isHighest(nResidualSD) ? 'highlight' : ''}">
                            <span class="item-label">Residual SD precision</span>
                            <span class="item-value">${formatInt(nResidualSD)}</span>
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
            `;
        }

        // Chart: show how each criterion contributes across model complexity.
        const xsP = [];
        const ysResidualSD = [];
        const ysShrinkage = [];
        const ysOptimism = [];
        const pMax = p;
        const step = Math.max(1, Math.floor(pMax / 20));
        for (let pp = 1; pp <= pMax; pp += step) {
            xsP.push(pp);
            ysResidualSD.push(computeResidualSDN(pp));
            ysShrinkage.push(computeShrinkageN(pp, R2, S));
            ysOptimism.push(computeOptimismN(pp, R2, delta));
        }
        const series = [
            {
                label: 'Residual SD precision',
                data: ysResidualSD,
                borderColor: '#008080',
                pointBackgroundColor: '#008080',
                pointRadius: 5,
                pointStyle: 'circle',
                borderWidth: 2,
                tension: 0.2,
                fill: false
            },
            {
                label: 'Shrinkage (S)',
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
                label: 'Optimism (δ)',
                data: ysOptimism,
                borderColor: '#FFA726',
                pointBackgroundColor: '#FFA726',
                pointRadius: 5,
                pointStyle: 'circle',
                borderWidth: 2,
                tension: 0.2,
                fill: false
            }
        ];
        drawMultiLineChart('sscPlot', xsP, series, '', 'Predictor parameters (p)', p);
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
