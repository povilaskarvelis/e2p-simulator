// Initialize version switching
document.addEventListener('DOMContentLoaded', function() {
    // Get the version buttons
    const binaryButton = document.getElementById('binary-button');
    const continuousButton = document.getElementById('continuous-button');
    
    // Get the container elements
    const binaryContainer = document.getElementById('binary-container');
    const continuousContainer = document.getElementById('continuous-container');
    
    // Track if continuous version has been initialized
    let continuousInitialized = false;
    
    // Initialize the binary version by default
    initializeBinary();
    
    // Handle binary button click
    binaryButton.addEventListener('click', function() {
        binaryButton.classList.add('active');
        continuousButton.classList.remove('active');
        binaryContainer.style.display = 'block';
        continuousContainer.style.display = 'none';
    });

    // Handle continuous button click
    continuousButton.addEventListener('click', function() {
        continuousButton.classList.add('active');
        binaryButton.classList.remove('active');
        binaryContainer.style.display = 'none';
        continuousContainer.style.display = 'block';
        // Initialize continuous version if not already done
        if (!continuousInitialized) {
            initializeContinuous();
            continuousInitialized = true;
        }
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