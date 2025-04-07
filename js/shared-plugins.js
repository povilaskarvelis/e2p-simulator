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
        legendItems.forEach((item, index) => {
            const dataset = chart.data.datasets[index];
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
                marker.style.width = '30px';
                marker.style.height = '2px';
                marker.style.backgroundColor = 'transparent';
                marker.style.borderBottom = `2px dashed ${color}`;
                marker.style.marginRight = '8px';
            } else {
                // Create line with hollow circle marker in the middle
                marker.style.display = 'inline-block';
                marker.style.width = '30px';
                marker.style.height = '2px';
                marker.style.backgroundColor = 'transparent';
                marker.style.borderBottom = `2px solid ${color}`;
                marker.style.position = 'relative';
                marker.style.marginRight = '8px';
                
                const circle = document.createElement('span');
                circle.style.width = '12px';
                circle.style.height = '12px';
                circle.style.borderRadius = '50%';
                circle.style.backgroundColor = 'white';
                circle.style.border = `3px solid ${color}`;
                circle.style.position = 'absolute';
                circle.style.top = '-5px';
                circle.style.left = '50%';
                circle.style.transform = 'translateX(-50%)';
                circle.style.boxSizing = 'border-box';
                
                marker.appendChild(circle);
            }
            
            const text = document.createElement('span');
            text.innerHTML = item.text;
            
            legendItem.appendChild(marker);
            legendItem.appendChild(text);
            legendContainer.appendChild(legendItem);
        });

        // --- Manual Aspect Ratio Enforcement --- 
        // Find the wrapper div for the canvas
        const wrapper = chart.canvas.parentNode;
        // Make selector more general to match dPlotWrapper or r2PlotWrapper
        if (wrapper && wrapper.id.endsWith('PlotWrapper')) { 
            const aspectRatio = 2; // Define desired aspect ratio (width / height)
            const newWidth = wrapper.offsetWidth; // Get current width after layout
            const newHeight = newWidth / aspectRatio; // Calculate required height
            
            // Set the wrapper height explicitly
            wrapper.style.height = `${newHeight}px`;
        }

        // Explicitly tell Chart.js to resize within the new dimensions
        // Use requestAnimationFrame to run just before the next repaint
        requestAnimationFrame(() => {
            // Only resize if the chart is still attached to the DOM and not destroyed
            // (Chart.js might set canvas to null on destroy)
            if (chart.canvas && chart.attached) {
                try {
                    chart.resize();
                } catch (e) {
                    console.error("Error during chart.resize within requestAnimationFrame:", e, chart);
                }
            }
        });
    }
};

// Export the plugin
window.customLegendPlugin = customLegendPlugin;

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