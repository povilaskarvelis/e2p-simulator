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
    // Toggle text for metrics collapsibles
    try {
        const toggles = document.querySelectorAll('.metrics-collapsible');
        toggles.forEach(det => {
            const summary = det.querySelector('.metrics-summary');
            if (!summary) return;
            const updateText = () => {
                summary.textContent = det.open ? 'Show less metrics' : 'Show more metrics';
            };
            // Initialize text based on state
            updateText();
            det.addEventListener('toggle', updateText);
        });
    } catch (e) {
        console.error('Error wiring metrics collapsible toggles:', e);
    }
    // Mobile detection
    try {
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
        if (isMobile) {
            document.body.classList.add('is-mobile');
            console.log('Mobile device detected, adding is-mobile class.');
        } else {
             console.log('Desktop device detected.');
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
                ssBinary.style.display = 'flex';
                ssCont.style.display = 'none';
            } else if (mode === 'continuous') {
                ssBinary.style.display = 'none';
                ssCont.style.display = 'flex';
            }
        } catch (e) {
            console.error('Error toggling sample size sections:', e);
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
                binaryContainer.style.display = 'block';
                continuousContainer.style.display = 'none';
                toggleSampleSizeSections('binary');
                
                // Set binary mode parameters
                if (params.baseRate) {
                    document.getElementById('base-rate-number').value = parseFloat(params.baseRate);
                    document.getElementById('base-rate-slider').value = parseFloat(params.baseRate);
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

                // Pass initial threshold if provided
                const initialThreshold = params.thresholdValue ? parseFloat(params.thresholdValue) : undefined;
                // (Re)Initialize binary with potentially new threshold
                initializeBinary(initialThreshold);

            } else if (params.mode === 'continuous') {
                // Show continuous mode
                continuousButtons.forEach(btn => btn.classList.add('active'));
                binaryButtons.forEach(btn => btn.classList.remove('active'));
                binaryContainer.style.display = 'none';
                continuousContainer.style.display = 'block';
                toggleSampleSizeSections('continuous');
                
                // Pass initial threshold if provided
                const initialThreshold = params.thresholdValue ? parseFloat(params.thresholdValue) : undefined;
                
                // Initialize continuous version if needed
                if (!continuousInitialized) {
                    initializeContinuous(initialThreshold);
                    continuousInitialized = true;
                } else if (initialThreshold !== undefined) {
                    // If already initialized but we have a new threshold, update it
                    if (typeof window.updateThreshold === 'function') {
                        window.updateThreshold(initialThreshold);
                    }
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
                    document.getElementById('base-rate-number-cont').value = parseFloat(params.baseRate);
                    document.getElementById('base-rate-slider-cont').value = parseFloat(params.baseRate);
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
            binaryContainer.style.display = 'block';
            continuousContainer.style.display = 'none';
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
            binaryContainer.style.display = 'none';
            continuousContainer.style.display = 'block';
            toggleSampleSizeSections('continuous');
            
            // Initialize continuous version if not already done
            if (!continuousInitialized) {
                // Check for URL threshold parameter
                const urlParams = parseURLParams();
                const initialThreshold = urlParams.thresholdValue ? parseFloat(urlParams.thresholdValue) : undefined;
                initializeContinuous(initialThreshold);
                continuousInitialized = true;
            }
        });
    });
    
    // Check for URL parameters and set initial values
    const urlParams = parseURLParams();
    if (Object.keys(urlParams).length > 0) {
        setFormValues(urlParams);
    }
    
    // Fetch and display version information
    fetchVersionInfo();
}); 

// Function to fetch available versions and populate version selector
async function fetchVersionInfo() {
    try {
        // Fetch all releases (not just latest)
        const response = await fetch('https://api.github.com/repos/povilaskarvelis/e2p-simulator/releases');
        if (response.ok) {
            const releases = await response.json();
            
            // Get the latest release for the footer display
            const latestRelease = releases[0];
            const versionNumber = latestRelease?.tag_name || latestRelease?.name;
            
            // Update the footer version display
            const versionElement = document.getElementById('version-number');
            if (versionElement && versionNumber) {
                versionElement.textContent = versionNumber;
                versionElement.style.color = '#0366d6'; // GitHub blue color
            }
            
            // Populate version selector dropdown
            const versionSelect = document.getElementById('version-select');
            if (versionSelect && releases.length > 0) {
                // Clear existing options except "Latest"
                versionSelect.innerHTML = '<option value="latest">Latest (' + versionNumber + ')</option>';
                
                // Add other releases
                releases.slice(1).forEach(release => {
                    const option = document.createElement('option');
                    option.value = release.tag_name;
                    option.textContent = release.tag_name;
                    versionSelect.appendChild(option);
                });
                
                // Add version change handler
                versionSelect.addEventListener('change', handleVersionChange);
            }
        } else {
            // If API call fails, hide the version info or show fallback
            const versionInfo = document.getElementById('version-info');
            if (versionInfo) {
                versionInfo.style.display = 'none';
            }
        }
    } catch (error) {
        console.log('Could not fetch version info:', error);
        // Hide version info if fetch fails
        const versionInfo = document.getElementById('version-info');
        if (versionInfo) {
            versionInfo.style.display = 'none';
        }
    }
}

// Function to handle version switching
function handleVersionChange(event) {
    const selectedVersion = event.target.value;
    
    if (selectedVersion === 'latest') {
        // Redirect to the main site
        window.location.href = 'https://e2p-simulator.com';
    } else {
        // Construct Netlify branch URL
        // Format: https://version-{version}--e2p-simulator.netlify.app
        // Replace dots with hyphens for Netlify branch naming
        const branchName = selectedVersion.replace(/\./g, '-');
        const netlifyUrl = `https://version-${branchName}--e2p-simulator.netlify.app`;
        
        // Redirect to the version-specific Netlify deployment
        window.location.href = netlifyUrl;
    }
}
