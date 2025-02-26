// Initialize version switching
document.addEventListener('DOMContentLoaded', function() {
    // Get the version select dropdown
    const versionSelect = document.getElementById('version-select');
    
    // Get the container elements
    const binaryContainer = document.getElementById('binary-container');
    const continuousContainer = document.getElementById('continuous-container');
    
    // Track if continuous version has been initialized
    let continuousInitialized = false;
    
    // Initialize the binary version by default
    initializeBinary();
    
    // Handle version switching
    versionSelect.addEventListener('change', function() {
        const selectedVersion = versionSelect.value;
        
        if (selectedVersion === 'binary') {
            binaryContainer.style.display = 'block';
            continuousContainer.style.display = 'none';
        } else if (selectedVersion === 'continuous') {
            binaryContainer.style.display = 'none';
            continuousContainer.style.display = 'block';
            // Initialize continuous version if not already done
            if (!continuousInitialized) {
                initializeContinuous();
                continuousInitialized = true;
            }
        }
    });
}); 