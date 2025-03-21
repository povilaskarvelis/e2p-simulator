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
    
}); 
