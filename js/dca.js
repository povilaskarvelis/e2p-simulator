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
            
            // Debug: log the current threshold and metrics
            console.log('DCA Debug:', {
                currentThreshold: data.currentThreshold,
                currentMetrics: data.currentMetrics ? {
                    sensitivity: data.currentMetrics.sensitivity,
                    specificity: data.currentMetrics.specificity
                } : 'undefined'
            });
            
            // Calculate net benefit across threshold probabilities using current model performance
            const ptMin = 0.001;
            const ptMax = 0.95;  // Further reduce upper limit for smoother curves
            const step = 0.001;
            
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
                // We do this by finding the pt that gives us the current sensitivity/specificity
                let closestIndex = 0;
                let minDiff = Infinity;
            
                // Find the pt that corresponds to the current threshold's actual net benefit
                // Use a smoother approach to reduce marker jumping
                let bestPt = 0.5;
                let bestNetBenefit = 0;
            
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                    const odds = pt / (1 - pt);
                    
                    // Calculate what net benefit the current threshold would give at this pt
                    const currentThresholdNetBenefit = (currentMetrics.sensitivity * baseRate) - ((1 - currentMetrics.specificity) * (1 - baseRate) * odds);
                    
                    // Find the pt where this net benefit matches the DCA curve
                    const diff = Math.abs(currentThresholdNetBenefit - netBenefits[i]);
                    
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                        bestPt = pt;
                        bestNetBenefit = currentThresholdNetBenefit;
                    }
                }
                
                // Use interpolation to smooth the pt value
                if (closestIndex > 0 && closestIndex < thresholdProbs.length - 1) {
                    const prevPt = thresholdProbs[closestIndex - 1];
                    const nextPt = thresholdProbs[closestIndex + 1];
                    const prevNB = netBenefits[closestIndex - 1];
                    const nextNB = netBenefits[closestIndex + 1];
                    const currentNB = netBenefits[closestIndex];
                    
                    // Linear interpolation to get a smoother pt value
                    if (Math.abs(bestNetBenefit - prevNB) < Math.abs(bestNetBenefit - nextNB)) {
                        const weight = Math.abs(bestNetBenefit - currentNB) / (Math.abs(bestNetBenefit - currentNB) + Math.abs(bestNetBenefit - prevNB) + 0.001);
                        currentThresholdProb = bestPt + (prevPt - bestPt) * weight * 0.5;
                    } else {
                        const weight = Math.abs(bestNetBenefit - currentNB) / (Math.abs(bestNetBenefit - currentNB) + Math.abs(bestNetBenefit - nextNB) + 0.001);
                        currentThresholdProb = bestPt + (nextPt - bestPt) * weight * 0.5;
                    }
                } else {
                    currentThresholdProb = bestPt;
                }
                
                currentDeltaNB = deltaNB[closestIndex];
                // currentThresholdProb is already set by the interpolation above
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
                    ticktext: ["0", "100%"]
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
                     text: `ΔNB: ${formattedDeltaNB}<br>p<sub>t</sub>: ${(currentThresholdProb * 100).toFixed(2)}%`,
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