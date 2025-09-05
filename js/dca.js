(function() {
// DCA Module - Simplified Decision Curve Analysis implementation
const DCAModule = {
    // State variables for each DCA instance
    instances: new Map(),
    
    // Initialize a DCA instance
    init: function(instanceId, config) {
        this.instances.set(instanceId, {
            plotSelector: config.plotSelector,
            initialized: false,
            onThresholdChange: config.onThresholdChange || (() => {})
        });
    },
    
    // Plot DCA for a given instance
    plot: function(instanceId, data) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            console.error(`DCA instance ${instanceId} not found`);
            return;
        }
        
        // Disable the default tooltip for DCA plots and ensure overflow is allowed
        const plotElement = document.getElementById(instance.plotSelector);
        if (plotElement && plotElement.hasAttribute('data-tooltip')) {
            plotElement.removeAttribute('data-tooltip');
        }
        
        // Ensure parent containers allow overflow for tooltips
        if (plotElement) {
            plotElement.style.overflow = 'visible';
            // Also check parent containers that might clip the tooltip
            let parent = plotElement.parentElement;
            while (parent && parent.classList && (parent.classList.contains('dca-section') || parent.classList.contains('results-container') || parent.classList.contains('plot-container'))) {
                parent.style.overflow = 'visible';
                parent = parent.parentElement;
            }
        }
        
        try {
            const {
                sensitivity,
                specificity,
                baseRate,
                // ROC curve data for proper DCA calculation
                FPR,
                TPR,
                thresholds
            } = data;
            
            // Calculate net benefit across threshold probabilities using current model performance
            const ptMin = 0.001;
            const ptMax = 0.999;
            const step = 0.001;
            
            const thresholdProbs = [];
            const netBenefits = [];
            const treatAllBenefits = [];
            const treatNoneBenefits = [];
            
            for (let pt = ptMin; pt <= ptMax; pt += step) {
                const odds = pt / (1 - pt);
                
                // Calculate sensitivity and specificity at threshold probability pt
                let sensitivityAtPt, specificityAtPt;
                
                if (FPR && TPR && FPR.length > 0 && TPR.length > 0) {
                    // Use ROC curve data to find sensitivity and specificity at threshold pt
                    // In DCA, pt represents the probability threshold for classification
                    // We need to interpolate sensitivity and specificity from the ROC curve
                    
                    // For DCA, we need to find the point on the ROC curve that corresponds
                    // to using pt as the classification threshold
                    // This is a complex mapping that depends on the underlying prediction model
                    
                    // As a first approximation, we'll use the relationship:
                    // pt = 0 (treat everyone) -> FPR = 1, TPR = 1
                    // pt = 1 (treat no one) -> FPR = 0, TPR = 0
                    // Linear interpolation: targetFPR = 1 - pt
                    const targetFPR = 1 - pt;
                    
                    // Find the two closest points for interpolation
                    let lowerIndex = 0;
                    let upperIndex = FPR.length - 1;
                    
                    for (let i = 0; i < FPR.length - 1; i++) {
                        if (FPR[i] >= targetFPR && FPR[i + 1] <= targetFPR) {
                            lowerIndex = i;
                            upperIndex = i + 1;
                            break;
                        }
                    }
                    
                    // Linear interpolation
                    const fpr1 = FPR[lowerIndex];
                    const fpr2 = FPR[upperIndex];
                    const tpr1 = TPR[lowerIndex];
                    const tpr2 = TPR[upperIndex];
                    
                    if (fpr1 === fpr2) {
                        sensitivityAtPt = tpr1;
                        specificityAtPt = 1 - fpr1;
                    } else {
                        const weight = (targetFPR - fpr1) / (fpr2 - fpr1);
                        sensitivityAtPt = tpr1 + weight * (tpr2 - tpr1);
                        specificityAtPt = 1 - targetFPR;
                    }
                } else {
                    // Fallback to provided sensitivity/specificity if ROC data not available
                    sensitivityAtPt = sensitivity;
                    specificityAtPt = specificity;
                }
                
                const netBenefit = (sensitivityAtPt * baseRate) - ((1 - specificityAtPt) * (1 - baseRate) * odds);
                
                // Calculate treat all strategy: treat everyone regardless of test result
                // TP = all cases, FP = all controls
                const treatAllBenefit = baseRate - ((1 - baseRate) * odds);
                
                thresholdProbs.push(pt);
                netBenefits.push(netBenefit); // Allow negative net benefit
                treatAllBenefits.push(treatAllBenefit); // Allow negative net benefit for treat all
                treatNoneBenefits.push(0); // Treat none = 0
            }
            
            // Calculate Delta NB (Net Benefit) - difference between predictor and best default strategy
            const deltaNB = [];
            for (let i = 0; i < thresholdProbs.length; i++) {
                const predictorNB = netBenefits[i];
                const treatAllNB = treatAllBenefits[i];
                const treatNoneNB = 0; // Treat none is always 0
                
                // Find the better of the two default strategies
                const bestDefaultNB = Math.max(treatAllNB, treatNoneNB);
                
                // Delta NB is the difference between predictor and best default strategy
                deltaNB.push(predictorNB - bestDefaultNB);
            }
            
            // Calculate Delta NB and NR_100 at current threshold position
            let currentDeltaNB = 0;
            let currentNR100 = 0;
            let formattedDeltaNB = "0.000";
            
            if (data.currentThreshold !== undefined && data.currentMetrics !== undefined) {
                const currentMetrics = data.currentMetrics;
                const currentThreshold = data.currentThreshold;
                
                // Scale the classification threshold to 0-1 range for threshold probability
                // Use the actual threshold range from the data
                const thresholdMin = data.thresholdRange ? data.thresholdRange.min : -4;
                const thresholdMax = data.thresholdRange ? data.thresholdRange.max : 4;
                const thresholdProbability = Math.max(0, Math.min(1, (currentThreshold - thresholdMin) / (thresholdMax - thresholdMin)));
                
                // Find the closest point to current threshold
                let closestIndex = 0;
                let minDiff = Math.abs(thresholdProbs[0] - thresholdProbability);
                
                for (let i = 1; i < thresholdProbs.length; i++) {
                    const diff = Math.abs(thresholdProbs[i] - thresholdProbability);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                    }
                }
                
                currentDeltaNB = deltaNB[closestIndex];
                // NR_100 = Delta NB * (1-t)/t * 100 (net reduction per 100 patients)
                const thresholdProb = thresholdProbs[closestIndex];
                currentNR100 = currentDeltaNB * ((1 - thresholdProb) / thresholdProb) * 100;
            } else {
                // Fallback to maximum values if no current threshold
                currentDeltaNB = Math.max(...deltaNB);
                // Find the threshold probability corresponding to max Delta NB
                const maxIndex = deltaNB.indexOf(currentDeltaNB);
                const thresholdProb = thresholdProbs[maxIndex];
                currentNR100 = currentDeltaNB * ((1 - thresholdProb) / thresholdProb) * 100;
            }
            
            // Format Delta NB for display
            formattedDeltaNB = Math.abs(currentDeltaNB) < 0.001 ? 
                currentDeltaNB.toExponential(2) : 
                currentDeltaNB.toFixed(3);
            
            // Create traces
            const dcaTrace = {
                x: thresholdProbs,
                y: netBenefits,
                type: "scatter",
                mode: "lines",
                name: "Predictor",
                line: { color: "black", width: 2 },
                showlegend: false,
            };
            
            const treatAllTrace = {
                x: thresholdProbs,
                y: treatAllBenefits,
                type: "scatter",
                mode: "lines",
                name: "All",
                line: { color: "#666666", dash: "dash" },
                showlegend: true,
            };
            
            const treatNoneTrace = {
                x: thresholdProbs,
                y: treatNoneBenefits,
                type: "scatter",
                mode: "lines",
                name: "None",
                line: { color: "#999999", dash: "dot" },
                showlegend: true,
            };
            
            // Add threshold marker - convert classification threshold to threshold probability
            let thresholdMarker = null;
            if (data.currentThreshold !== undefined && data.currentMetrics !== undefined) {
                const currentThreshold = data.currentThreshold;
                const currentMetrics = data.currentMetrics;
                
                // Scale the classification threshold to 0-1 range for threshold probability
                // Use the actual threshold range from the data
                const thresholdMin = data.thresholdRange ? data.thresholdRange.min : -4;
                const thresholdMax = data.thresholdRange ? data.thresholdRange.max : 4;
                const thresholdProbability = Math.max(0, Math.min(1, (currentThreshold - thresholdMin) / (thresholdMax - thresholdMin)));
                
                // Find the closest point on the DCA curve to this threshold probability
                let closestIndex = 0;
                let minDiff = Math.abs(thresholdProbs[0] - thresholdProbability);
                
                for (let i = 1; i < thresholdProbs.length; i++) {
                    const diff = Math.abs(thresholdProbs[i] - thresholdProbability);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                    }
                }
                
                thresholdMarker = {
                    x: [thresholdProbs[closestIndex]],
                    y: [netBenefits[closestIndex]],
                type: "scatter",
                mode: "markers",
                    marker: { color: "red", size: 10 },
                    name: "Current Threshold",
                    showlegend: false,
                };
            }
            
            const dcaLayout = {
                xaxis: { 
                    title: "Threshold probability", 
                    range: [0, 1], 
                    showgrid: false,
                    showline: false,
                    titlefont: { size: 15 },
                    tickformat: ".1f",
                    dtick: 0.2
                },
                yaxis: { 
                    title: "Net benefit", 
                    showgrid: false, 
                    zeroline: false,
                    titlefont: { size: 15 }
                },
                showlegend: true,
                legend: {
                    orientation: "h",
                    x: 0.5,
                    y: 1.005,
                    xanchor: "center",
                    yanchor: "bottom"
                },
                margin: { t: 2, l: 50, r: 30, b: 40 },
                font: { size: 12 },
                annotations: [{
                    x: 0.95,
                    y: 0.95,
                    xref: "paper",
                    yref: "paper",
                    text: `ΔNB: ${formattedDeltaNB}<br>NR<sub>100</sub>: ${currentNR100.toFixed(1)}`,
                    showarrow: false,
                    font: { size: 16, color: "black", weight: "bold" },
                    align: "right",
                }],
                autosize: true,
            };
            
            const config = { 
                staticPlot: true,
                responsive: true,
                displayModeBar: false
            };
            
            // Build traces array, including threshold marker if available
            const traces = [treatAllTrace, treatNoneTrace, dcaTrace];
            if (thresholdMarker) {
                traces.push(thresholdMarker);
            }
            
            if (!instance.initialized) {
                Plotly.newPlot(instance.plotSelector, traces, dcaLayout, config);
                instance.initialized = true;
            } else {
                Plotly.react(instance.plotSelector, traces, dcaLayout, config);
            }
            
            // Calculate dynamic y-axis range based on data and threshold marker
            let allValues = [...netBenefits, ...treatAllBenefits, 0];
            
            // Include threshold marker position if it exists
            if (thresholdMarker !== null) {
                allValues.push(thresholdMarker.y[0]);
            }
            
            const dataMin = Math.min(...allValues);
            const dataMax = Math.max(...allValues);
            
            // Set reasonable y-axis bounds with strict limits
            const yAxisMin = Math.max(-0.1, dataMin); // Cap at -0.1 maximum
            const yAxisMax = Math.max(0.1, dataMax + 0.05); // Ensure at least 0.1 range
            
            // Update the y-axis range after the plot is rendered
            Plotly.relayout(instance.plotSelector, {
                'yaxis.range': [yAxisMin, yAxisMax]
            });
            
        } catch (error) {
            console.error("Error plotting DCA:", error);
        }
    },
    
    // Clean up a DCA instance
    cleanup: function(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            const plotElement = document.getElementById(instance.plotSelector);
            if (plotElement) {
                Plotly.purge(instance.plotSelector);
            }
            this.instances.delete(instanceId);
        }
    }
};

// Export to global scope
window.DCAModule = DCAModule;

})(); 