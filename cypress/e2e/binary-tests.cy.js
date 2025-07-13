// Custom tests for E2P Simulator (Effect Size to Predictive Value) - Binary Mode

describe('E2P Simulator - Binary Mode Testing', () => {
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

  it('loads successfully - binary mode', () => {
    // Test that the app loads and essential elements are visible
    cy.get('#binary-container').should('be.visible');
    cy.get('#overlap-plot').should('be.visible');
    cy.get('#roc-plot').should('be.visible');
    cy.get('#pr-plot').should('be.visible');
  });

  it('updates numeric inputs when sliders change in binary mode', () => {
    // Test that moving each slider updates its corresponding number input

    // Cohen's d slider
    cy.get('#difference-slider').invoke('val', 0.8).trigger('input');
    checkNumericValue('#true-difference-number-bin', '0.8'); 
    
    // Base Rate slider
    cy.get('#base-rate-slider').invoke('val', 35.0).trigger('input');
    checkNumericValue('#base-rate-number', '35.0');

    // ICC1 slider
    cy.get('#icc1-slider').invoke('val', 0.75).trigger('input');
    checkNumericValue('#icc1-number', '0.75');

    // ICC2 slider
    cy.get('#icc2-slider').invoke('val', 0.55).trigger('input');
    checkNumericValue('#icc2-number', '0.55');

    // Kappa slider
    cy.get('#kappa-slider').invoke('val', 0.65).trigger('input');
    checkNumericValue('#kappa-number', '0.65');
  });  

  it('correctly calculates true effect size metrics from Cohens d in binary mode', () => {
    // Ensure we're in binary mode
    cy.get('#binary-button').click();
    
    // Select "True" effects mode 
    cy.get('#true-button-bin').click();
    
    // Set Cohen's d to 1.1 using the slider
    cy.get('#difference-slider').invoke('val', 1.1).trigger('input');
    
    // Verify Cohen's d input field shows the value we set
    checkNumericValue('#true-difference-number-bin', '1.1');
    
    // Check related metrics are calculated correctly
    checkNumericValue('#true-odds-ratio-bin', '7.39', 0.05);
    checkNumericValue('#true-log-odds-ratio-bin', '2', 0.05);
    
    // Set base rate to 20%
    cy.get('#base-rate-slider').invoke('val', 20.0).trigger('input');
    checkNumericValue('#base-rate-number', '20.0');
    
    // Check if point-biserial r and eta squared update correctly with the new base rate
    checkNumericValue('#true-pb-r-bin', '0.40', 0.02);
    checkNumericValue('#true-eta-squared-bin', '0.16', 0.02);
  });


  it('correctly calculates true effect size metrics from Odds Ratio in binary mode', () => {
    // Ensure we're in binary mode
    cy.get('#binary-button').click();
    
    // Select "True" effects mode 
    cy.get('#true-button-bin').click();
    
    // Set True Odds Ratio to 7.35 using the number input
    cy.get('#true-odds-ratio-bin').clear().type('7.39').blur(); // Input OR and lose focus
  
    // Verify related metrics (Cohen's d and Log OR) are calculated correctly
    checkNumericValue('#true-difference-number-bin', '1.1'); 
    checkNumericValue('#true-log-odds-ratio-bin', '2', 0.05);
    
    // Set base rate to 20%
    cy.get('#base-rate-slider').invoke('val', 20.0).trigger('input');
    checkNumericValue('#base-rate-number', '20.0');
    
    // Check if point-biserial r and eta squared update correctly with the new base rate
    checkNumericValue('#true-pb-r-bin', '0.40', 0.02);
    checkNumericValue('#true-eta-squared-bin', '0.16', 0.02);
  });

  it('correctly calculates true effect size metrics from Log Odds Ratio in binary mode', () => {
    // Ensure we're in binary mode
    cy.get('#binary-button').click();
    
    // Select "True" effects mode 
    cy.get('#true-button-bin').click();
    
    // Set True Log Odds Ratio to 2 using the number input
    cy.get('#true-log-odds-ratio-bin').clear().type('2').blur(); // Input Log OR and lose focus

    // Verify related metrics (Cohen's d and Log OR) are calculated correctly
    checkNumericValue('#true-difference-number-bin', '1.1'); 
    checkNumericValue('#true-odds-ratio-bin', '7.35', 0.05);
    
    // Set base rate to 20%
    cy.get('#base-rate-slider').invoke('val', 20.0).trigger('input');
    checkNumericValue('#base-rate-number', '20.0');
    
    // Check if point-biserial r and eta squared update correctly with the new base rate
    checkNumericValue('#true-pb-r-bin', '0.40', 0.02);
    checkNumericValue('#true-eta-squared-bin', '0.16', 0.02);
  });
  
  it('correctly calculates attenuated effect size metrics in binary mode', () => {
    // Test that changing the difference slider updates the corresponding input fields
    
    // Ensure we're in binary mode
    cy.get('#binary-button').click();
    
    // Set to observed mode to see attenuation effects
    cy.get('#observed-button-bin').click();
    
    // Set Cohen's d to 1.1 using the slider
    cy.get('#difference-slider').invoke('val', 1.1).trigger('input');
    
    // Verify true Cohen's d input shows the value we set
    checkNumericValue('#true-difference-number-bin', '1.1');
    
    // Set reliability values
    cy.get('#icc1-slider').invoke('val', 0.6).trigger('input');
    checkNumericValue('#icc1-number', '0.6');
    
    cy.get('#icc2-slider').invoke('val', 0.6).trigger('input');
    checkNumericValue('#icc2-number', '0.6');
    
    cy.get('#kappa-slider').invoke('val', 0.4).trigger('input');
    checkNumericValue('#kappa-number', '0.4');
    
    // Set base rate to 20%
    cy.get('#base-rate-slider').invoke('val', 20.0).trigger('input');
    checkNumericValue('#base-rate-number', '20.0');
    
    // Check that all observed metrics are correctly attenuated
    checkNumericValue('#observed-difference-number-bin', '0.65'); // Attenuated Cohen's d
    checkNumericValue('#observed-odds-ratio-bin', '3.31', 0.05); // Attenuated OR
    checkNumericValue('#observed-log-odds-ratio-bin', '1.2', 0.05); // Attenuated log OR
    checkNumericValue('#observed-pb-r-bin', '0.25', 0.02); // Attenuated point-biserial r
    checkNumericValue('#observed-eta-squared-bin', '0.07', 0.02); // Attenuated eta squared
  });

  it('correctly calculates predictive metrics for true effects in binary mode', () => {
    // Set specific parameter values
    cy.get('#binary-button').click(); // Ensure we're in binary mode
    cy.get('#true-button-bin').click(); // Ensure we're in true effects mode
    
    // Set true Cohen's d to 1.69
    cy.get('#true-difference-number-bin').clear().type('1.69').trigger('change');
    
    // Set base rate to 77.7%
    cy.get('#base-rate-slider').invoke('val', 77.7).trigger('input');
    checkNumericValue('#base-rate-number', '77.7');
    
    // Give app time to update calculations
    cy.wait(500);
    
    // Expected values with tolerance of ±0.01
    // This accounts for small differences in calculation methods or rounding
    const tolerance = 0.01;
    
    // Check all metrics
    cy.get('#accuracy-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.85, tolerance);
    });
    
    cy.get('#sensitivity-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.95, tolerance);
    });
    
    cy.get('#specificity-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.50, tolerance);
    });
    
    cy.get('#balanced-accuracy-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.73, tolerance);
    });
    
    cy.get('#npv-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.76, tolerance);
    });
    
    cy.get('#precision-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.87, tolerance);
    });
    
    cy.get('#f1-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.91, tolerance);
    });
    
    cy.get('#mcc-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.53, tolerance);
    });
    
    // Check plot values too (ROC-AUC and PR-AUC)
    cy.get('#roc-plot').then($div => {
      const aucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      const aucValue = parseFloat(aucText.replace('ROC-AUC: ', ''));
      expect(aucValue).to.be.closeTo(0.88, tolerance);
    });
    
    cy.get('#pr-plot').then($div => {
      const prAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      const prAucValue = parseFloat(prAucText.replace('PR-AUC: ', ''));
      expect(prAucValue).to.be.closeTo(0.96, tolerance);
    });
  });

  it('correctly calculates predictive metrics for observed effects in binary mode', () => {
    // Set specific parameter values
    cy.get('#binary-button').click(); // Ensure we're in binary mode
    cy.get('#observed-button-bin').click(); // Ensure we're in observed mode
    
    // Set true Cohen's d to 1.69
    cy.get('#true-difference-number-bin').clear().type('1.69').trigger('change');
    
    // Set reliability values
    cy.get('#icc1-slider').invoke('val', 0.69).trigger('input');
    checkNumericValue('#icc1-number', '0.69');
    
    cy.get('#icc2-slider').invoke('val', 0.69).trigger('input');
    checkNumericValue('#icc2-number', '0.69');
    
    cy.get('#kappa-slider').invoke('val', 0.42).trigger('input');
    checkNumericValue('#kappa-number', '0.42');
    
    // Set base rate to 77.7%
    cy.get('#base-rate-slider').invoke('val', 77.7).trigger('input');
    checkNumericValue('#base-rate-number', '77.7');
    
    // Give app time to update calculations
    cy.wait(500);
    
    // Expected values with tolerance of ±0.01
    // This accounts for small differences in calculation methods or rounding
    const tolerance = 0.01;
    
    // Check all metrics
    cy.get('#accuracy-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.78, tolerance);
    });
    
    cy.get('#sensitivity-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.86, tolerance);
    });
    
    cy.get('#specificity-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.50, tolerance);
    });
    
    cy.get('#balanced-accuracy-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.68, tolerance);
    });
    
    cy.get('#npv-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.51, tolerance);
    });
    
    cy.get('#precision-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.86, tolerance);
    });
    
    cy.get('#f1-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.86, tolerance);
    });
    
    cy.get('#mcc-value').should($el => {
      const value = parseFloat($el.text());
      expect(value).to.be.closeTo(0.37, tolerance);
    });
    
    // Check plot values too (ROC-AUC and PR-AUC)
    cy.get('#roc-plot').then($div => {
      const aucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      const aucValue = parseFloat(aucText.replace('ROC-AUC: ', ''));
      expect(aucValue).to.be.closeTo(0.78, tolerance);
    });
    
    cy.get('#pr-plot').then($div => {
      const prAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      const prAucValue = parseFloat(prAucText.replace('PR-AUC: ', ''));
      expect(prAucValue).to.be.closeTo(0.92, tolerance);
    });
  });

  it('updates plots when reliability values change in binary mode', () => {
    // Test that changing reliability values affects the visualizations

    // Store initial state of plots
    let initialOverlapPath, initialRocAucText, initialPrAucText;

    cy.get('#overlap-plot .distribution').eq(1) // Get the second distribution path
      .should('have.attr', 'd').then(d => { initialOverlapPath = d; });

    cy.get('#roc-plot').then($div => { 
      initialRocAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      // expect(initialRocAucText).to.exist; // Optional: Ensure we captured initial state
    });

    cy.get('#pr-plot').then($div => {
      initialPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      // expect(initialPrAucText).to.exist; // Optional: Ensure we captured initial state
    });

    // Change ICC1 value and check for plot changes
    cy.get('#icc1-slider').invoke('val', 0.80).trigger('input');
    checkNumericValue('#icc1-number', '0.80');
    cy.get('#overlap-plot .distribution').eq(1)
       .should('have.attr', 'd').and('not.equal', initialOverlapPath);
    cy.get('#roc-plot').then($div => {
       const newRocAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
       expect(newRocAucText).to.not.equal(initialRocAucText);
     });
    
    // Store state again before changing ICC2
    cy.get('#overlap-plot .distribution').eq(1)
      .should('have.attr', 'd').then(d => { initialOverlapPath = d; });
    cy.get('#pr-plot').then($div => {
      initialPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      // expect(initialPrAucText).to.exist;
    });

    // Change ICC2 value and check PR plot change
    cy.get('#icc2-slider').invoke('val', 0.70).trigger('input');
    checkNumericValue('#icc2-number', '0.70');
    cy.get('#overlap-plot .distribution').eq(1)
       .should('have.attr', 'd').and('not.equal', initialOverlapPath);
    cy.get('#pr-plot').then($div => {
       const newPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
       expect(newPrAucText).to.not.equal(initialPrAucText);
     });

    // Store state again before changing Kappa
    cy.get('#overlap-plot .distribution').eq(1)
      .should('have.attr', 'd').then(d => { initialOverlapPath = d; });
    cy.get('#pr-plot').then($div => {
      initialPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      // expect(initialPrAucText).to.exist;
    });

    // Change Kappa value and check plot changes
    cy.get('#kappa-slider').invoke('val', 0.75).trigger('input');
    checkNumericValue('#kappa-number', '0.75');
    cy.get('#overlap-plot .distribution').eq(1)
       .should('have.attr', 'd').and('not.equal', initialOverlapPath);
    cy.get('#pr-plot').then($div => {
       const newPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
       expect(newPrAucText).to.not.equal(initialPrAucText);
     });
  });

  it('updates plots when base rate changes in binary mode', () => {
    // Test that changing the base rate updates the visualizations

    // Store initial state of plots
    let initialOverlapPath, initialPrAucText;

    cy.get('#overlap-plot .distribution').eq(1)
      .should('have.attr', 'd').then(d => { initialOverlapPath = d; });

    cy.get('#pr-plot').then($div => {
      initialPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      // expect(initialPrAucText).to.exist;
    });

    // Change Base Rate value and check for plot changes
    cy.get('#base-rate-slider').invoke('val', 25.0).trigger('input');
    checkNumericValue('#base-rate-number', '25.0');
    cy.get('#overlap-plot .distribution').eq(1)
       .should('have.attr', 'd').and('not.equal', initialOverlapPath);
    cy.get('#pr-plot').then($div => {
       const newPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
       expect(newPrAucText).to.not.equal(initialPrAucText);
     });
    
    // Store state again before changing Base Rate more drastically
    cy.get('#overlap-plot .distribution').eq(1)
      .should('have.attr', 'd').then(d => { initialOverlapPath = d; });
    cy.get('#pr-plot').then($div => {
      initialPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      // expect(initialPrAucText).to.exist;
    });

    // Change Base Rate value to a more extreme value
    cy.get('#base-rate-slider').invoke('val', 75.0).trigger('input');
    checkNumericValue('#base-rate-number', '75.0');
    cy.get('#overlap-plot .distribution').eq(1)
       .should('have.attr', 'd').and('not.equal', initialOverlapPath);
    cy.get('#pr-plot').then($div => {
       const newPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
       expect(newPrAucText).to.not.equal(initialPrAucText);
     });

  });

  it('updates numeric inputs of Mahalanobis D calculator when sliders change', () => {
    // Test that moving each slider updates its corresponding number input

    // Cohen's d slider
    cy.get('#effectSize-slider').invoke('val', 0.8).trigger('input');
    checkNumericValue('#effectSize', '0.8'); 
    
    // Collinearity slider
    cy.get('#correlation-slider').invoke('val', 0.4).trigger('input');
    checkNumericValue('#correlation', '0.4');

    // Predictors slider
    cy.get('#numVariables-slider').invoke('val', 15).trigger('input');
    checkNumericValue('#numVariables', '15');

  });  

}); 