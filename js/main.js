// parseURLParams is defined in url-params.js (loaded before this script)

// Initialize version switching
document.addEventListener('DOMContentLoaded', function() {
    // Toggle extra metrics inside the dashboard card (control stays outside)
    try {
        document.querySelectorAll('.metrics-toggle[data-dashboard]').forEach((toggle) => {
            const dashboard = document.getElementById(toggle.getAttribute('data-dashboard'));
            const extra = dashboard && dashboard.querySelector('.dashboard-metrics-extra');
            if (!dashboard || !extra) return;

            const sync = () => {
                const open = dashboard.classList.contains('is-expanded');
                extra.hidden = !open;
                toggle.textContent = open ? 'Show less metrics' : 'Show more metrics';
            };
            sync();
            toggle.addEventListener('click', () => {
                dashboard.classList.toggle('is-expanded');
                sync();
            });
        });
    } catch (e) {
        console.error('Error wiring metrics toggles:', e);
    }
    // Mobile detection
    try {
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
        if (isMobile) {
            document.body.classList.add('is-mobile');
        }
    } catch (e) {
        console.error("Error during mobile detection:", e);
    }

    // Helper to toggle sample size sections by mode
    function toggleSampleSizeSections(mode) {
        try {
            const ssBinary = document.getElementById('ss-binary-container');
            const ssCont = document.getElementById('ss-cont-container');
            if (!ssBinary || !ssCont) return;
            if (mode === 'binary') {
                ssBinary.classList.remove('u-hidden');
                ssCont.classList.add('u-hidden');
            } else if (mode === 'continuous') {
                ssBinary.classList.add('u-hidden');
                ssCont.classList.remove('u-hidden');
            }
        } catch (e) {
            console.error('Error toggling sample size sections:', e);
        }
    }

    // Apply score or p_t from URL after model params are in place (p_t preferred).
    function applyThresholdFromParams(params, mode) {
        const ptRaw = params.thresholdProb != null ? params.thresholdProb : params.pt;
        const pt = ptRaw != null ? parseFloat(ptRaw) : NaN;
        if (!isNaN(pt)) {
            const ptInputId = mode === 'continuous' ? 'pt-input-cont' : 'pt-input';
            const ptInput = document.getElementById(ptInputId);
            if (ptInput) {
                ptInput.value = Math.min(Math.max(pt, 0.01), 0.99).toFixed(2);
                ptInput.dispatchEvent(new Event('change'));
            }
            return;
        }
        if (params.thresholdValue == null) return;
        const score = parseFloat(params.thresholdValue);
        if (isNaN(score)) return;
        if (mode === 'continuous' && typeof window.updateThreshold === 'function') {
            window.updateThreshold(score);
        } else {
            const scoreSlider = document.getElementById('threshold-slider');
            if (scoreSlider) {
                scoreSlider.value = score;
                scoreSlider.dispatchEvent(new Event('input'));
            }
        }
    }

    // Set form values based on URL parameters
    function setFormValues(params) {
        // Check if mode is specified
        if (params.mode) {
            if (params.mode === 'binary') {
                // Show binary mode
                binaryButtons.forEach(btn => btn.classList.add('active'));
                continuousButtons.forEach(btn => btn.classList.remove('active'));
                binaryContainer.classList.remove('u-hidden');
                continuousContainer.classList.add('u-hidden');
                toggleSampleSizeSections('binary');
                
                // Set binary mode parameters
                if (params.baseRate) {
                    const parsedBaseRate = parseFloat(params.baseRate);
                    if (!isNaN(parsedBaseRate)) {
                        const percentValue = parsedBaseRate <= 1 ? parsedBaseRate * 100 : parsedBaseRate;
                        const clampedPercent = Math.min(Math.max(percentValue, 0.1), 99.9);
                        document.getElementById('base-rate-number').value = clampedPercent.toFixed(1);
                        document.getElementById('base-rate-slider').value = clampedPercent;
                    }
                }
                
                if (params.groupingReliability) {
                    document.getElementById('kappa-number').value = params.groupingReliability;
                    document.getElementById('kappa-slider').value = params.groupingReliability;
                }
                
                if (params.predictorReliabilityGroup1) {
                    document.getElementById('icc1-number').value = params.predictorReliabilityGroup1;
                    document.getElementById('icc1-slider').value = params.predictorReliabilityGroup1;
                }
                
                if (params.predictorReliabilityGroup2) {
                    document.getElementById('icc2-number').value = params.predictorReliabilityGroup2;
                    document.getElementById('icc2-slider').value = params.predictorReliabilityGroup2;
                }
                
                if (params.trueEffectSize) {
                    document.getElementById('observed-difference-number-bin').value = params.trueEffectSize;
                    document.getElementById('difference-slider').value = params.trueEffectSize;
                    // Trigger update to recalculate all metrics
                    document.getElementById('difference-slider').dispatchEvent(new Event('input'));
                }

                initializeBinary();
                applyThresholdFromParams(params, 'binary');

            } else if (params.mode === 'continuous') {
                // Show continuous mode
                continuousButtons.forEach(btn => btn.classList.add('active'));
                binaryButtons.forEach(btn => btn.classList.remove('active'));
                binaryContainer.classList.add('u-hidden');
                continuousContainer.classList.remove('u-hidden');
                toggleSampleSizeSections('continuous');
                
                // Initialize continuous first, then apply params, then threshold/p_t
                if (!continuousInitialized) {
                    initializeContinuous();
                    continuousInitialized = true;
                }
                
                // Set continuous mode parameters
                if (params.predictorReliability) {
                    document.getElementById('reliability-x-number-cont').value = params.predictorReliability;
                    document.getElementById('reliability-x-slider-cont').value = params.predictorReliability;
                }
                
                if (params.outcomeReliability) {
                    document.getElementById('reliability-y-number-cont').value = params.outcomeReliability;
                    document.getElementById('reliability-y-slider-cont').value = params.outcomeReliability;
                }
                
                if (params.baseRate) {
                    const parsedBaseRate = parseFloat(params.baseRate);
                    if (!isNaN(parsedBaseRate)) {
                        const percentValue = parsedBaseRate <= 1 ? parsedBaseRate * 100 : parsedBaseRate;
                        const clampedPercent = Math.min(Math.max(percentValue, 0.1), 99.9);
                        document.getElementById('base-rate-number-cont').value = clampedPercent.toFixed(1);
                        document.getElementById('base-rate-slider-cont').value = clampedPercent;
                    }
                }
                
                if (params.effectSizeR) {
                    const r = Math.min(Math.max(parseFloat(params.effectSizeR), 0), 0.99);
                    document.getElementById('effect-slider-cont').value = r;
                    document.getElementById('true-pearson-r-cont').value = r.toFixed(2);
                }

                // Sync update after params (avoid debounced input racing thresholdProb)
                if (typeof window.requestImmediateFullUpdate === 'function') {
                    window.requestImmediateFullUpdate();
                } else {
                    document.getElementById('effect-slider-cont').dispatchEvent(new Event('change'));
                }

                applyThresholdFromParams(params, 'continuous');
            }
        }
    }
    
    // Get all the version buttons by their classes
    const binaryButtons = document.querySelectorAll('.binary-mode');
    const continuousButtons = document.querySelectorAll('.continuous-mode');
    
    // Get the container elements
    const binaryContainer = document.getElementById('binary-container');
    const continuousContainer = document.getElementById('continuous-container');
    
    // Track if continuous version has been initialized
    let continuousInitialized = false;
    
    // Initialize the binary version by default
    initializeBinary();
    // Default sample size sections to binary mode on first load
    toggleSampleSizeSections('binary');
    

    
    // Add click handler to all binary buttons
    binaryButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update all buttons
            binaryButtons.forEach(btn => btn.classList.add('active'));
            continuousButtons.forEach(btn => btn.classList.remove('active'));
            
            // Show binary container, hide continuous
            binaryContainer.classList.remove('u-hidden');
            continuousContainer.classList.add('u-hidden');
            toggleSampleSizeSections('binary');
        });
    });

    // Add click handler to all continuous buttons
    continuousButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update all buttons
            continuousButtons.forEach(btn => btn.classList.add('active'));
            binaryButtons.forEach(btn => btn.classList.remove('active'));
            
            // Show continuous container, hide binary
            binaryContainer.classList.add('u-hidden');
            continuousContainer.classList.remove('u-hidden');
            toggleSampleSizeSections('continuous');
            
            // Initialize continuous version if not already done
            if (!continuousInitialized) {
                initializeContinuous();
                continuousInitialized = true;
                applyThresholdFromParams(parseURLParams(), 'continuous');
            }
        });
    });
    
    // Check for URL parameters and set initial values
    const urlParams = parseURLParams();
    if (Object.keys(urlParams).length > 0) {
        setFormValues(urlParams);
    }
    
    // Fetch and display version information (defined in version.js)
    fetchVersionInfo();
});
