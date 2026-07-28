// Interactive concept tour for the main simulator (binary, then continuous).
(function () {
    const STEPS = [
        {
            mode: 'binary',
            // Pill only - not the full-width mode row
            selector: '#tour-outcomes .global-mode',
            pad: 14,
            title: 'Binary vs continuous outcomes',
            body: 'The simulator has two modes. Binary is for two classes (e.g. case vs control); Continuous is for a graded score (e.g. symptom severity). First, let’s walk through Binary.'
        },
        {
            mode: 'binary',
            selector: '#tour-effect-sizes',
            pad: 18,
            title: 'Effect size',
            body: 'Effect size is how strongly the two groups differ on the predictor. You can enter it as Cohen’s d, U3, an odds ratio, or any of the other metrics listed - they all describe the same difference, so editing one updates the rest. The True and Observed columns are explained in the next steps.'
        },
        {
            mode: 'binary',
            selector: '#tour-reliability',
            pad: 18,
            title: 'Measurement reliability',
            body: 'ICC₁ and ICC₂ are the reliability of the predictor in each group; κ is the reliability of the outcome label (e.g. a diagnosis). The lower these are, the smaller the observed group difference becomes compared to the true one, and the less accurately the predictor can classify anyone.'
        },
        {
            mode: 'binary',
            selector: '#tour-effects',
            pad: 16,
            minWidth: 176,
            minHeight: 48,
            title: 'True vs Observed',
            body: 'This switches everything below between the true effect (what you would see with perfect measurement) and the observed effect (what remains given the reliability values above). Switching back and forth shows how much of the effect measurement error removes.'
        },
        {
            mode: 'binary',
            selector: '#tour-base-rate',
            pad: 18,
            title: 'Base rate (prevalence)',
            body: 'Base rate is how common group 2 is where you will actually use the predictor - not in your study sample. For a given effect size, ROC-AUC stays the same, but PPV does not: if the outcome is rare (e.g. 2%), most people you flag as positive can still be false positives. Set this to the real-world prevalence.'
        },
        {
            mode: 'binary',
            selector: '#tour-threshold',
            pad: 18,
            title: 'Decision threshold',
            body: 'To classify anyone you need a cutoff. pₜ is the predicted probability of belonging to group 2 at that cutoff. A high pₜ requires strong evidence before calling someone positive, so you get fewer false positives but miss more real cases; a low pₜ does the opposite. Which one is right depends on how costly each type of error is.'
        },
        {
            mode: 'binary',
            selector: '#binary-container .main-plot-section',
            pad: 14,
            title: 'Group distributions',
            body: 'Each curve shows how the predictor is distributed within a group. Where the curves overlap, the two groups are indistinguishable, and that overlap is what produces classification errors. The vertical line is the cutoff: everyone above it is classified as positive. Drag it, or change pₜ, to trade false positives against missed cases.'
        },
        {
            mode: 'binary',
            selector: ['#binary-container .roc-pr-section', '#binary-container .dca-section'],
            pad: 10,
            title: 'Discrimination and clinical utility',
            body: 'The ROC curve summarizes how well the predictor separates the groups across all cutoffs, and its AUC does not depend on the base rate. The precision-recall curve does depend on it, so it shows what to expect for a rare outcome. The decision curve goes one step further and asks whether acting on the predictor beats treating everyone or no one.'
        },
        {
            mode: 'binary',
            selector: '#dashboard',
            pad: 14,
            title: 'Performance metrics',
            body: 'These are the metrics at the current cutoff: sensitivity, specificity, PPV, NPV, and others. Changing reliability or base rate makes it clear that they do not move together - PPV in particular depends heavily on the base rate. More metrics are available under “Show more metrics.”'
        },
        {
            mode: 'continuous',
            selector: '#tour-outcomes .global-mode',
            pad: 14,
            title: 'Continuous mode',
            body: 'In this mode the outcome is a graded measure, such as symptom severity or degree of treatment response, rather than a fixed class. Everything you just saw still applies, because the outcome gets split into two groups before the classification metrics are computed.'
        },
        {
            mode: 'continuous',
            selector: '#tour-effect-sizes-cont',
            pad: 18,
            title: 'Continuous effect size',
            body: 'With two continuous variables the effect size is Pearson’s r, or equivalently R², the share of outcome variance the predictor explains. Editing one updates the other. As in binary mode, the Observed column is the value left after measurement error.'
        },
        {
            mode: 'continuous',
            selector: '#tour-reliability-cont',
            pad: 18,
            title: 'Reliability of predictor and outcome',
            body: 'ICCₓ is the reliability of the predictor and ICCᵧ that of the outcome. Both attenuate the correlation you can observe, by a factor of √(ICCₓ × ICCᵧ), so an unreliable outcome limits prediction just as much as an unreliable predictor.'
        },
        {
            mode: 'continuous',
            selector: '#tour-base-rate-cont',
            pad: 18,
            title: 'Dichotomizing the outcome',
            body: 'Decisions are usually binary even when the outcome is not, so the outcome is split into two groups here. The base rate sets where that split falls - a base rate of 20% treats the top 20% as responders, for example - and everything downstream follows from it.'
        },
        {
            mode: 'continuous',
            selector: '#continuous-container .main-plot-section',
            pad: 14,
            title: 'Scatter and group plots',
            body: 'The scatter plot shows the association between predictor and outcome before anything is dichotomized. Below it are the predictor distributions for the two groups created by the split, with the same cutoff you worked with in binary mode.'
        },
        {
            mode: 'continuous',
            selector: ['#continuous-container .roc-pr-section', '#continuous-container .dca-section'],
            pad: 10,
            title: 'The same decision tools',
            body: 'These curves work exactly as in binary mode, and they answer the question that matters in practice: how much use is a correlation of this size once you have to turn it into a yes or no decision about an individual?'
        },
        {
            selector: null,
            title: 'Next steps',
            body: 'That covers the main Binary and Continuous controls. For worked examples and formulas, see Get Started.'
        }
    ];

    let stepIndex = 0;
    let ui = null;
    let isPositioning = false;
    let positionTimer = null;
    let tourTrigger = null;

    function ensureMode(mode) {
        const wantContinuous = mode === 'continuous';
        const binaryBtn = document.getElementById('binary-button');
        const continuousBtn = document.getElementById('continuous-button');
        const binaryContainer = document.getElementById('binary-container');
        const continuousContainer = document.getElementById('continuous-container');

        if (wantContinuous) {
            if (continuousBtn && !continuousBtn.classList.contains('active')) {
                continuousBtn.click();
            }
            if (binaryContainer) binaryContainer.classList.add('u-hidden');
            if (continuousContainer) continuousContainer.classList.remove('u-hidden');
        } else {
            if (binaryBtn && !binaryBtn.classList.contains('active')) {
                binaryBtn.click();
            }
            if (binaryContainer) binaryContainer.classList.remove('u-hidden');
            if (continuousContainer) continuousContainer.classList.add('u-hidden');
        }
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
        if (step.mode) {
            ensureMode(step.mode);
        }
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

        // Mode switch can reflow layout; wait a beat before measuring.
        const settleMs = step.mode ? 80 : 0;
        const afterMode = () => {
            const el = firstTarget(step);
            if (el) {
                el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
                requestAnimationFrame(() => {
                    requestAnimationFrame(finish);
                });
            } else {
                window.scrollTo({ top: 0, behavior: 'auto' });
                requestAnimationFrame(() => {
                    requestAnimationFrame(finish);
                });
            }
        };

        if (settleMs) {
            positionTimer = window.setTimeout(afterMode, settleMs);
        } else {
            afterMode();
        }
    }

    function openTour(trigger) {
        if (ui && !ui.root.hidden) return;

        tourTrigger =
            trigger ||
            (
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null
            );
        ensureMode('binary');
        document.documentElement.classList.add('tour-active');
        ui.root.hidden = false;
        showStep(0);
        requestAnimationFrame(() => {
            ui.popover.focus({ preventScroll: true });
        });
    }

    function closeTour(restoreFocus = true) {
        document.documentElement.classList.remove('tour-active');
        if (ui) {
            ui.spotlight.hidden = true;
            ui.root.hidden = true;
        }

        const returnTarget = restoreFocus
            ? (
                tourTrigger && tourTrigger.isConnected
                    ? tourTrigger
                    : document.querySelector('[data-start-tutorial]')
            )
            : null;
        tourTrigger = null;
        if (returnTarget) {
            requestAnimationFrame(() => {
                returnTarget.focus({ preventScroll: true });
            });
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
            '<div class="tour-popover" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabindex="-1">',
            '  <div class="tour-popover-header">',
            '    <h2 id="tour-title" class="tour-title"></h2>',
            '    <span class="tour-progress"></span>',
            '  </div>',
            '  <p id="tour-body" class="tour-body"></p>',
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
            if (e.key === 'Escape') {
                e.preventDefault();
                closeTour(false);
                return;
            }

            if (e.key === 'Tab') {
                const focusable = Array.from(
                    ui.popover.querySelectorAll(
                        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    )
                );
                if (focusable.length === 0) {
                    e.preventDefault();
                    ui.popover.focus();
                    return;
                }

                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (
                    e.shiftKey &&
                    (
                        document.activeElement === first ||
                        document.activeElement === ui.popover
                    )
                ) {
                    e.preventDefault();
                    last.focus();
                } else if (
                    !e.shiftKey &&
                    document.activeElement === last
                ) {
                    e.preventDefault();
                    first.focus();
                }
                return;
            }

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                next();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                back();
            }
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
                openTour(e.currentTarget);
            });
        });

        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tutorial') === '1' || params.get('tour') === '1') {
                setTimeout(() => openTour(null), 400);
            }
        } catch (err) { /* ignore */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
