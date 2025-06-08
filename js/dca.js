(function() {
// DCA Module - Modular Decision Curve Analysis implementation
const DCAModule = {
    // State variables for each DCA instance
    instances: new Map(),
    
    // Initialize a DCA instance
    init: function(instanceId, config) {
        this.instances.set(instanceId, {
            plotSelector: config.plotSelector,
            thresholdMin: config.thresholdMin || 0.05,
            thresholdMax: config.thresholdMax || 0.25,
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
        
        try {
            const {
                sensitivity,
                specificity,
                baseRate
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
                // Use current threshold's sensitivity/specificity for all threshold probabilities
                const odds = pt / (1 - pt);
                
                const netBenefit = (sensitivity * baseRate) - ((1 - specificity) * (1 - baseRate) * odds);
                
                // Calculate treat all strategy: treat everyone regardless of test result
                // TP = all cases, FP = all controls
                const treatAllBenefit = baseRate - ((1 - baseRate) * odds);
                
                thresholdProbs.push(pt);
                netBenefits.push(netBenefit); // Allow negative net benefit
                treatAllBenefits.push(treatAllBenefit); // Allow negative net benefit for treat all
                treatNoneBenefits.push(0); // Treat none = 0
            }
            
            // Calculate A-NBC (Area Under Net Benefit Curve) using trapezoidal integration
            let anbc = 0;
            const rangeStart = instance.thresholdMin;
            const rangeEnd = instance.thresholdMax;
            
            for (let i = 1; i < thresholdProbs.length; i++) {
                const pt1 = thresholdProbs[i-1];
                const pt2 = thresholdProbs[i];
                
                // Only include points within the selected range
                if (pt1 >= rangeStart && pt2 <= rangeEnd) {
                    const nb1 = netBenefits[i-1];
                    const nb2 = netBenefits[i];
                    anbc += (pt2 - pt1) * (nb1 + nb2) / 2; // Trapezoidal rule
                }
            }
            
            // Create separate shaded areas for positive net benefits
            const positiveX = [];
            const positiveY = [];
            
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                if (pt >= instance.thresholdMin && pt <= instance.thresholdMax) {
                    const netBenefit = netBenefits[i];
                    
                    if (netBenefit >= 0) {
                        positiveX.push(pt);
                        positiveY.push(netBenefit);
                    }
                    // Note: we don't use negativeX/Y here anymore since we handle it separately below
                }
            }
            
            // Create traces
            const dcaTrace = {
                x: thresholdProbs,
                y: netBenefits,
                type: "scatter",
                mode: "lines",
                name: "Model",
                line: { color: "black", width: 2 },
            };
            
            // Positive shaded area (blue) - always bounded by y=0 at bottom
            const positiveArea = {
                x: positiveX,
                y: positiveY,
                type: "scatter",
                mode: "none",
                fill: "tozeroy",
                fillcolor: "rgba(46, 134, 171, 0.3)",
                name: "Positive Net Benefit",
                showlegend: false,
            };
            
            // Negative shaded area (red) - represents negative contribution to A-NBC integral
            // This should be the area between the curve and y=0 when the curve is negative
            const negativeX = [];
            const negativeY = [];
            
            // Collect only points where net benefit is actually negative and within threshold range
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                if (pt >= instance.thresholdMin && pt <= instance.thresholdMax) {
                    const netBenefit = netBenefits[i];
                    if (netBenefit < 0) {
                        negativeX.push(pt);
                        negativeY.push(netBenefit);
                    }
                }
            }
            
            let negativeArea = null;
            if (negativeX.length > 0) {
                // Create area between negative curve and y=0 axis
                // This represents the actual negative contribution to the A-NBC integral
                negativeArea = {
                    x: negativeX,
                    y: negativeY,
                    type: "scatter",
                    mode: "none",
                    fill: "tozeroy", // Fill from curve to y=0 (negative area)
                    fillcolor: "rgba(231, 76, 60, 0.3)",
                    name: "Negative Net Benefit",
                    showlegend: false,
                    line: { color: "transparent" } // Hide the line itself
                };
            } else {
                // No negative values - empty trace
                negativeArea = {
                    x: [],
                    y: [],
                    type: "scatter",
                    mode: "none",
                    fill: "tozeroy",
                    fillcolor: "rgba(231, 76, 60, 0.3)",
                    name: "Negative Net Benefit",
                    showlegend: false,
                };
            }
            
            const treatAllTrace = {
                x: thresholdProbs,
                y: treatAllBenefits,
                type: "scatter",
                mode: "lines",
                name: "Treat All",
                line: { color: "#666666", dash: "dash" },
            };
            
            const treatNoneTrace = {
                x: thresholdProbs,
                y: treatNoneBenefits,
                type: "scatter",
                mode: "lines",
                name: "Treat None",
                line: { color: "#999999", dash: "dot" },
            };
            
            // Calculate dynamic y-axis minimum based on negative values
            const negativeRegionMin = negativeY.length > 0 ? Math.min(...negativeY) : 0;
            const yAxisMin = Math.min(-0.05, negativeRegionMin * 1.1); // Expand below -0.05 if needed
            
            const dcaLayout = {
                xaxis: { 
                    title: "Threshold Probability", 
                    range: [0, 1], 
                    showgrid: false,
                    showline: true,
                    linecolor: "black",
                    linewidth: 1,
                    titlefont: { size: 15 },
                    tickformat: ".1f",
                    dtick: 0.2
                },
                yaxis: { 
                    title: "Net Benefit", 
                    range: [yAxisMin, Math.max(...netBenefits, ...treatAllBenefits, baseRate, 0.1) * 1.1], 
                    showgrid: false, 
                    titlefont: { size: 15 }
                },
                showlegend: false,
                margin: { t: 20, l: 50, r: 30, b: 40 },
                font: { size: 12 },
                annotations: [{
                    x: 0.95,
                    y: 0.95,
                    xref: "paper",
                    yref: "paper",
                    text: `A-NBC:<br>${anbc.toFixed(3)}`,
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
            
            if (!instance.initialized) {
                Plotly.newPlot(instance.plotSelector, [treatNoneTrace, treatAllTrace, negativeArea, positiveArea, dcaTrace], dcaLayout, config);
                instance.initialized = true;
                // Add threshold bars after initial plot
                this.addThresholdBars(instanceId);
            } else {
                Plotly.react(instance.plotSelector, [treatNoneTrace, treatAllTrace, negativeArea, positiveArea, dcaTrace], dcaLayout, config);
                // Update threshold bars position
                this.updateThresholdBars(instanceId);
            }
            
        } catch (error) {
            console.error("Error plotting DCA:", error);
        }
    },
    
    // Add movable threshold bars to DCA plot
    addThresholdBars: function(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) return;
        
        try {
            const dcaPlotElement = document.getElementById(instance.plotSelector);
            const plotlyDiv = dcaPlotElement._fullLayout;
            
            // Get plot dimensions
            const plotArea = dcaPlotElement.querySelector('.plot');
            if (!plotArea) return;
            
            // Create SVG overlay for threshold bars
            let dcaSvg = dcaPlotElement.querySelector('.dca-threshold-overlay');
            if (!dcaSvg) {
                dcaSvg = document.createElement('div');
                dcaSvg.className = 'dca-threshold-overlay';
                dcaSvg.style.position = 'absolute';
                dcaSvg.style.top = '0';
                dcaSvg.style.left = '0';
                dcaSvg.style.width = '100%';
                dcaSvg.style.height = '100%';
                dcaSvg.style.pointerEvents = 'none';
                dcaPlotElement.style.position = 'relative';
                dcaPlotElement.appendChild(dcaSvg);
                
                // Create SVG element
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.position = 'absolute';
                dcaSvg.appendChild(svg);
                
                // Add threshold bars
                this.addThresholdBar(instanceId, svg, instance.thresholdMin, 'min', '#888888', dcaPlotElement);
                this.addThresholdBar(instanceId, svg, instance.thresholdMax, 'max', '#888888', dcaPlotElement);
            }
            
        } catch (error) {
            console.error("Error adding DCA threshold bars:", error);
        }
    },
    
    // Add individual threshold bar
    addThresholdBar: function(instanceId, svg, thresholdValue, type, color, plotElement) {
        const instance = this.instances.get(instanceId);
        if (!instance) return;
        
        try {
            const plotlyLayout = plotElement._fullLayout;
            const xaxis = plotlyLayout.xaxis;
            const yaxis = plotlyLayout.yaxis;
            
            // Calculate position
            const xPos = xaxis.l2p(thresholdValue) + plotlyLayout.margin.l;
            const yStart = plotlyLayout.margin.t;
            const yEnd = plotlyLayout.height - plotlyLayout.margin.b;
            
            // Create group for this threshold bar
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', `dca-threshold-${type}`);
            group.style.cursor = 'ew-resize';
            group.style.pointerEvents = 'all';
            
            // Create line
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', xPos);
            line.setAttribute('x2', xPos);
            line.setAttribute('y1', yStart);
            line.setAttribute('y2', yEnd);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', '3');
            line.setAttribute('stroke-opacity', '0.8');
            
            // Create invisible hitbox for easier dragging
            const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hitbox.setAttribute('x', xPos - 10);
            hitbox.setAttribute('y', yStart);
            hitbox.setAttribute('width', '20');
            hitbox.setAttribute('height', yEnd - yStart);
            hitbox.setAttribute('fill', 'transparent');
            
            group.appendChild(line);
            group.appendChild(hitbox);
            svg.appendChild(group);
            
            // Add drag behavior
            let isDragging = false;
            
            group.addEventListener('mousedown', (e) => {
                isDragging = true;
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                const rect = plotElement.getBoundingClientRect();
                const relativeX = e.clientX - rect.left - plotlyLayout.margin.l;
                const newThreshold = xaxis.p2l(relativeX);
                
                // Constrain to plot range and ensure min < max
                let constrainedThreshold = Math.max(0, Math.min(1, newThreshold));
                
                if (type === 'min') {
                    constrainedThreshold = Math.min(constrainedThreshold, instance.thresholdMax - 0.01);
                    instance.thresholdMin = constrainedThreshold;
                } else {
                    constrainedThreshold = Math.max(constrainedThreshold, instance.thresholdMin + 0.01);
                    instance.thresholdMax = constrainedThreshold;
                }
                
                // Update visual position
                const newXPos = xaxis.l2p(constrainedThreshold) + plotlyLayout.margin.l;
                line.setAttribute('x1', newXPos);
                line.setAttribute('x2', newXPos);
                hitbox.setAttribute('x', newXPos - 10);
                
                // Update shaded area in real time
                this.updateShadedArea(instanceId);
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    // Trigger callback if provided
                    instance.onThresholdChange(instance.thresholdMin, instance.thresholdMax);
                    console.log(`DCA range: ${instance.thresholdMin.toFixed(3)} - ${instance.thresholdMax.toFixed(3)}`);
                }
            });
            
        } catch (error) {
            console.error("Error adding threshold bar:", error);
        }
    },
    
    // Update threshold bars when plot changes
    updateThresholdBars: function(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) return;
        
        try {
            const dcaPlotElement = document.getElementById(instance.plotSelector);
            const overlay = dcaPlotElement.querySelector('.dca-threshold-overlay');
            if (overlay) {
                // Remove and recreate for simplicity
                overlay.remove();
                setTimeout(() => this.addThresholdBars(instanceId), 100);
            }
        } catch (error) {
            console.error("Error updating DCA threshold bars:", error);
        }
    },
    
    // Update shaded areas in real time
    updateShadedArea: function(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) return;
        
        try {
            const dcaPlotElement = document.getElementById(instance.plotSelector);
            if (!dcaPlotElement || !dcaPlotElement.data) return;
            
            // Trace indices: 0=treatNone, 1=treatAll, 2=negativeArea, 3=positiveArea, 4=dcaCurve
            const negativeAreaIndex = 2;
            const positiveAreaIndex = 3;
            const mainCurveIndex = 4;
            
            if (dcaPlotElement.data.length <= mainCurveIndex) return;
            
            const thresholdProbs = dcaPlotElement.data[mainCurveIndex].x;
            const netBenefits = dcaPlotElement.data[mainCurveIndex].y;
            
            // Create separate shaded areas for positive and negative net benefits
            const positiveX = [];
            const positiveY = [];
            
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                if (pt >= instance.thresholdMin && pt <= instance.thresholdMax) {
                    const netBenefit = netBenefits[i];
                    
                    if (netBenefit >= 0) {
                        positiveX.push(pt);
                        positiveY.push(netBenefit);
                    }
                }
            }
            
            // Create negative area data - area between curve and y=0 when curve is negative
            const finalNegativeX = [];
            const finalNegativeY = [];
            
            // Collect only points where net benefit is actually negative and within threshold range
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                if (pt >= instance.thresholdMin && pt <= instance.thresholdMax) {
                    const netBenefit = netBenefits[i];
                    if (netBenefit < 0) {
                        finalNegativeX.push(pt);
                        finalNegativeY.push(netBenefit);
                    }
                }
            }
            
            // Recalculate A-NBC for the new threshold range
            let anbc = 0;
            for (let i = 1; i < thresholdProbs.length; i++) {
                const pt1 = thresholdProbs[i-1];
                const pt2 = thresholdProbs[i];
                
                // Only include points within the selected range
                if (pt1 >= instance.thresholdMin && pt2 <= instance.thresholdMax) {
                    const nb1 = netBenefits[i-1];
                    const nb2 = netBenefits[i];
                    anbc += (pt2 - pt1) * (nb1 + nb2) / 2; // Trapezoidal rule
                }
            }
            
            // Calculate dynamic y-axis minimum based on negative values in threshold range
            const negativeRegionMin = finalNegativeY.length > 0 ? Math.min(...finalNegativeY) : 0;
            const yAxisMin = Math.min(-0.05, negativeRegionMin * 1.1); // Expand below -0.05 if needed
            
            // Update both shaded area traces
            Plotly.restyle(instance.plotSelector, {
                x: [finalNegativeX],
                y: [finalNegativeY]
            }, negativeAreaIndex);
            
            Plotly.restyle(instance.plotSelector, {
                x: [positiveX],
                y: [positiveY]
            }, positiveAreaIndex);
            
            // Update y-axis range and A-NBC annotation
            const currentLayout = dcaPlotElement.layout;
            const currentYMax = currentLayout.yaxis.range[1];
            
            Plotly.relayout(instance.plotSelector, {
                'yaxis.range': [yAxisMin, currentYMax],
                'annotations[0].text': `A-NBC:<br>${anbc.toFixed(3)}`
            });
            
        } catch (error) {
            console.error("Error updating shaded areas:", error);
        }
    },
    
    // Clean up a DCA instance
    cleanup: function(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            if (document.getElementById(instance.plotSelector)) {
                Plotly.purge(instance.plotSelector);
            }
            this.instances.delete(instanceId);
        }
    },
    
    // Get current threshold range for an instance
    getThresholdRange: function(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            return {
                min: instance.thresholdMin,
                max: instance.thresholdMax
            };
        }
        return null;
    },
    
    // Update threshold range for an instance
    setThresholdRange: function(instanceId, min, max) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            instance.thresholdMin = min;
            instance.thresholdMax = max;
        }
    }
};

// Export to global scope
window.DCAModule = DCAModule;

})(); 