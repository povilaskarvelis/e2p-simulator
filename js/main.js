// Initialize version switching
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Setup responsive behavior for plots
    setupResponsivePlots();

    // Setup range input styling for Firefox
    setupRangeInputs();
}); 

// Function to set up responsive behavior for plots
function setupResponsivePlots() {
    // Debounce function to limit how often resize events are processed
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    // Resize handler for Plotly plots 
    const resizePlotly = debounce(function() {
        const plotlyPlots = document.querySelectorAll('.js-plotly-plot');
        if (plotlyPlots.length > 0) {
            plotlyPlots.forEach(plot => {
                if (plot && plot.layout) {
                    Plotly.relayout(plot, {
                        'autosize': true
                    });
                }
            });
        }
        
        // Resize specific plots by ID
        const plotIds = [
            'overlap-plot', 'roc-plot', 'pr-plot',
            'scatter-plot-true-cont', 'scatter-plot-observed-cont',
            'distribution-plot-true-cont', 'distribution-plot-observed-cont',
            'roc-plot-cont', 'pr-plot-cont'
        ];
        
        plotIds.forEach(id => {
            const plot = document.getElementById(id);
            if (plot && plot._fullLayout) {
                Plotly.relayout(id, {
                    'autosize': true
                });
            }
        });
        
        // Also trigger Chart.js resizing
        if (window.mahalanobisChart) {
            window.mahalanobisChart.resize();
        }
        if (window.r2Chart) {
            window.r2Chart.resize();
        }
    }, 250);
    
    // Add window resize listener
    window.addEventListener('resize', resizePlotly);
    
    // Initial resize to make sure everything is properly sized
    setTimeout(resizePlotly, 100);
} 

// Function to style range inputs for Firefox
function setupRangeInputs() {
    // Only run in Firefox
    if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
        // Get all range inputs
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        
        // For each range input
        rangeInputs.forEach(input => {
            // Set initial value
            updateRangeValue(input);
            
            // Add event listener for input
            input.addEventListener('input', () => {
                updateRangeValue(input);
            });
        });
    }
}

// Function to update range input styling in Firefox
function updateRangeValue(input) {
    const min = input.min ? parseFloat(input.min) : 0;
    const max = input.max ? parseFloat(input.max) : 100;
    const val = parseFloat(input.value);
    const percentage = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--value', percentage + '%');
}

// Add mutation observer to handle dynamically added sliders
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    const sliders = node.querySelectorAll('input[type="range"]');
                    if (sliders.length && navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
                        sliders.forEach(updateRangeValue);
                        sliders.forEach(slider => {
                            slider.addEventListener('input', () => {
                                updateRangeValue(slider);
                            });
                        });
                    }
                }
            });
        }
    });
});

// Start observing the document body for changes
observer.observe(document.body, {
    childList: true,
    subtree: true
}); 