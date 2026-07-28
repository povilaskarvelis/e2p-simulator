// Small keyboard-usability enhancements shared by the simulator controls.
(function() {
    'use strict';

    function findTooltipLabel(control) {
        const metricRow = control.closest('.index-metric-row');
        if (metricRow) {
            const metricLabel = metricRow.querySelector(
                '.slider-label[data-tooltip]'
            );
            if (metricLabel) return metricLabel;
        }

        const valueRow = control.closest(
            '.slider-value-container, .index-slider-label-row'
        );
        if (valueRow) {
            const valueLabel = valueRow.querySelector(
                '.slider-label[data-tooltip]'
            );
            if (valueLabel) return valueLabel;
        }

        const sliderContainer = control.closest('.slider-container');
        return sliderContainer
            ? sliderContainer.querySelector(
                '.slider-label[data-tooltip]'
            )
            : null;
    }

    function connectTooltip(control) {
        const tooltip = findTooltipLabel(control);
        if (!tooltip) return;

        control.keyboardTooltip = tooltip;
        control.addEventListener('focus', function() {
            tooltip.classList.remove('keyboard-tooltip-suppressed');
            tooltip.classList.add('keyboard-tooltip-active');
        });
        control.addEventListener('blur', function() {
            tooltip.classList.remove(
                'keyboard-tooltip-active',
                'keyboard-tooltip-suppressed'
            );
        });
    }

    function dismissTooltip(event) {
        if (event.key !== 'Escape') return;

        const control = document.activeElement;
        const tooltip = control && control.keyboardTooltip;
        if (!tooltip) return;

        tooltip.classList.remove('keyboard-tooltip-active');
        tooltip.classList.add('keyboard-tooltip-suppressed');
    }

    function initialize() {
        document
            .querySelectorAll(
                'input:not([type="hidden"]), select, textarea'
            )
            .forEach(connectTooltip);
        document.addEventListener('keydown', dismissTooltip);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
