// Parse URL parameters
function parseURLParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    
    for (let i = 0; i < pairs.length; i++) {
        if (!pairs[i]) continue;
        
        const pair = pairs[i].split('=');
        const key = decodeURIComponent(pair[0]);
        const value = decodeURIComponent(pair[1] || '');
        
        params[key] = value;
    }
    
    return params;
}

// Initialize version switching
document.addEventListener('DOMContentLoaded', function() {
    // Set form values based on URL parameters
    function setFormValues(params) {
        // Check if mode is specified
        if (params.mode) {
            if (params.mode === 'binary') {
                // Show binary mode
                binaryButtons.forEach(btn => btn.classList.add('active'));
                continuousButtons.forEach(btn => btn.classList.remove('active'));
                binaryContainer.style.display = 'block';
                continuousContainer.style.display = 'none';
                
                // Set binary mode parameters
                if (params.baseRate) {
                    document.getElementById('base-rate-number').value = parseFloat(params.baseRate) * 100;
                    document.getElementById('base-rate-slider').value = parseFloat(params.baseRate) * 100;
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
            } else if (params.mode === 'continuous') {
                // Show continuous mode
                continuousButtons.forEach(btn => btn.classList.add('active'));
                binaryButtons.forEach(btn => btn.classList.remove('active'));
                binaryContainer.style.display = 'none';
                continuousContainer.style.display = 'block';
                
                // Initialize continuous version if needed
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
                    document.getElementById('base-rate-number-cont').value = parseFloat(params.baseRate) * 100;
                    document.getElementById('base-rate-slider-cont').value = parseFloat(params.baseRate) * 100;
                }
                
                if (params.effectSizeR) {
                    // Convert R² to r
                    document.getElementById('effect-slider-cont').value = parseFloat(params.effectSizeR);
                    
                    // Set true Pearson's r directly to match the R² value
                    document.getElementById('true-pearson-r-cont').value = parseFloat(params.effectSizeR).toFixed(2);
                    
                    // Trigger update to recalculate all metrics
                    document.getElementById('effect-slider-cont').dispatchEvent(new Event('input'));
                }
            }
        }
    }
    
    // Detect touch devices and add class to body
    function isTouchDevice() {
        return (('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0));
    }
    
    if (isTouchDevice()) {
        document.body.classList.add('touch-device');
        
        // For improved touch experience on tooltip elements
        document.querySelectorAll('[data-tooltip]').forEach(el => {
            el.addEventListener('touchstart', function(e) {
                // Toggle a class to show/hide tooltip on touch
                this.classList.toggle('tooltip-active');
                e.preventDefault();
            });
        });
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
    
    // Add click handler to all binary buttons
    binaryButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update all buttons
            binaryButtons.forEach(btn => btn.classList.add('active'));
            continuousButtons.forEach(btn => btn.classList.remove('active'));
            
            // Show binary container, hide continuous
            binaryContainer.style.display = 'block';
            continuousContainer.style.display = 'none';
        });
    });

    // Add click handler to all continuous buttons
    continuousButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update all buttons
            continuousButtons.forEach(btn => btn.classList.add('active'));
            binaryButtons.forEach(btn => btn.classList.remove('active'));
            
            // Show continuous container, hide binary
            binaryContainer.style.display = 'none';
            continuousContainer.style.display = 'block';
            
            // Initialize continuous version if not already done
            if (!continuousInitialized) {
                initializeContinuous();
                continuousInitialized = true;
            }
        });
    });
    
    // Check for URL parameters and set initial values
    const urlParams = parseURLParams();
    if (Object.keys(urlParams).length > 0) {
        setFormValues(urlParams);
    }
}); 
