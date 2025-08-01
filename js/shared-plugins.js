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
            legendItem.style.display = 'inline-flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.marginRight = '20px';
            
            const marker = document.createElement('span');
            
            if (isDashed) {
                // Create dashed line marker
                marker.style.display = 'inline-block';
                marker.style.width = '40px';
                marker.style.height = '3px';
                marker.style.backgroundColor = 'transparent';
                marker.style.borderBottom = `3px dashed ${color}`;
                marker.style.marginRight = '10px';
            } else {
                // Create line with solid circle marker in the middle
                marker.style.display = 'inline-block';
                marker.style.width = '40px';
                marker.style.height = '3px';
                marker.style.backgroundColor = 'transparent';
                marker.style.borderBottom = `3px solid ${color}`;
                marker.style.position = 'relative';
                marker.style.marginRight = '10px';
                
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
