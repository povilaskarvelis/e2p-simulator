// Interactive concept tour for the main binary simulator.
(function () {
    const STEPS = [
        {
            // Pill only — not the full-width mode row
            selector: '#tour-outcomes .global-mode',
            pad: 14,
            title: 'Binary vs continuous outcomes',
            body: 'Choose the outcome scale. Binary: two classes or a yes/no event (e.g. case vs control). Continuous: a graded measure (e.g. symptom score).'
        },
        {
            selector: '#tour-effect-sizes',
            pad: 18,
            title: 'Effect size',
            body: 'Set the group separation here. The same separation can be expressed with several metrics (Cohen’s d, U3, odds ratio, point-biserial r, and others)—change any one and the others update to match. The True and Observed columns show the value before and after measurement reliability is applied.'
        },
        {
            selector: '#tour-reliability',
            pad: 18,
            title: 'Measurement reliability',
            body: 'ICC₁ and ICC₂ are predictor reliability in each group; κ is outcome-label reliability. Lower reliability attenuates the observable effect and reduces predictive performance, even when the latent effect is large.'
        },
        {
            selector: '#tour-effects',
            pad: 16,
            minWidth: 176,
            minHeight: 48,
            title: 'True vs Observed',
            body: 'Switch the plot and downstream results between True and Observed effect sizes. True is the ideal case with no measurement error; Observed applies the reliability settings from the previous step.'
        },
        {
            selector: '#tour-base-rate',
            pad: 18,
            title: 'Base rate (prevalence)',
            body: 'Base rate φ is the prevalence of group 2 in the target population (how common the outcome or class is). It changes how the same group separation translates into classification results.'
        },
        {
            selector: '#tour-threshold',
            pad: 18,
            title: 'Decision threshold',
            body: 'Classification requires a cutoff. pₜ is the predicted probability of group 2 at that cutoff, trading false positives against false negatives. The preferred threshold depends on the relative costs of those errors.'
        },
        {
            selector: '#binary-container .main-plot-section',
            pad: 14,
            title: 'Score distributions',
            body: 'This plot shows the predictor distributions for the two groups. The red line is the decision threshold: left of it is classified as group 1, right as group 2. Drag it (or set pₜ) to separate the groups as cleanly as possible.'
        },
        {
            selector: ['#binary-container .roc-pr-section', '#binary-container .dca-section'],
            pad: 10,
            title: 'Discrimination and decisions',
            body: 'ROC summarizes ranking ability independent of prevalence. PR emphasizes positive predictive performance when base rates matter. Decision curves compare model net benefit with treat-all and treat-none across thresholds.'
        },
        {
            selector: '#dashboard',
            pad: 14,
            title: 'Performance metrics',
            body: 'Metrics at the current threshold (accuracy, sensitivity, PPV, and others). Change reliability or base rate to see how they respond. Additional indices are under “Show more metrics.”'
        },
        {
            selector: null,
            title: 'Next steps',
            body: 'That covers the main controls. For worked examples and formulas, see Get Started.'
        }
    ];

    let stepIndex = 0;
    let ui = null;
    let isPositioning = false;
    let positionTimer = null;

    function ensureBinaryMode() {
        const binaryBtn = document.getElementById('binary-button');
        if (binaryBtn && !binaryBtn.classList.contains('active')) {
            binaryBtn.click();
        }
        const binaryContainer = document.getElementById('binary-container');
        const continuousContainer = document.getElementById('continuous-container');
        if (binaryContainer) binaryContainer.classList.remove('u-hidden');
        if (continuousContainer) continuousContainer.classList.add('u-hidden');
    }

    function firstTarget(step) {
        if (!step.selector) return null;
        const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
        for (let i = 0; i < selectors.length; i++) {
            const el = document.querySelector(selectors[i]);
            if (el) return el;
        }
        return null;
    }

    /** Build a padded spotlight rect; supports multiple selectors (union). */
    function resolveSpotlightRect(step) {
        if (!step.selector) return null;
        const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];
        let top = Infinity;
        let left = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        let found = false;

        selectors.forEach((sel) => {
            const el = document.querySelector(sel);
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 && r.height <= 0) return;
            found = true;
            top = Math.min(top, r.top);
            left = Math.min(left, r.left);
            right = Math.max(right, r.right);
            bottom = Math.max(bottom, r.bottom);
        });

        if (!found) return null;

        const pad = step.pad == null ? 8 : step.pad;
        const padX = step.padX == null ? pad : step.padX;
        const padY = step.padY == null ? pad : step.padY;

        left -= padX;
        top -= padY;
        right += padX;
        bottom += padY;

        let width = right - left;
        let height = bottom - top;

        if (step.minWidth && width < step.minWidth) {
            const grow = step.minWidth - width;
            left -= grow / 2;
            width = step.minWidth;
            right = left + width;
        }
        if (step.minHeight && height < step.minHeight) {
            const grow = step.minHeight - height;
            top -= grow / 2;
            height = step.minHeight;
            bottom = top + height;
        }

        // Keep the hole on-screen
        const margin = 4;
        if (left < margin) {
            width -= margin - left;
            left = margin;
        }
        if (top < margin) {
            height -= margin - top;
            top = margin;
        }
        if (left + width > window.innerWidth - margin) {
            width = window.innerWidth - margin - left;
        }
        if (top + height > window.innerHeight - margin) {
            height = window.innerHeight - margin - top;
        }

        return { top: top, left: left, width: width, height: height, bottom: top + height, right: left + width };
    }

    function placeSpotlight(rect) {
        const spot = ui.spotlight;
        if (!rect) {
            spot.hidden = true;
            return;
        }
        spot.hidden = false;
        spot.style.top = Math.round(rect.top) + 'px';
        spot.style.left = Math.round(rect.left) + 'px';
        spot.style.width = Math.round(rect.width) + 'px';
        spot.style.height = Math.round(rect.height) + 'px';
    }

    function placePopover(targetRect) {
        const pop = ui.popover;
        const margin = 12;
        const gap = 10;
        // Measure after content update
        const popW = pop.offsetWidth;
        const popH = pop.offsetHeight;
        let top;
        let left;

        if (!targetRect) {
            top = Math.max(margin, (window.innerHeight - popH) / 2);
            left = Math.max(margin, (window.innerWidth - popW) / 2);
        } else {
            const spaceBelow = window.innerHeight - targetRect.bottom - margin;
            const spaceAbove = targetRect.top - margin;
            // Prefer the side with more room so placement stays stable after centering
            if (spaceBelow >= popH + gap || spaceBelow >= spaceAbove) {
                top = targetRect.bottom + gap;
            } else {
                top = targetRect.top - popH - gap;
            }
            top = Math.max(margin, Math.min(top, window.innerHeight - popH - margin));

            left = targetRect.left + (targetRect.width - popW) / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - popW - margin));
        }

        pop.style.top = Math.round(top) + 'px';
        pop.style.left = Math.round(left) + 'px';
    }

    function layoutStep(step) {
        const rect = resolveSpotlightRect(step);
        placeSpotlight(rect);
        placePopover(rect);
        ui.popover.style.visibility = '';
        ui.popover.style.opacity = '';
    }

    function showStep(index) {
        stepIndex = index;
        const step = STEPS[index];
        const target = firstTarget(step);

        ui.title.textContent = step.title;
        ui.body.textContent = step.body;
        ui.progress.textContent = (index + 1) + ' / ' + STEPS.length;
        ui.back.disabled = index === 0;
        ui.next.textContent = index === STEPS.length - 1 ? 'Done' : 'Next';

        if (positionTimer) {
            window.clearTimeout(positionTimer);
            positionTimer = null;
        }

        // Hide the card while scrolling so it doesn't flash on the wrong side
        isPositioning = true;
        ui.popover.style.visibility = 'hidden';
        ui.popover.style.opacity = '0';

        const finish = () => {
            positionTimer = null;
            if (STEPS[stepIndex] !== step) return;
            layoutStep(step);
            isPositioning = false;
        };

        if (target) {
            // Instant center — avoids the smooth-scroll wait that delayed the card
            target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
            requestAnimationFrame(() => {
                requestAnimationFrame(finish);
            });
        } else {
            window.scrollTo({ top: 0, behavior: 'auto' });
            requestAnimationFrame(() => {
                requestAnimationFrame(finish);
            });
        }
    }

    function openTour() {
        ensureBinaryMode();
        document.documentElement.classList.add('tour-active');
        ui.root.hidden = false;
        showStep(0);
    }

    function closeTour() {
        document.documentElement.classList.remove('tour-active');
        if (ui) {
            ui.spotlight.hidden = true;
            ui.root.hidden = true;
        }
    }

    function next() {
        if (stepIndex >= STEPS.length - 1) {
            closeTour();
            return;
        }
        showStep(stepIndex + 1);
    }

    function back() {
        if (stepIndex <= 0) return;
        showStep(stepIndex - 1);
    }

    function buildUI() {
        const root = document.createElement('div');
        root.id = 'tour-root';
        root.className = 'tour-root';
        root.hidden = true;
        root.innerHTML = [
            '<div class="tour-backdrop" data-tour-action="skip" aria-hidden="true"></div>',
            '<div class="tour-spotlight" hidden aria-hidden="true"></div>',
            '<div class="tour-popover" role="dialog" aria-modal="true" aria-labelledby="tour-title">',
            '  <div class="tour-popover-header">',
            '    <h2 id="tour-title" class="tour-title"></h2>',
            '    <span class="tour-progress"></span>',
            '  </div>',
            '  <p class="tour-body"></p>',
            '  <div class="tour-actions">',
            '    <button type="button" class="tour-btn tour-btn-skip" data-tour-action="skip">Skip</button>',
            '    <div class="tour-actions-right">',
            '      <button type="button" class="tour-btn tour-btn-back" data-tour-action="back">Back</button>',
            '      <button type="button" class="tour-btn tour-btn-next" data-tour-action="next">Next</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(root);

        ui = {
            root: root,
            spotlight: root.querySelector('.tour-spotlight'),
            popover: root.querySelector('.tour-popover'),
            backdrop: root.querySelector('.tour-backdrop'),
            title: root.querySelector('.tour-title'),
            body: root.querySelector('.tour-body'),
            progress: root.querySelector('.tour-progress'),
            back: root.querySelector('[data-tour-action="back"]'),
            next: root.querySelector('[data-tour-action="next"]')
        };

        root.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-tour-action');
            if (action === 'skip') closeTour();
            else if (action === 'next') next();
            else if (action === 'back') back();
        });

        // Backdrop covers the page; forward wheel so the user can still scroll.
        ui.backdrop.addEventListener(
            'wheel',
            (e) => {
                window.scrollBy({ top: e.deltaY, left: 0, behavior: 'auto' });
            },
            { passive: true }
        );

        document.addEventListener('keydown', (e) => {
            if (!document.documentElement.classList.contains('tour-active')) return;
            if (e.key === 'Escape') closeTour();
            else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
            else if (e.key === 'ArrowLeft') back();
        });

        const relayout = () => {
            if (!document.documentElement.classList.contains('tour-active')) return;
            if (isPositioning) return;
            layoutStep(STEPS[stepIndex]);
        };

        window.addEventListener('resize', relayout);
        window.addEventListener('scroll', relayout, { passive: true });
    }

    function init() {
        buildUI();

        document.querySelectorAll('[data-start-tutorial]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openTour();
            });
        });

        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tutorial') === '1' || params.get('tour') === '1') {
                setTimeout(openTour, 400);
            }
        } catch (err) { /* ignore */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
