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
            thresholdMax: config.thresholdMax || 0.30,
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
            
            // Calculate Delta A-NBC (improvement over best simple strategy)
            let deltaANBC = 0;
            const rangeStart = instance.thresholdMin;
            const rangeEnd = instance.thresholdMax;
            
            for (let i = 1; i < thresholdProbs.length; i++) {
                const pt1 = thresholdProbs[i-1];
                const pt2 = thresholdProbs[i];
                
                // Only include points within the selected range
                if (pt1 >= rangeStart && pt2 <= rangeEnd) {
                    const nb1 = netBenefits[i-1];
                    const nb2 = netBenefits[i];
                    const ta1 = treatAllBenefits[i-1];
                    const ta2 = treatAllBenefits[i];
                    
                    // Treat none benefit is always 0
                    const tn1 = 0;
                    const tn2 = 0;
                    
                    // Find the best simple strategy at each point
                    const bestSimple1 = Math.max(ta1, tn1); // max(treat all, treat none)
                    const bestSimple2 = Math.max(ta2, tn2);
                    
                    // Calculate improvement over best simple strategy
                    const improvement1 = nb1 - bestSimple1;
                    const improvement2 = nb2 - bestSimple2;
                    
                    // Integrate the improvement (can be negative)
                    deltaANBC += (pt2 - pt1) * (improvement1 + improvement2) / 2; // Trapezoidal rule
                }
            }
            
            // Create separate shaded areas for different strategies
            const positiveX = [];
            const positiveY = [];
            const positiveBaseline = []; // For bounding the positive area
            const treatAllShadedX = [];
            const treatAllShadedY = [];
            
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                if (pt >= instance.thresholdMin && pt <= instance.thresholdMax) {
                    const netBenefit = netBenefits[i];
                    const treatAllBenefit = treatAllBenefits[i];
                    
                    // Only include in positive area when model is better than both 0 and treat all
                    if (netBenefit >= 0 && netBenefit >= treatAllBenefit) {
                        positiveX.push(pt);
                        positiveY.push(netBenefit);
                        // Use the higher of 0 or treat all as the baseline
                        positiveBaseline.push(Math.max(0, treatAllBenefit));
                    }
                    
                    // Collect treat all points for shading
                    treatAllShadedX.push(pt);
                    treatAllShadedY.push(treatAllBenefit);
                }
            }
            
            // Create traces
            const dcaTrace = {
                x: thresholdProbs,
                y: netBenefits,
                type: "scatter",
                mode: "lines",
                name: "Predictor",
                line: { color: "black", width: 2 },
                showlegend: true,
            };
            
            // Treat all shaded area (gray) - reference strategy
            const treatAllArea = {
                x: treatAllShadedX,
                y: treatAllShadedY,
                type: "scatter",
                mode: "none",
                fill: "tozeroy",
                fillcolor: "rgba(128, 128, 128, 0.2)", // Light gray
                name: "Treat All Net Benefit",
                showlegend: false,
            };
            
            // Positive shaded area (blue) - bounded by max(0, treat all) at bottom
            let positiveArea = null;
            if (positiveX.length > 0) {
                // Create area bounded by the model curve on top and max(0, treat all) on bottom
                const positiveXCombined = [...positiveX, ...positiveX.slice().reverse()];
                const positiveYCombined = [...positiveY, ...positiveBaseline.slice().reverse()];
                
                positiveArea = {
                    x: positiveXCombined,
                    y: positiveYCombined,
                    type: "scatter",
                    mode: "none",
                    fill: "toself",
                    fillcolor: "rgba(46, 134, 171, 0.3)",
                    name: "Positive Net Benefit",
                    showlegend: false,
                    line: { color: "transparent" }
                };
            } else {
                // No positive values - empty trace
                positiveArea = {
                    x: [],
                    y: [],
                    type: "scatter",
                    mode: "none",
                    fill: "tozeroy",
                    fillcolor: "rgba(46, 134, 171, 0.3)",
                    name: "Positive Net Benefit",
                    showlegend: false,
                };
            }
            
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
            
            // Suboptimal area (red) - where model is positive but treat all is better
            // This represents negative contribution to Delta A-NBC when treat all outperforms model
            const suboptimalX = [];
            const suboptimalY = [];
            const suboptimalBaseline = [];
            
            // Collect points where model is positive but worse than treat all
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                if (pt >= instance.thresholdMin && pt <= instance.thresholdMax) {
                    const netBenefit = netBenefits[i];
                    const treatAllBenefit = treatAllBenefits[i];
                    
                    if (netBenefit >= 0 && netBenefit < treatAllBenefit) {
                        suboptimalX.push(pt);
                        suboptimalY.push(netBenefit);
                        suboptimalBaseline.push(treatAllBenefit);
                    }
                }
            }
            
            let suboptimalArea = null;
            if (suboptimalX.length > 0) {
                // Create area bounded by treat all curve on top and model curve on bottom
                const suboptimalXCombined = [...suboptimalX, ...suboptimalX.slice().reverse()];
                const suboptimalYCombined = [...suboptimalBaseline, ...suboptimalY.slice().reverse()];
                
                suboptimalArea = {
                    x: suboptimalXCombined,
                    y: suboptimalYCombined,
                    type: "scatter",
                    mode: "none",
                    fill: "toself",
                    fillcolor: "rgba(231, 76, 60, 0.3)",
                    name: "Suboptimal Net Benefit",
                    showlegend: false,
                    line: { color: "transparent" }
                };
            } else {
                // No suboptimal values - empty trace
                suboptimalArea = {
                    x: [],
                    y: [],
                    type: "scatter",
                    mode: "none",
                    fill: "tozeroy",
                    fillcolor: "rgba(231, 76, 60, 0.3)",
                    name: "Suboptimal Net Benefit",
                    showlegend: false,
                };
            }
            
            const treatAllTrace = {
                x: thresholdProbs,
                y: treatAllBenefits,
                type: "scatter",
                mode: "lines",
                name: "Treat all",
                line: { color: "#666666", dash: "dash" },
                showlegend: true,
            };
            
            const treatNoneTrace = {
                x: thresholdProbs,
                y: treatNoneBenefits,
                type: "scatter",
                mode: "lines",
                name: "Treat none",
                line: { color: "#999999", dash: "dot" },
                showlegend: true,
            };
            
            // Legend entries for shaded areas (invisible traces just for legend)
            const blueLegendTrace = {
                x: [null],
                y: [null],
                type: "scatter",
                mode: "markers",
                marker: { color: "rgba(46, 134, 171, 0.6)", size: 12, symbol: "square" },
                name: "Predictor better than treat all/none",
                showlegend: true,
            };
            
            const redLegendTrace = {
                x: [null],
                y: [null],
                type: "scatter",
                mode: "markers",
                marker: { color: "rgba(231, 76, 60, 0.6)", size: 12, symbol: "square" },
                name: "Predictor worse than treat all/none",
                showlegend: true,
            };
            
            // Calculate dynamic y-axis minimum based on negative values
            const negativeRegionMin = negativeY.length > 0 ? Math.min(...negativeY) : 0;
            const yAxisMin = Math.min(-0.05, negativeRegionMin * 1.1); // Expand below -0.05 if needed
            
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
                    range: [yAxisMin, Math.max(...netBenefits, ...treatAllBenefits, baseRate, 0.01) * 1.1], 
                    showgrid: false, 
                    zeroline: false,
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
                    text: `ΔA-NBC:<br>${deltaANBC.toFixed(3)}`,
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
                Plotly.newPlot(instance.plotSelector, [treatNoneTrace, treatAllTrace, treatAllArea, negativeArea, suboptimalArea, positiveArea, dcaTrace, blueLegendTrace, redLegendTrace], dcaLayout, config);
                instance.initialized = true;
                // Add threshold bars after initial plot
                this.addThresholdBars(instanceId);
                
                // Add click event listener to navigate to get-started.html DCA section
                document.getElementById(instance.plotSelector).addEventListener('click', (e) => {
                    // Only trigger if not clicking on threshold bars
                    if (!e.target.closest('.dca-threshold-overlay')) {
                        window.open('get-started.html#dca-analysis', '_blank');
                    }
                });
            } else {
                Plotly.react(instance.plotSelector, [treatNoneTrace, treatAllTrace, treatAllArea, negativeArea, suboptimalArea, positiveArea, dcaTrace, blueLegendTrace, redLegendTrace], dcaLayout, config);
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
                dcaSvg.style.overflow = 'visible'; // Allow overflow for tooltips
                dcaPlotElement.style.position = 'relative';
                dcaPlotElement.style.overflow = 'visible'; // Allow overflow on plot element
                dcaPlotElement.appendChild(dcaSvg);
                
                // Create SVG element
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.position = 'absolute';
                svg.style.overflow = 'visible'; // Allow SVG content to overflow
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
            
            // Create SVG tooltip elements
            const tooltipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            tooltipGroup.setAttribute('class', `dca-tooltip-${type}`);
            tooltipGroup.style.display = 'none';
            
            // Tooltip background
            const tooltipBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            tooltipBg.setAttribute('fill', 'rgba(0, 0, 0, 0.8)');
            tooltipBg.setAttribute('rx', '4');
            tooltipBg.setAttribute('ry', '4');
            
            // Tooltip text
            const tooltipText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            tooltipText.setAttribute('fill', 'white');
            tooltipText.setAttribute('font-family', 'Arial, sans-serif');
            tooltipText.setAttribute('font-size', '12');
            tooltipText.setAttribute('text-anchor', 'middle');
            tooltipText.setAttribute('dominant-baseline', 'middle');
            
            tooltipGroup.appendChild(tooltipBg);
            tooltipGroup.appendChild(tooltipText);
            
            group.appendChild(line);
            group.appendChild(hitbox);
            group.appendChild(tooltipGroup);
            svg.appendChild(group);
            
            // Add drag behavior
            let isDragging = false;
            
            group.addEventListener('mousedown', (e) => {
                isDragging = true;
                e.preventDefault();
                // Show SVG tooltip
                this.showSVGTooltip(tooltipGroup, tooltipBg, tooltipText, thresholdValue, type, xPos, yStart);
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
                
                // Update tooltip position and value
                this.updateSVGTooltip(tooltipGroup, tooltipBg, tooltipText, constrainedThreshold, type, newXPos, yStart);
                
                // Update shaded area in real time
                this.updateShadedArea(instanceId);
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    // Hide SVG tooltip
                    tooltipGroup.style.display = 'none';
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
    
    // Show SVG tooltip
    showSVGTooltip: function(tooltipGroup, tooltipBg, tooltipText, value, type, barX, barY) {
        const label = type === 'min' ? 'Min' : 'Max';
        const text = `${label}: ${value.toFixed(3)}`;
        
        // Update text content
        tooltipText.textContent = text;
        
        // Position tooltip above the threshold bar
        const tooltipX = barX;
        const tooltipY = barY - 25;
        
        // Get text dimensions for background sizing
        const textBBox = tooltipText.getBBox ? tooltipText.getBBox() : { width: text.length * 7, height: 12 };
        const padding = 6;
        
        // Position and size the background
        tooltipBg.setAttribute('x', tooltipX - textBBox.width/2 - padding);
        tooltipBg.setAttribute('y', tooltipY - textBBox.height/2 - padding);
        tooltipBg.setAttribute('width', textBBox.width + padding * 2);
        tooltipBg.setAttribute('height', textBBox.height + padding * 2);
        
        // Position the text
        tooltipText.setAttribute('x', tooltipX);
        tooltipText.setAttribute('y', tooltipY);
        
        // Show the tooltip
        tooltipGroup.style.display = 'block';
    },
    
    // Update SVG tooltip
    updateSVGTooltip: function(tooltipGroup, tooltipBg, tooltipText, value, type, barX, barY) {
        const label = type === 'min' ? 'Min' : 'Max';
        const text = `${label}: ${value.toFixed(3)}`;
        
        // Update text content
        tooltipText.textContent = text;
        
        // Position tooltip above the threshold bar
        const tooltipX = barX;
        const tooltipY = barY - 25;
        
        // Get text dimensions for background sizing
        const textBBox = tooltipText.getBBox ? tooltipText.getBBox() : { width: text.length * 7, height: 12 };
        const padding = 6;
        
        // Position and size the background
        tooltipBg.setAttribute('x', tooltipX - textBBox.width/2 - padding);
        tooltipBg.setAttribute('y', tooltipY - textBBox.height/2 - padding);
        tooltipBg.setAttribute('width', textBBox.width + padding * 2);
        tooltipBg.setAttribute('height', textBBox.height + padding * 2);
        
        // Position the text
        tooltipText.setAttribute('x', tooltipX);
        tooltipText.setAttribute('y', tooltipY);
    },

    // Update shaded areas in real time
    updateShadedArea: function(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) return;
        
        try {
            const dcaPlotElement = document.getElementById(instance.plotSelector);
            if (!dcaPlotElement || !dcaPlotElement.data) return;
            
            // Trace indices: 0=treatNone, 1=treatAll, 2=treatAllArea, 3=negativeArea, 4=suboptimalArea, 5=positiveArea, 6=dcaCurve
            const negativeAreaIndex = 3;
            const suboptimalAreaIndex = 4;
            const positiveAreaIndex = 5;
            const mainCurveIndex = 6;
            
            if (dcaPlotElement.data.length <= mainCurveIndex) return;
            
            const thresholdProbs = dcaPlotElement.data[mainCurveIndex].x;
            const netBenefits = dcaPlotElement.data[mainCurveIndex].y;
            
            // Get treat all data from the plot
            const treatAllData = dcaPlotElement.data[1]; // Index 1 is treat all trace
            const treatAllBenefits = treatAllData.y;
            
            // Create separate shaded areas for different strategies
            const positiveX = [];
            const positiveY = [];
            const positiveBaseline = []; // For bounding the positive area
            const treatAllShadedX = [];
            const treatAllShadedY = [];
            
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                if (pt >= instance.thresholdMin && pt <= instance.thresholdMax) {
                    const netBenefit = netBenefits[i];
                    const treatAllBenefit = treatAllBenefits[i];
                    
                    // Only include in positive area when model is better than both 0 and treat all
                    if (netBenefit >= 0 && netBenefit >= treatAllBenefit) {
                        positiveX.push(pt);
                        positiveY.push(netBenefit);
                        // Use the higher of 0 or treat all as the baseline
                        positiveBaseline.push(Math.max(0, treatAllBenefit));
                    }
                    
                    // Collect treat all points for shading
                    treatAllShadedX.push(pt);
                    treatAllShadedY.push(treatAllBenefit);
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
            
            // Create suboptimal area data - where model is positive but treat all is better
            const suboptimalX = [];
            const suboptimalY = [];
            const suboptimalBaseline = [];
            
            // Collect points where model is positive but worse than treat all
            for (let i = 0; i < thresholdProbs.length; i++) {
                const pt = thresholdProbs[i];
                if (pt >= instance.thresholdMin && pt <= instance.thresholdMax) {
                    const netBenefit = netBenefits[i];
                    const treatAllBenefit = treatAllBenefits[i];
                    
                    if (netBenefit >= 0 && netBenefit < treatAllBenefit) {
                        suboptimalX.push(pt);
                        suboptimalY.push(netBenefit);
                        suboptimalBaseline.push(treatAllBenefit);
                    }
                }
            }
            
            // Recalculate Delta A-NBC for the new threshold range (improvement over best simple strategy)
            let deltaANBC = 0;
            
            for (let i = 1; i < thresholdProbs.length; i++) {
                const pt1 = thresholdProbs[i-1];
                const pt2 = thresholdProbs[i];
                
                // Only include points within the selected range
                if (pt1 >= instance.thresholdMin && pt2 <= instance.thresholdMax) {
                    const nb1 = netBenefits[i-1];
                    const nb2 = netBenefits[i];
                    const ta1 = treatAllBenefits[i-1];
                    const ta2 = treatAllBenefits[i];
                    
                    // Treat none benefit is always 0
                    const tn1 = 0;
                    const tn2 = 0;
                    
                    // Find the best simple strategy at each point
                    const bestSimple1 = Math.max(ta1, tn1); // max(treat all, treat none)
                    const bestSimple2 = Math.max(ta2, tn2);
                    
                    // Calculate improvement over best simple strategy
                    const improvement1 = nb1 - bestSimple1;
                    const improvement2 = nb2 - bestSimple2;
                    
                    // Integrate the improvement (can be negative)
                    deltaANBC += (pt2 - pt1) * (improvement1 + improvement2) / 2; // Trapezoidal rule
                }
            }
            
            // Calculate dynamic y-axis minimum based on negative values in threshold range
            const negativeRegionMin = finalNegativeY.length > 0 ? Math.min(...finalNegativeY) : 0;
            const yAxisMin = Math.min(-0.05, negativeRegionMin * 1.1); // Expand below -0.05 if needed
            
            // Update all shaded area traces
            // Note: trace order is [treatNone, treatAll, treatAllArea, negativeArea, suboptimalArea, positiveArea, dcaCurve]
            const treatAllAreaIndex = 2;
            
            Plotly.restyle(instance.plotSelector, {
                x: [treatAllShadedX],
                y: [treatAllShadedY]
            }, treatAllAreaIndex);
            
            Plotly.restyle(instance.plotSelector, {
                x: [finalNegativeX],
                y: [finalNegativeY]
            }, negativeAreaIndex);
            
            // Update suboptimal area with bounded fill
            if (suboptimalX.length > 0) {
                const suboptimalXCombined = [...suboptimalX, ...suboptimalX.slice().reverse()];
                const suboptimalYCombined = [...suboptimalBaseline, ...suboptimalY.slice().reverse()];
                
                Plotly.restyle(instance.plotSelector, {
                    x: [suboptimalXCombined],
                    y: [suboptimalYCombined],
                    fill: ['toself'],
                    fillcolor: ['rgba(231, 76, 60, 0.3)'],
                    'line.color': ['transparent']
                }, suboptimalAreaIndex);
            } else {
                // No suboptimal values - empty area
                Plotly.restyle(instance.plotSelector, {
                    x: [[]],
                    y: [[]]
                }, suboptimalAreaIndex);
            }
            
            // Update positive area with bounded fill (similar to initial plot logic)
            if (positiveX.length > 0) {
                const positiveXCombined = [...positiveX, ...positiveX.slice().reverse()];
                const positiveYCombined = [...positiveY, ...positiveBaseline.slice().reverse()];
                
                Plotly.restyle(instance.plotSelector, {
                    x: [positiveXCombined],
                    y: [positiveYCombined],
                    fill: ['toself'],
                    fillcolor: ['rgba(46, 134, 171, 0.3)'],
                    'line.color': ['transparent']
                }, positiveAreaIndex);
            } else {
                // No positive values - empty area
                Plotly.restyle(instance.plotSelector, {
                    x: [[]],
                    y: [[]]
                }, positiveAreaIndex);
            }
            
            // Update y-axis range and A-NBC annotation
            const currentLayout = dcaPlotElement.layout;
            const currentYMax = currentLayout.yaxis.range[1];
            
            Plotly.relayout(instance.plotSelector, {
                'yaxis.range': [yAxisMin, currentYMax],
                'annotations[0].text': `ΔA-NBC:<br>${deltaANBC.toFixed(3)}`
            });
            
        } catch (error) {
            console.error("Error updating shaded areas:", error);
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