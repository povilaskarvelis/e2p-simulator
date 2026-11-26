// The caller positions the handle at the threshold and scales its local units to CSS pixels.
function drawThresholdHandle(group, height, arrowWidth) {
    const strokeWidth = 4;
    const arrowBase = strokeWidth / 2 + 5;

    group.selectAll(".threshold-line").data([null]).join("line")
        .attr("class", "threshold-line")
        .attr("y2", height)
        .attr("stroke", "red")
        .attr("stroke-width", strokeWidth)
        .attr("opacity", 0.9);

    group.selectAll(".threshold-hitbox").data([null]).join("rect")
        .attr("class", "threshold-hitbox")
        .attr("x", -10)
        .attr("width", 20)
        .attr("height", height)
        .attr("fill", "transparent");

    group.selectAll(".threshold-arrow").data([-1, 1]).join("path")
        .attr("class", "threshold-arrow")
        .attr("d", direction => {
            const baseX = direction * arrowBase;
            const tipX = direction * (arrowBase + arrowWidth);
            return `M${baseX},${arrowWidth / 2} L${tipX},${arrowWidth} L${baseX},${1.5 * arrowWidth} Z`;
        })
        .attr("fill", "red");
}

// Both outcome modes display these curves with the same axes and AUC readouts.
function discriminationCurveLayout(curve, auc, tickFontSize = 12) {
    const compact = compactLayout.matches;
    const roc = curve === "ROC";
    const labelAtTop = !roc && auc < 0.27;
    const labelOnRight = roc || labelAtTop;
    const axis = (shortTitle, fullTitle) => ({
        title: compact ? shortTitle : fullTitle,
        range: [0, 1], dtick: 1, showgrid: false,
        titlefont: { size: compact ? 16 : 15 }
    });

    return {
        title: compact ? { text: `${curve} curve`, font: { size: 16 } } : undefined,
        xaxis: roc ? axis("1 − specificity", "1 - Specificity (FPR)") : axis("Recall", "Recall (TPR)"),
        yaxis: roc ? axis("Sensitivity", "Sensitivity (TPR)") : axis("Precision", "Precision (PPV)"),
        margin: compact ? { t: 32, l: 44, r: 12, b: 46 } : { t: 20, l: 50, r: 30, b: 40 },
        showlegend: false,
        autosize: true,
        font: { size: compact ? 14 : tickFontSize },
        annotations: [{
            x: labelOnRight ? 0.95 : 0.05, y: labelAtTop ? 0.95 : 0.05,
            xanchor: labelOnRight ? "right" : "left", yanchor: labelAtTop ? "top" : "bottom",
            xref: "paper", yref: "paper", showarrow: false,
            text: `${compact ? "" : curve + "-"}AUC: ${auc.toFixed(2)}`,
            font: { size: compact ? 14 : 16, color: "black" }
        }]
    };
}

const targetLineLabelPlugin = {
    id: 'targetLineLabel',
    afterDraw: (chart) => {
        const thresholdDataset = chart.data.datasets[0];
        if (!thresholdDataset || !thresholdDataset.annotationLabel) {
            return;
        }

        const ctx = chart.ctx;
        const yAxis = chart.scales.y;
        const xAxis = chart.scales.x;
        
        const thresholdValue = thresholdDataset.data[0];
        if (thresholdValue === undefined || thresholdValue === null) return;
        
        const y = yAxis.getPixelForValue(thresholdValue);
        if (y < yAxis.top || y > yAxis.bottom) return;

        const x = xAxis.left + 5;

        ctx.save();
        ctx.font = '14px Arial';
        ctx.fillStyle = thresholdDataset.borderColor || '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        
        const labelText = thresholdDataset.annotationLabel;

        ctx.fillText(labelText, x, y - 5);
        ctx.restore();
    }
};

// Shared Chart.js plugins
const customLegendPlugin = {
    id: 'customLegend',
    afterRender: (chart) => {
        // Get the legend elements
        const legendItems = chart.legend.legendItems;
        // Find the container relative to the chart's main container, not just canvas parent
        const chartContainerElement = chart.canvas.closest('[id$="Container"]'); // Find closest container ending with 'Container'
        if (!chartContainerElement) {
            console.error('Custom Legend Plugin: Could not find parent container (e.g., #chartContainer)');
            return;
        }
        const legendContainer = chartContainerElement.querySelector('.chart-legend');
        
        if (!legendContainer) {
            // Optional: Log if legend container itself is missing, though handled above usually
            // console.warn('Custom Legend Plugin: Legend container (.chart-legend) not found within', chartContainerElement);
            return;
        }
        
        // Clear the existing legend
        legendContainer.innerHTML = '';
        
        // Create custom legend items
        chart.data.datasets.forEach((dataset, index) => {
            if (!chart.isDatasetVisible(index) || !dataset.label || dataset.isActive) {
                return;
            }
            
            const item = {
                text: dataset.label,
                fillStyle: dataset.backgroundColor,
                strokeStyle: dataset.borderColor,
                lineWidth: dataset.borderWidth,
                hidden: !chart.isDatasetVisible(index),
                index: index
            };

            const color = dataset.borderColor;
            const isDashed = dataset.borderDash && dataset.borderDash.length > 0;
            
            const legendItem = document.createElement('div');
            legendItem.className = 'chart-legend-item';
            
            const marker = document.createElement('span');
            marker.className = 'chart-legend-marker';
            
            if (isDashed) {
                // Create dashed line marker
                marker.style.display = 'inline-block';
                marker.style.height = '3px';
                marker.style.backgroundColor = 'transparent';
                marker.style.borderBottom = `3px dashed ${color}`;
            } else {
                // Create line with solid circle marker in the middle
                marker.style.display = 'inline-block';
                marker.style.height = '3px';
                marker.style.backgroundColor = 'transparent';
                marker.style.borderBottom = `3px solid ${color}`;
                marker.style.position = 'relative';
                
                const circle = document.createElement('span');
                circle.style.width = '12px';
                circle.style.height = '12px';
                circle.style.borderRadius = '50%';
                circle.style.backgroundColor = dataset.pointBackgroundColor || color;
                circle.style.position = 'absolute';
                circle.style.top = '-5px';
                circle.style.left = '50%';
                circle.style.transform = 'translateX(-50%)';
                
                marker.appendChild(circle);
            }
            
            const text = document.createElement('span');
            text.innerHTML = item.text;
            
            legendItem.appendChild(marker);
            legendItem.appendChild(text);
            legendContainer.appendChild(legendItem);
        });
    }
};

// Export the plugin
window.customLegendPlugin = customLegendPlugin;
window.targetLineLabelPlugin = targetLineLabelPlugin;

// Tooltip positioning
document.addEventListener('DOMContentLoaded', function() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            const rect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const tooltipHeight = 40; // Approximate height of tooltip
            
            // Calculate position
            let x = rect.left + rect.width/2;
            let y = rect.top;
            
            // If tooltip would go off the top of the screen, show it below the element instead
            if (y - tooltipHeight < 0) {
                y = rect.bottom;
                element.style.setProperty('--tooltip-transform', 'translate(-50%, 0)');
            } else {
                element.style.setProperty('--tooltip-transform', 'translate(-50%, -100%)');
            }
            
            // Set the position
            element.style.setProperty('--tooltip-x', `${x}px`);
            element.style.setProperty('--tooltip-y', `${y}px`);
        });
    });
});
