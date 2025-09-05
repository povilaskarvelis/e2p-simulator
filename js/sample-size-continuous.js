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
    // We approximate n ensuring adjusted R2 not too optimistic; closed-form here focuses on delta R2
    function computeOptimismNR2(p, R2, delta){
        // From rearranging adjusted R2 difference <= delta approx
        // n >= p + 1 + p(1 - R2)/delta
        return (p + 1) + (p * (1 - R2)) / Math.max(1e-6, delta);
    }

    // Criterion 2: mean(Y) precision (for intercept)
    function computeMeanPrecisionN(sdY, margin, ci){
        const z = zForCI(ci);
        const m = Math.max(1e-6, margin);
        return (z * sdY / m) * (z * sdY / m);
    }

    // Criterion 3: proxy shrinkage bound using same delta form but with smaller delta equivalent to (1-S)*(1-R2)
    function computeShrinkageN(p, R2, S){
        // Use heuristic: delta_S = (1 - S) * (1 - R2)
        const deltaS = (1 - S) * Math.max(1e-6, (1 - R2));
        return computeOptimismNR2(p, R2, Math.max(1e-6, deltaS));
    }

    function syncPair(sliderId, inputId){
        const s = document.getElementById(sliderId);
        const i = document.getElementById(inputId);
        if (!s || !i) return;
        s.addEventListener('input', () => { i.value = s.value; update(); });
        i.addEventListener('input', () => { s.value = i.value; update(); });
    }

    function drawLineChart(canvasId, xs, ys, chartTitle, xAxisTitle, pVal){
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === 'undefined') return;
        if (ctx._chart) { ctx._chart.destroy(); }

        const xOptions = {
            title: { display: true, text: xAxisTitle, font: { size: 18 } },
            ticks: { font: { size: 14 } },
            grid: { display: false, drawBorder: false }
        };

        if (pVal) {
            xOptions.min = 0;
            xOptions.max = pVal + 1;
            xOptions.type = 'linear';
            xOptions.ticks.callback = function(value) {
                if (value <= 0 || value > pVal) return null;
                if (Number.isInteger(value)) return value;
                return null;
            };

            if (pVal <= 10) {
                xOptions.ticks.stepSize = 1;
            } else {
                xOptions.ticks.maxTicksLimit = 10;
            }
        } else {
            xOptions.ticks.maxTicksLimit = 6;
        }

        const plugins = [];
        if (window.customLegendPlugin) plugins.push(window.customLegendPlugin);
        ctx._chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xs,
                datasets: [{
                    label: chartTitle,
                    data: ys,
                    borderColor: '#28a745',
                    pointBackgroundColor: '#28a745',
                    pointRadius: 4,
                    pointStyle: 'circle',
                    borderWidth: 2,
                    tension: 0.2,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    title: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `n: ${Math.ceil(ctx.parsed.y)}` } }
                },
                scales: {
                    x: xOptions,
                    y: { beginAtZero: true, title: { display: true, text: 'Required n', font: { size: 18 } }, ticks: { font: { size: 14 } }, grid: { display: false, drawBorder: false } }
                }
            },
            plugins
        });
    }

    function update(){
        const p = Math.max(1, val('ssc-p'));
        const R2 = Math.max(0.0001, Math.min(0.95, val('ssc-r2')));
        const S = Math.max(0.7, Math.min(0.99, val('ssc-shrinkage')));
        const delta = Math.max(0.001, Math.min(0.2, val('ssc-delta')));
        const sdY = Math.max(0.01, val('ssc-sdY'));
        const meanMargin = Math.max(0.001, val('ssc-mean-margin'));
        const ci = (document.getElementById('ssc-ci')||{}).value || '0.95';

        if ([p,R2,S,delta,sdY,meanMargin].some(v=>v==null)) return;

        const nShrink = computeShrinkageN(p, R2, S);
        const nR2 = computeOptimismNR2(p, R2, delta);
        const nMean = computeMeanPrecisionN(sdY, meanMargin, ci);
        const nRequired = Math.max(nShrink||0, nR2||0, nMean||0);

        setHTML('ssc-n-s', formatInt(nShrink));
        setHTML('ssc-n-r2', formatInt(nR2));
        setHTML('ssc-n-mean', formatInt(nMean));
        setHTML('ssc-n-required', formatInt(nRequired));

        // Charts: n vs p and n vs R2
        const xsP = [], ysP = [];
        for (let pp = 1; pp <= p; pp += Math.max(1, Math.floor(p/20))) {
            const n1 = computeShrinkageN(pp, R2, S);
            const n2 = computeOptimismNR2(pp, R2, delta);
            xsP.push(pp);
            ysP.push(Math.max(n1||0, n2||0, nMean||0));
        }
        drawLineChart('sscPlotP', xsP, ysP, 'Required sample size vs number of predictor parameters (p)', 'Number of predictor parameters (p)', p);

        const xsR2 = [], ysR2 = [];
        for (let r = 0.05; r <= 0.95; r += 0.05) {
            const n1 = computeShrinkageN(p, r, S);
            const n2 = computeOptimismNR2(p, r, delta);
            xsR2.push(r.toFixed(2));
            ysR2.push(Math.max(n1||0, n2||0, nMean||0));
        }
        drawLineChart('sscPlotR2', xsR2, ysR2, 'Required sample size vs anticipated R²', 'Anticipated R²');
    }

    function init(){
        const pairs = [
            ['ssc-p-slider','ssc-p'],
            ['ssc-r2-slider','ssc-r2'],
            ['ssc-shrinkage-slider','ssc-shrinkage'],
            ['ssc-delta-slider','ssc-delta'],
            ['ssc-sdY-slider','ssc-sdY'],
            ['ssc-mean-margin-slider','ssc-mean-margin'],
        ];
        pairs.forEach(([a,b])=>syncPair(a,b));
        const ci = document.getElementById('ssc-ci');
        if (ci) ci.addEventListener('change', update);
        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset();
        }
        update();
    }

    document.addEventListener('DOMContentLoaded', init);
})();



