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
        // Check if we're on a mobile device
        const isMobile = window.innerWidth < 768;
        
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
                    'autosize': true,
                    // For mobile, ensure the plot fills the container width
                    'width': isMobile ? plot.offsetWidth : null
                });
            }
        });
        
        // For d3 plots, ensure SVG viewbox is properly set
        const d3Plots = [
            'scatter-plot-true-cont', 'scatter-plot-observed-cont',
            'distribution-plot-true-cont', 'distribution-plot-observed-cont'
        ];
        
        d3Plots.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                const svg = container.querySelector('svg');
                if (svg) {
                    // For mobile, ensure the SVG fills the container
                    if (isMobile) {
                        svg.style.width = '100%';
                        svg.style.height = '100%';
                    }
                }
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
    
    // Also trigger resize when device orientation changes (particularly important for mobile)
    window.addEventListener('orientationchange', function() {
        setTimeout(resizePlotly, 200);
    });
} 