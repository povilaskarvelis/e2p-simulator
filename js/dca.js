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
        // Reset smoothing values for clean start
        this.lastPtValue = undefined;
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
            
            // Debug: log the current threshold and metrics
            console.log('DCA Debug:', {
                currentThreshold: data.currentThreshold,
                currentMetrics: data.currentMetrics ? {
                    sensitivity: data.currentMetrics.sensitivity,
                    specificity: data.currentMetrics.specificity
                } : 'undefined'
            });
            
            // Calculate net benefit across threshold probabilities using current model performance
            // Use higher precision when precise estimates are enabled
            const usePrecise = data.usePreciseEstimates || false;
            const ptMin = 0.001;
            const ptMax = 0.95;  // Further reduce upper limit for smoother curves
            const step = usePrecise ? 0.0001 : 0.001; // Much finer step when precise
            
            const thresholdProbs = [];
            const netBenefits = [];
            const treatAllBenefits = [];
            const treatNoneBenefits = [];
            
            for (let pt = ptMin; pt <= ptMax; pt += step) {
                const odds = pt / (1 - pt);
                
                // Calculate optimal sensitivity and specificity for this pt
                let bestNetBenefit = -Infinity;
                let sensitivityAtPt = 0;
                let specificityAtPt = 0;
                
                if (FPR && TPR && FPR.length > 0 && TPR.length > 0) {
                    // For each point on the ROC curve, calculate net benefit for this pt
                    // Choose the point that gives the highest net benefit
                    for (let i = 0; i < FPR.length; i++) {
                        const currentSensitivity = TPR[i];
                        const currentSpecificity = 1 - FPR[i];
                        
                        // Calculate net benefit for this ROC point at this pt
                        const netBenefit = (currentSensitivity * baseRate) - ((1 - currentSpecificity) * (1 - baseRate) * odds);
                        
                        // Keep the ROC point that gives the highest net benefit
                        if (netBenefit > bestNetBenefit) {
                            bestNetBenefit = netBenefit;
                            sensitivityAtPt = currentSensitivity;
                            specificityAtPt = currentSpecificity;
                        }
                    }
                } else {
                    // Fallback to provided sensitivity/specificity if no ROC data
                    sensitivityAtPt = sensitivity;
                    specificityAtPt = specificity;
                    bestNetBenefit = (sensitivityAtPt * baseRate) - ((1 - specificityAtPt) * (1 - baseRate) * odds);
                }
                
                // Calculate treat all strategy: treat everyone regardless of test result
                // TP = all cases, FP = all controls
                const treatAllBenefit = baseRate - ((1 - baseRate) * odds);
                
                thresholdProbs.push(pt);
                netBenefits.push(bestNetBenefit);
                treatAllBenefits.push(treatAllBenefit);
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
            let formattedDeltaNB = "0.000";
            let currentThresholdProb = 0;
            
            if (data.currentThreshold !== undefined && data.currentMetrics !== undefined) {
                const currentMetrics = data.currentMetrics;
                const currentThreshold = data.currentThreshold;
                
                // For the red marker, we need to find which pt value corresponds to the current classification threshold
                // Use a more direct approach: find the pt where the current sensitivity/specificity would be optimal
                
                // Calculate the current threshold's net benefit for each pt value
                let bestPt = 0.5;
                let bestDelta = Infinity;
                let closestIndex = 0;
                
                // More stable approach: use direct mathematical calculation
                // The pt value where current sensitivity/specificity would be optimal can be calculated directly
                
                if (FPR && TPR && FPR.length > 0 && TPR.length > 0) {
                    // Find the closest ROC point to current sensitivity/specificity
                    let rocIndex = 0;
                    let minROCDist = Infinity;
                    
                    for (let i = 0; i < FPR.length; i++) {
                        const rocSens = TPR[i];
                        const rocSpec = 1 - FPR[i];
                        const dist = Math.sqrt(
                            Math.pow(rocSens - currentMetrics.sensitivity, 2) + 
                            Math.pow(rocSpec - currentMetrics.specificity, 2)
                        );
                        
                        if (dist < minROCDist) {
                            minROCDist = dist;
                            rocIndex = i;
                        }
                    }
                    
                    // Use the closest ROC point for stable calculation
                    const targetSens = TPR[rocIndex];
                    const targetSpec = 1 - FPR[rocIndex];
                    
                    // Calculate the net benefit of this ROC point for each pt
                    // and find where it matches the DCA curve (which is the envelope of all ROC points)
                    let bestMatch = Infinity;
                    for (let i = 0; i < thresholdProbs.length; i++) {
                        const pt = thresholdProbs[i];
                        const odds = pt / (1 - pt);
                        
                        // Net benefit of target ROC point at this pt
                        const targetNB = (targetSens * baseRate) - ((1 - targetSpec) * (1 - baseRate) * odds);
                        
                        // How close is this to the DCA curve value?
                        const diff = Math.abs(targetNB - netBenefits[i]);
                        
                        if (diff < bestMatch) {
                            bestMatch = diff;
                            bestPt = pt;
                            closestIndex = i;
                        }
                    }
                    
                    // Use high-precision interpolation for much finer pt resolution
                    if (closestIndex > 0 && closestIndex < thresholdProbs.length - 1) {
                        // Get neighboring points for interpolation
                        const prevIdx = closestIndex - 1;
                        const nextIdx = closestIndex + 1;
                        
                        const pt1 = thresholdProbs[prevIdx];
                        const pt2 = thresholdProbs[closestIndex];
                        const pt3 = thresholdProbs[nextIdx];
                        
                        const odds1 = pt1 / (1 - pt1);
                        const odds2 = pt2 / (1 - pt2);
                        const odds3 = pt3 / (1 - pt3);
                        
                        const nb1 = (targetSens * baseRate) - ((1 - targetSpec) * (1 - baseRate) * odds1);
                        const nb2 = (targetSens * baseRate) - ((1 - targetSpec) * (1 - baseRate) * odds2);
                        const nb3 = (targetSens * baseRate) - ((1 - targetSpec) * (1 - baseRate) * odds3);
                        
                        const dcaNb1 = netBenefits[prevIdx];
                        const dcaNb2 = netBenefits[closestIndex];
                        const dcaNb3 = netBenefits[nextIdx];
                        
                        // Find the exact pt where target net benefit intersects DCA curve using linear interpolation
                        let interpolatedPt = bestPt;
                        
                        // Check between pt1 and pt2
                        if ((nb1 - dcaNb1) * (nb2 - dcaNb2) <= 0) {
                            // Linear interpolation between pt1 and pt2
                            const t = Math.abs(nb1 - dcaNb1) / (Math.abs(nb1 - dcaNb1) + Math.abs(nb2 - dcaNb2));
                            interpolatedPt = pt1 + t * (pt2 - pt1);
                        }
                        // Check between pt2 and pt3
                        else if ((nb2 - dcaNb2) * (nb3 - dcaNb3) <= 0) {
                            // Linear interpolation between pt2 and pt3
                            const t = Math.abs(nb2 - dcaNb2) / (Math.abs(nb2 - dcaNb2) + Math.abs(nb3 - dcaNb3));
                            interpolatedPt = pt2 + t * (pt3 - pt2);
                        }
                        
                        bestPt = interpolatedPt;
                        
                        // For closestIndex, still use the discrete index for deltaNB lookup
                        // but the pt value is now continuous
                    }
                    
                    // Apply additional smoothing for very fine movements
                    if (usePrecise) {
                        // Use temporal smoothing to prevent micro-jumps
                        const smoothingFactor = 0.7; // Adjust between 0 (no smoothing) and 1 (heavy smoothing)
                        
                        // Store previous pt value for smoothing (using a simple approach)
                        if (!DCAModule.lastPtValue) DCAModule.lastPtValue = bestPt;
                        
                        const smoothedPt = DCAModule.lastPtValue * smoothingFactor + bestPt * (1 - smoothingFactor);
                        DCAModule.lastPtValue = smoothedPt;
                        bestPt = smoothedPt;
                    }
                } else {
                    // Fallback: use middle range
                    bestPt = 0.5;
                    closestIndex = Math.floor(thresholdProbs.length / 2);
                }
                
                currentThresholdProb = bestPt;
                currentDeltaNB = deltaNB[closestIndex];
            } else {
                // Fallback: use middle of the pt range
                const middleIndex = Math.floor(thresholdProbs.length / 2);
                currentDeltaNB = deltaNB[middleIndex];
                currentThresholdProb = thresholdProbs[middleIndex];
            }
            
            // Format Delta NB for display
            formattedDeltaNB = Math.abs(currentDeltaNB) < 0.001 ? 
                currentDeltaNB.toExponential(1) : 
                currentDeltaNB.toFixed(3);
            
            // Format pt with appropriate precision (always 3 decimal places for display)
            const formattedPt = currentThresholdProb.toFixed(3);
            
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
            
            // Add threshold marker - use the pt value we already calculated
            let thresholdMarker = null;
            if (data.currentThreshold !== undefined && data.currentMetrics !== undefined) {
                // Find the index corresponding to our calculated currentThresholdProb
                let closestIndex = 0;
                let minDiff = Math.abs(thresholdProbs[0] - currentThresholdProb);
                
                for (let i = 1; i < thresholdProbs.length; i++) {
                    const diff = Math.abs(thresholdProbs[i] - currentThresholdProb);
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
                    title: "Threshold probability (p<sub>t</sub>)", 
                    range: [0, 1], 
                    showgrid: false,
                    showline: true,
                    titlefont: { size: 15 },
                    tickvals: [0, 1.0],
                    ticktext: ["0", "1"]
                },
                yaxis: { 
                    title: "Net benefit (NB)", 
                    showgrid: false, 
                    zeroline: false,
                    titlefont: { size: 15 },
                    tickvals: [0, 0.1, 0.2, 0.3, 0.4, 0.5]
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
                     text: `ΔNB: ${formattedDeltaNB}<br>p<sub>t</sub>: ${formattedPt}`,
                    showarrow: false,
                    font: { size: 16, color: "black", weight: "bold" },
                    align: "right"
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
            
            const dataMax = Math.max(...allValues);
            
            // Set reasonable y-axis bounds, with ymin as a percentage of ymax
            const yAxisMax = Math.max(0.1, dataMax + 0.05); // Ensure at least 0.1 range
            const yAxisMin = -yAxisMax / 5;
            
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