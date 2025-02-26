// Shared Chart.js plugins
const customLegendPlugin = {
    id: 'customLegend',
    afterRender: (chart) => {
        // Get the legend elements
        const legendItems = chart.legend.legendItems;
        const legendContainer = chart.canvas.parentNode.querySelector('.chart-legend');
        
        if (!legendContainer) return;
        
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
                circle.style.width = '14px';
                circle.style.height = '14px';
                circle.style.borderRadius = '50%';
                circle.style.backgroundColor = 'white';
                circle.style.border = `3px solid ${color}`;
                circle.style.position = 'absolute';
                circle.style.top = '-4px';
                circle.style.left = '50%';
                circle.style.transform = 'translateX(-50%)';
                circle.style.boxSizing = 'border-box';
                
                marker.appendChild(circle);
            }
            
            const text = document.createElement('span');
            text.innerText = item.text;
            
            legendItem.appendChild(marker);
            legendItem.appendChild(text);
            legendContainer.appendChild(legendItem);
        });
    }
};

// Export the plugin
window.customLegendPlugin = customLegendPlugin; 