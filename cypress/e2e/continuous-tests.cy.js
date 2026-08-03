// Custom tests for E2P Simulator (Effect Size to Predictive Value) - Continuous Mode

describe('E2P Simulator - Continuous Mode Testing', () => {
  beforeEach(() => {
    // Visit the application before each test
    cy.visit('index.html');
  });

  // Helper function to check numeric equality regardless of formatting
  const checkNumericValue = (element, expectedValue, tolerance = 0.01) => {
    cy.get(element).should(($el) => {
      // Handle both input elements and text elements
      const valueText = $el.is('input') ? $el.val() : $el.text();
      const actualValue = parseFloat(valueText);
      const expected = parseFloat(expectedValue);
      // Add a check for NaN in case parsing fails
      if (isNaN(actualValue)) {
        throw new Error(`Could not parse number from element ${element} with value '${valueText}'`);
      }
      expect(actualValue).to.be.closeTo(expected, tolerance); // Allow small differences
    });
  };

  const plotTraceSnapshot = (plotDiv) => JSON.stringify(
    plotDiv?.data?.map(({ x, y }) => ({ x, y }))
  );

  // Helper function to assert that an SVG path's 'd' attribute has changed
  const assertSvgPathChanged = (pathSelector, initialState) => {
    cy.get(pathSelector)
      .should('have.attr', 'd')
      .and('not.equal', initialState);
  };

  // Helper function to assert that a Plotly annotation text has changed
  const assertAnnotationChanged = (plotSelector, initialAnnotationText, annotationIndex = 0) => {
    cy.get(plotSelector)
      .then($div => {
        // Add checks to ensure the Plotly layout and annotations exist
        const layout = $div[0]?._fullLayout;
        expect(layout, `Plotly layout for ${plotSelector} should exist`).to.exist;
        const annotations = layout?.annotations;
        expect(annotations, `Annotations for ${plotSelector} should exist`).to.exist;
        expect(annotations.length, `Annotations array for ${plotSelector} should not be empty`).to.be.greaterThan(annotationIndex);
        
        const newAnnotationText = annotations[annotationIndex]?.text;
        expect(newAnnotationText, `Annotation text at index ${annotationIndex} for ${plotSelector} should exist`).to.exist;
        expect(newAnnotationText).to.not.equal(initialAnnotationText);
      });
  };

  it('loads successfully - continuous mode', () => {
    // Switch to continuous mode
    cy.get('#continuous-button').click();

    // Test that the app loads and essential elements are visible in continuous mode
    cy.get('#continuous-container').should('be.visible');
    
    // Check for specific plots in continuous mode
    cy.get('#distribution-plot-observed-cont', { timeout: 10000 }).should('be.visible');
    cy.get('#scatter-plot-observed-cont', { timeout: 10000 }).should('be.visible');
    cy.get('#roc-plot-cont', { timeout: 10000 }).should('be.visible');
    cy.get('#pr-plot-cont', { timeout: 10000 }).should('be.visible');
  });

  it('updates numeric inputs when sliders change in continuous mode', () => {
    // Switch to continuous mode
    cy.get('#continuous-button').click();

    // Test that moving each slider updates its corresponding number input

    // Pearson's r slider
    cy.get('#effect-slider-cont').invoke('val', 0.8).trigger('input');
    checkNumericValue('#true-pearson-r-cont', '0.8'); 
    
    // Reliability X slider
    cy.get('#reliability-x-slider-cont').invoke('val', 0.75).trigger('input');
    checkNumericValue('#reliability-x-number-cont', '0.75');

    // Reliability Y slider
    cy.get('#reliability-y-slider-cont').invoke('val', 0.55).trigger('input');
    checkNumericValue('#reliability-y-number-cont', '0.55');
    
    // Base Rate slider
    cy.get('#base-rate-slider-cont').invoke('val', 35.0).trigger('input');
    checkNumericValue('#base-rate-number-cont', '35.0');
  });

  it('updates plots when parameters change in continuous mode', () => {
    // Switch to continuous mode
    cy.get('#continuous-button').click();
    
    // Store initial state of plots
    let initialDistributionBarHeight, initialContourPath;
    let initialRocAucText, initialPrCurve;
    // Select the teal analytical density path in the observed distribution plot
    const distributionBarSelector = '#distribution-plot-observed-cont .teal-distribution'; 
    const contourSelector = '#scatter-plot-observed-cont .joint-contour';
    const scatterSelector = '#scatter-plot-observed-cont .scatter-point';

    // Contours plus a light scatter overlay
    cy.get(contourSelector).should('have.length.greaterThan', 0);
    cy.get(scatterSelector).should('have.length.greaterThan', 0);

    // Get initial distribution plot path
    cy.get(distributionBarSelector)
      .should('have.attr', 'd').then(d => { initialDistributionBarHeight = d; });
      
    // Get initial joint contour path
    cy.get(contourSelector).first()
      .should('have.attr', 'd').then(d => { initialContourPath = d; });

    // Get initial ROC and PR AUC annotations
    cy.get('#roc-plot-cont').then($div => { 
      initialRocAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      // expect(initialRocAucText).to.exist;
    });

    cy.get('#pr-plot-cont').then($div => {
      initialPrCurve = plotTraceSnapshot($div[0]);
    });

    // Change Pearson's r value and check for plot changes
    cy.get('#effect-slider-cont').invoke('val', 0.75).trigger('input');
    checkNumericValue('#true-pearson-r-cont', '0.75');
    // Check distribution path changed
    cy.get(distributionBarSelector)
      .should('have.attr', 'd').and('not.equal', initialDistributionBarHeight);

    // Check ROC annotation
    cy.get('#roc-plot-cont').should($div => {
      const newRocAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      expect(newRocAucText).to.not.equal(initialRocAucText);
    });
    // Check joint contour changed
    cy.get(contourSelector).first()
      .should('have.attr', 'd').and('not.equal', initialContourPath);

    
    // Store state again before changing reliability value
    cy.get(distributionBarSelector)
      .should('have.attr', 'd').then(d => { initialDistributionBarHeight = d; });
    cy.get('#pr-plot-cont').then($div => {
      initialPrCurve = plotTraceSnapshot($div[0]);
    });

    // Change X reliability value and check for plot changes
    cy.get('#reliability-x-slider-cont').invoke('val', 0.85).trigger('input');
    checkNumericValue('#reliability-x-number-cont', '0.85');
    // Check distribution path
    cy.get(distributionBarSelector)
      .should('have.attr', 'd').and('not.equal', initialDistributionBarHeight);
    // Check PR annotation
    cy.get('#pr-plot-cont').should($div => {
      expect(plotTraceSnapshot($div[0])).to.not.equal(initialPrCurve);
    });
      
    // Store state again before changing Y reliability value
    cy.get(distributionBarSelector)
      .should('have.attr', 'd').then(d => { initialDistributionBarHeight = d; });
    cy.get('#pr-plot-cont').then($div => {
      initialPrCurve = plotTraceSnapshot($div[0]);
    });

    // Change Y reliability value and check for plot changes
    cy.get('#reliability-y-slider-cont').invoke('val', 0.85).trigger('input');
    checkNumericValue('#reliability-y-number-cont', '0.85');
    // Check distribution path
    cy.get(distributionBarSelector)
      .should('have.attr', 'd').and('not.equal', initialDistributionBarHeight);
    // Check PR annotation
    cy.get('#pr-plot-cont').should($div => {
      expect(plotTraceSnapshot($div[0])).to.not.equal(initialPrCurve);
    });
    
    // Store state again before changing base rate
    cy.get(distributionBarSelector)
      .should('have.attr', 'd').then(d => { initialDistributionBarHeight = d; });
    cy.get('#pr-plot-cont').then($div => {
      initialPrCurve = plotTraceSnapshot($div[0]);
    });

    // Change base rate value and check for plot changes
    cy.get('#base-rate-slider-cont').invoke('val', 65.0).trigger('input');
    checkNumericValue('#base-rate-number-cont', '65.0');
    // Check distribution path
    cy.get(distributionBarSelector)
      .should('have.attr', 'd').and('not.equal', initialDistributionBarHeight);
    // Check PR annotation
    cy.get('#pr-plot-cont').should($div => {
      expect(plotTraceSnapshot($div[0])).to.not.equal(initialPrCurve);
    });
  });

  it('correctly calculates true effect size metrics from Pearson\'s r in continuous mode', () => {
    // Switch to continuous mode
    cy.get('#continuous-button').click();
    
    // Select "True" effects mode 
    cy.get('#true-button-cont').click();
    
    // Set Pearson's r to 0.69 using the number input
    cy.get('#true-pearson-r-cont').clear().type('0.69').blur(); // Input r and lose focus
    
    cy.wait(300);
    
    // Check related true metrics are calculated correctly
    checkNumericValue('#true-R-squared-cont', '0.48', 0.1);
    checkNumericValue('#true-cohens-d-cont', '1.32', 0.1);
    checkNumericValue('#true-cohens-da-cont', '1.32', 0.1);
    checkNumericValue('#true-pb-r-cont', '0.55', 0.1);
    checkNumericValue('#true-rank-biserial-cont', '0.65', 0.1);
    checkNumericValue('#true-glass-d-cont', '1.32', 0.1);
    checkNumericValue('#true-odds-ratio-cont', '10.91', 0.3);
    checkNumericValue('#true-log-odds-ratio-cont', '2.39', 0.2);
  });

  it('correctly calculates observed effect size metrics in continuous mode', () => {
    // Switch to continuous mode
    cy.get('#continuous-button').click();
    
    // Set True Pearson's r
    cy.get('#true-pearson-r-cont').clear().type('0.69').blur();
    
    // Set Reliability X (ICC X)
    cy.get('#reliability-x-slider-cont').invoke('val', 0.42).trigger('input');
    
    // Set Reliability Y (ICC Y)
    cy.get('#reliability-y-slider-cont').invoke('val', 0.42).trigger('input');
    
    // Set Base Rate
    cy.get('#base-rate-slider-cont').invoke('val', 66.6).trigger('input').trigger('change');

    cy.wait(300);
    
    // Check related OBSERVED metrics are calculated correctly
    checkNumericValue('#observed-R-squared-cont', '0.08', 0.1);
    checkNumericValue('#observed-cohens-d-cont', '0.49', 0.1);
    checkNumericValue('#observed-cohens-da-cont', '0.49', 0.1);
    checkNumericValue('#observed-pb-r-cont', '0.23', 0.1);
    checkNumericValue('#observed-rank-biserial-cont', '0.27', 0.1);
    checkNumericValue('#observed-glass-d-cont', '0.49', 0.1);
    checkNumericValue('#observed-odds-ratio-cont', '2.43', 0.3);
    checkNumericValue('#observed-log-odds-ratio-cont', '0.89', 0.2);
  });

  it('correctly calculates true predictive metrics in continuous mode', () => {
    // Switch to continuous mode
    cy.get('#continuous-button').click();
    
    // Select "True" effects mode 
    cy.get('#true-button-cont').click();
       
    // Set Pearson's r to 0.69 using the number input
    cy.get('#true-pearson-r-cont').clear().type('0.69').trigger('change'); // Use trigger('change') instead of blur()

    // Set Base Rate
    cy.get('#base-rate-slider-cont').invoke('val', 66.6).trigger('input').trigger('change');

    cy.wait(300);

    // Expected predictive values with tolerance
    const tolerance = 0.1;
    
    // Check predictive metrics using correct -cont selectors
    checkNumericValue('#accuracy-value-cont', '0.72', tolerance);
    checkNumericValue('#sensitivity-value-cont', '0.66', tolerance);
    checkNumericValue('#specificity-value-cont', '0.82', tolerance);
    checkNumericValue('#balanced-accuracy-value-cont', '0.74', tolerance);
    checkNumericValue('#npv-value-cont', '0.55', tolerance);
    checkNumericValue('#ppv-value-cont', '0.88', tolerance);
    checkNumericValue('#f1-value-cont', '0.76', tolerance);
    checkNumericValue('#mcc-value-cont', '0.46', tolerance);
    
    // Check plot ROC-AUC values
    cy.get('#roc-plot-cont').then($div => {
      const aucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      const aucValue = parseFloat(aucText.replace('ROC-AUC: ', ''));
      expect(aucValue).to.be.closeTo(0.83, tolerance);
    });
    
    cy.get('#pr-plot-cont').then($div => {
      const prAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      const prAucValue = parseFloat(prAucText.replace('PR-AUC: ', ''));
      expect(prAucValue).to.be.closeTo(0.90, tolerance);
    });
  });


  it('correctly calculates observed predictive metrics in continuous mode', () => {
    // Switch to continuous mode
    cy.get('#continuous-button').click();
    
    // Select "True" effects mode 
    cy.get('#observed-button-cont').click();
       
    // Set Pearson's r to 0.69 using the number input
    cy.get('#true-pearson-r-cont').clear().type('0.69').trigger('change'); // Use trigger('change') instead of blur()

    // Set Reliability X (ICC X)
    cy.get('#reliability-x-slider-cont').invoke('val', 0.42).trigger('input');

    // Set Reliability Y (ICC Y)
    cy.get('#reliability-y-slider-cont').invoke('val', 0.42).trigger('input');

    // Set Base Rate
    cy.get('#base-rate-slider-cont').invoke('val', 66.6).trigger('input').trigger('change');

    cy.wait(300);

    // Expected predictive values with tolerance
    const tolerance = 0.1;
    
    // Check predictive metrics using correct -cont selectors
    checkNumericValue('#accuracy-value-cont', '0.59', tolerance);
    checkNumericValue('#sensitivity-value-cont', '0.56', tolerance);
    checkNumericValue('#specificity-value-cont', '0.63', tolerance);
    checkNumericValue('#balanced-accuracy-value-cont', '0.60', tolerance);
    checkNumericValue('#npv-value-cont', '0.42', tolerance);
    checkNumericValue('#ppv-value-cont', '0.75', tolerance);
    checkNumericValue('#f1-value-cont', '0.64', tolerance);
    checkNumericValue('#mcc-value-cont', '0.18', tolerance);
    
    // Check plot ROC-AUC values
    cy.get('#roc-plot-cont').then($div => {
      const aucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      const aucValue = parseFloat(aucText.replace('ROC-AUC: ', ''));
      expect(aucValue).to.be.closeTo(0.64, tolerance);
    });
    
    cy.get('#pr-plot-cont').then($div => {
      const prAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      const prAucValue = parseFloat(prAucText.replace('PR-AUC: ', ''));
      expect(prAucValue).to.be.closeTo(0.76, tolerance);
    });
  });

  
  it('updates numeric inputs of Multivariate R2 calculator when sliders change', () => {

    // Switch to continuous mode
    cy.get('#continuous-button').click();

    // Predictor correlation slider remains unrestricted
    cy.get('#predictor-correlation-slider').invoke('val', 0.8).trigger('input');
    checkNumericValue('#predictor-correlation', '0.8');
    checkNumericValue('#collinearity', '0.05');
    
    // Collinearity slider remains unrestricted
    cy.get('#collinearity-slider').invoke('val', 0.4).trigger('input');
    checkNumericValue('#collinearity', '0.4');

    // Number of predictors remains unrestricted and sets the plotted range
    cy.get('#num-predictors-r2-slider').invoke('val', 15).trigger('input');
    checkNumericValue('#num-predictors-r2', '15');

    // r=.8 and rij=.4 are valid for p=1 and p=2 only; the curve ends there.
    cy.get('#r2Plot').then($canvas => {
      const chart = $canvas[0].ownerDocument.defaultView.Chart.getChart($canvas[0]);
      const activeCurve = chart.data.datasets.find(dataset => dataset.isActive);
      expect(activeCurve.data).to.have.length(15);
      expect(activeCurve.data[0]).to.be.a('number');
      expect(activeCurve.data[1]).to.be.a('number');
      expect(activeCurve.data.slice(2).every(value => value === null)).to.equal(true);
    });

    cy.get('#r2PrAucPlot').then($canvas => {
      const chart = $canvas[0].ownerDocument.defaultView.Chart.getChart($canvas[0]);
      const activeCurve = chart.data.datasets.find(dataset => dataset.isActive);
      expect(activeCurve.data.slice(2).every(value => value === null)).to.equal(true);
    });

  });  


});
