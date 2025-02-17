// Initialize version switching
document.addEventListener('DOMContentLoaded', () => {
    const binaryContainer = document.getElementById('binary-container');
    const continuousContainer = document.getElementById('continuous-container');
    const versionSelect = document.getElementById('version-select');
    
    function cleanupBinaryPlots() {
        // Clean up D3 plots
        d3.select("#overlap-plot").selectAll("svg").remove();
        // Clean up Plotly plots
        Plotly.purge("roc-plot");
        Plotly.purge("pr-plot");
    }
    
    function cleanupContinuousPlots() {
        // Clean up D3 plots
        d3.select("#scatter-plot-true-cont").selectAll("svg").remove();
        d3.select("#scatter-plot-observed-cont").selectAll("svg").remove();
        d3.select("#distribution-plot-true-cont").selectAll("svg").remove();
        d3.select("#distribution-plot-observed-cont").selectAll("svg").remove();
        // Clean up Plotly plots
        Plotly.purge("roc-plot-cont");
    }
    
    // Initial load - start with binary
    binaryContainer.style.display = 'block';
    continuousContainer.style.display = 'none';
    
    // Small delay to ensure DOM is fully ready
    setTimeout(() => {
        cleanupBinaryPlots(); // Clean up first
        initializeBinary();
    }, 0);
    
    // Handle switching
    versionSelect.addEventListener('change', function(e) {
        if (e.target.value === 'continuous') {
            cleanupBinaryPlots();  // Clean up binary plots
            binaryContainer.style.display = 'none';
            continuousContainer.style.display = 'block';
            initializeContinuous();
        } else {
            cleanupContinuousPlots();  // Clean up continuous plots
            continuousContainer.style.display = 'none';
            binaryContainer.style.display = 'block';
            initializeBinary();
        }
    });
}); 