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
}); 