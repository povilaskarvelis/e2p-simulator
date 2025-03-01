// Shared plotting utilities for binary and continuous calculators
const PlotUtils = {
    
    // Create and configure a responsive SVG container
    createResponsiveSVG: function(containerId, margin = { top: 20, right: 30, bottom: 40, left: 50 }) {
        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("preserveAspectRatio", "xMidYMid meet");
        
        // Create a group for the plot content with margins
        const plotGroup = svg.append("g")
            .attr("class", "plot-content")
            .attr("transform", `translate(${margin.left},${margin.top})`);
            
        return { svg, plotGroup, margin };
    },
    
    // Update dimensions and scales for responsive plots
    updateDimensions: function(svg, plotGroup, xScale, yScale, margin, width, height) {
        // Update SVG viewBox to match container size
        svg.attr("viewBox", `0 0 ${width} ${height}`);

        // Update scales with new dimensions
        xScale.range([0, width - margin.left - margin.right]);
        yScale.range([height - margin.bottom - margin.top, 0]);
        
        return { width, height };
    },
    
    // Create and update axes
    createAxes: function(plotGroup, xScale, yScale, height, margin, xLabel = "", yLabel = "") {
        // Create axes groups if they don't exist
        if (plotGroup.select(".x-axis").empty()) {
            plotGroup.append("g")
                .attr("class", "x-axis");
        }
        
        if (plotGroup.select(".y-axis").empty()) {
            plotGroup.append("g")
                .attr("class", "y-axis");
        }
        
        // Update axes
        plotGroup.select(".x-axis")
            .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat(() => ""));

        plotGroup.select(".y-axis")
            .call(d3.axisLeft(yScale).tickFormat(() => ""));
            
        // Add or update axis labels
        this.updateAxisLabels(svg, width, height, margin, xLabel, yLabel);
    },
    
    // Update axis labels
    updateAxisLabels: function(svg, width, height, margin, xLabel, yLabel) {
        // X-axis label
        if (svg.select(".x-label").empty() && xLabel) {
            svg.append("text")
                .attr("class", "x-label")
                .attr("text-anchor", "middle")
                .text(xLabel);
        }
        
        // Y-axis label
        if (svg.select(".y-label").empty() && yLabel) {
            svg.append("text")
                .attr("class", "y-label")
                .attr("text-anchor", "middle")
                .attr("transform", "rotate(-90)")
                .text(yLabel);
        }
        
        // Update positions
        svg.select(".x-label")
            .attr("x", width / 2)
            .attr("y", height - margin.bottom / 10);
            
        svg.select(".y-label")
            .attr("x", -height / 2)
            .attr("y", margin.left / 3);
    },
    
    // Create distribution plots (for both binary and continuous)
    drawDistributions: function(plotGroup, data, xScale, yScale, colors, opacities = 0.3) {
        // Create an area generator
        const area = d3.area()
            .x(d => xScale(d.x))
            .y0(yScale(0))
            .y1(d => yScale(d.y));
            
        // Remove existing distributions
        plotGroup.selectAll(".distribution").remove();
        
        // Draw each distribution
        data.forEach((dist, i) => {
            plotGroup.append("path")
                .attr("class", "distribution")
                .datum(dist)
                .attr("fill", colors[i] || "#000")
                .attr("opacity", Array.isArray(opacities) ? opacities[i] : opacities)
                .attr("d", area);
        });
    },
    
    // Create and update legends
    updateLegend: function(plotGroup, legendData, colors, margin, fontSize = 14) {
        const legend = plotGroup.selectAll(".legend-group").data(legendData);
        
        // Remove any excess legend elements
        legend.exit().remove();
        
        // Add new legend elements
        const legendEnter = legend.enter()
            .append("foreignObject")
            .attr("class", "legend-group")
            .attr("width", 150)
            .attr("height", 20);
            
        // Add text elements
        legendEnter.append("xhtml:div")
            .style("font-size", `${fontSize}px`)
            .style("font-weight", "bold")
            .style("color", (d, i) => colors[i] || "#000")
            .style("display", "inline")
            .text((d, i) => `Group ${i + 1}: `);
            
        // Add editable part if needed
        legendEnter.append("xhtml:div")
            .attr("contenteditable", true)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", "bold")
            .style("color", (d, i) => colors[i] || "#000")
            .style("display", "inline")
            .style("white-space", "nowrap")
            .style("overflow", "visible")
            .text(d => d);
            
        // Update positions
        legendEnter.merge(legend)
            .attr("x", margin.left)
            .attr("y", (d, i) => margin.top + i * 20);
    },
    
    // Create interactive threshold elements
    createThreshold: function(plotGroup, xScale, yScale, thresholdValue, height, margin, color = "red") {
        // Select or create the threshold group
        const thresholdGroup = plotGroup.selectAll(".threshold-group")
            .data([null]);
            
        const groupEnter = thresholdGroup.enter()
            .append("g")
            .attr("class", "threshold-group")
            .style("cursor", "pointer");
            
        // Merge enter and update selections
        const thresholdMerge = groupEnter.merge(thresholdGroup);
        
        // Add or update the threshold line
        const line = thresholdMerge.selectAll(".threshold-line")
            .data([null]);
            
        line.enter()
            .append("line")
            .attr("class", "threshold-line")
            .merge(line)
            .attr("x1", xScale(thresholdValue))
            .attr("x2", xScale(thresholdValue))
            .attr("y1", 0)
            .attr("y2", height - margin.top - margin.bottom)
            .attr("stroke", color)
            .attr("stroke-width", 4)
            .attr("opacity", 0.9);
            
        // Add hitbox and arrows for interaction
        this.addThresholdInteraction(thresholdMerge, xScale, thresholdValue, height, margin, color);
        
        // Ensure the threshold group is always on top
        thresholdMerge.raise();
        
        return thresholdMerge;
    },
    
    // Add interactive elements to threshold
    addThresholdInteraction: function(thresholdGroup, xScale, thresholdValue, height, margin, color = "red") {
        // Add or update the hitbox
        const hitbox = thresholdGroup.selectAll(".threshold-hitbox")
            .data([null]);
            
        hitbox.enter()
            .append("rect")
            .attr("class", "threshold-hitbox")
            .merge(hitbox)
            .attr("x", xScale(thresholdValue) - 10)
            .attr("width", 20)
            .attr("y", 0)
            .attr("height", height - margin.top - margin.bottom)
            .attr("fill", "transparent");
            
        // Add or update the arrows
        const arrowSize = 10;
        const arrowY = 10; // Position arrows near the top
        const arrowData = [
            { direction: "left", y: arrowY },
            { direction: "right", y: arrowY }
        ];
        
        const arrows = thresholdGroup.selectAll(".threshold-arrow")
            .data(arrowData);
            
        arrows.enter()
            .append("path")
            .attr("class", "threshold-arrow")
            .merge(arrows)
            .attr("d", d => {
                const x = xScale(thresholdValue + (d.direction === "left" ? -0.33 : 0.33));
                const y = d.y;
                if (d.direction === "left") {
                    return `M${x},${y} l${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                } else {
                    return `M${x},${y} l-${arrowSize},-${arrowSize / 2} l0,${arrowSize} Z`;
                }
            })
            .attr("fill", color);
            
        // Remove any excess elements
        arrows.exit().remove();
    },
    
    // Add drag behavior to threshold
    addThresholdDrag: function(thresholdGroup, xScale, xDomain, onDrag) {
        thresholdGroup.call(d3.drag()
            .on("drag", function(event) {
                // Get new threshold value from drag position
                let newThreshold = xScale.invert(event.x);
                // Constrain to the x-axis domain
                newThreshold = Math.max(xDomain[0], Math.min(xDomain[1], newThreshold));
                
                // Call the provided callback with the new threshold value
                if (typeof onDrag === 'function') {
                    onDrag(newThreshold, this);
                }
            }));
    }
};

// Make plotting utilities available globally
window.PlotUtils = PlotUtils; 