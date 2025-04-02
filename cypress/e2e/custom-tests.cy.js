// Custom tests for E2P Simulator (Effect Size to Predictive Value)

describe('E2P Simulator - Interactive Testing', () => {
  beforeEach(() => {
    // Visit the application before each test
    cy.visit('index.html');
  });

  // Helper function to check numeric equality regardless of formatting
  const checkNumericValue = (element, expectedValue, tolerance = 0.01) => {
    cy.get(element).should(($el) => {
      const actualValue = parseFloat($el.val());
      const expected = parseFloat(expectedValue);
      expect(actualValue).to.be.closeTo(expected, tolerance); // Allow small differences
    });
  };

  it('loads successfully - binary mode', () => {
    // Test that the app loads and essential elements are visible
    cy.get('h1').should('contain', 'Understanding predictive value of effect sizes');
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
    // Use actual calculated values from the app with a small tolerance
    checkNumericValue('#observed-difference-number-bin', '0.65'); // Attenuated Cohen's d
    checkNumericValue('#observed-odds-ratio-bin', '3.31', 0.05); // Attenuated OR
    checkNumericValue('#observed-log-odds-ratio-bin', '1.2', 0.05); // Attenuated log OR
    checkNumericValue('#observed-pb-r-bin', '0.25', 0.02); // Attenuated point-biserial r
    checkNumericValue('#observed-eta-squared-bin', '0.07', 0.02); // Attenuated eta squared
  });


  it('updates plots when reliability values change', () => {
    // Test that changing reliability values affects the visualizations

    // Store initial state of plots
    let initialOverlapPath, initialRocAucText, initialPrAucText;

    cy.get('#overlap-plot .distribution').eq(1) // Get the second distribution path
      .should('have.attr', 'd').then(d => { initialOverlapPath = d; });

    cy.get('#roc-plot').then($div => { 
      initialRocAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
    });

    cy.get('#pr-plot').then($div => {
      initialPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
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

    // --- Optional: Add similar check for Kappa slider --- 

  });

  it('handles base rate changes and updates plots', () => {
    // Test that changing the base rate updates the visualizations

    // Store initial state of plots (PR plot is sensitive to base rate)
    let initialOverlapPath, initialPrAucText;

    cy.get('#overlap-plot .distribution').eq(1)
      .should('have.attr', 'd').then(d => { initialOverlapPath = d; });

    cy.get('#pr-plot').then($div => {
      initialPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
    });
    
    // Change Base Rate value
    cy.get('#base-rate-slider').invoke('val', 25.0).trigger('input');
    checkNumericValue('#base-rate-number', '25.0');
    
    // Check if plot attributes have changed
    cy.get('#overlap-plot .distribution').eq(1)
      .should('have.attr', 'd').and('not.equal', initialOverlapPath);

    cy.get('#pr-plot').then($div => {
      const newPrAucText = $div[0]?._fullLayout?.annotations?.[0]?.text;
      expect(newPrAucText).to.not.equal(initialPrAucText);
    });

    // ROC plot AUC is generally insensitive to base rate, so we don't check it here.
  });

  it('toggles between binary and continuous modes', () => {
    // Test mode switching functionality
    
    // App starts in binary mode, check that it's active
    cy.get('#binary-button').should('have.class', 'active');
    cy.get('#binary-container').should('be.visible');
    
    // Switch to continuous mode
    cy.get('#continuous-button').click();
    
    // Check that continuous mode is now active
    cy.get('#continuous-button').should('have.class', 'active');
    cy.get('#binary-button').should('not.have.class', 'active');
    
    // Check that the continuous container is visible
    cy.get('#continuous-container').should('be.visible');
    
  });

  it('loads successfully - continuous mode', () => {
    // Switch to continuous mode
    cy.get('#continuous-button').click();

    // Test that the app loads and essential elements are visible in continuous mode
    cy.get('h1').should('contain', 'Understanding predictive value of effect sizes');
    cy.get('#continuous-container').should('be.visible');
    
    // Check for specific plots in continuous mode
    cy.get('#distribution-plot-observed-cont', { timeout: 10000 }).should('be.visible');
    cy.get('#scatter-plot-observed-cont', { timeout: 10000 }).should('be.visible');
    cy.get('#roc-plot-cont', { timeout: 10000 }).should('be.visible');
    cy.get('#pr-plot-cont', { timeout: 10000 }).should('be.visible');
  });

}); 