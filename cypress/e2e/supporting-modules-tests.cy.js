describe('E2P Simulator - Supporting modules', () => {
  beforeEach(() => {
    cy.visit('index.html');
  });

  it('reveals both pages after their styled, initialized state is ready', () => {
    cy.get('html').should('not.have.class', 'e2p-loading');
    cy.get('body').should('have.css', 'opacity', '1');

    cy.visit('get-started.html');
    cy.get('html').should('not.have.class', 'e2p-loading');
    cy.get('body').should('have.css', 'opacity', '1');
  });

  it('presents one binary recommendation and compares the complete criteria', () => {
    cy.get('#calibration-binary-container').should('be.visible');
    cy.get('#calibration').should('contain.text', 'Development Population');
    cy.get('#calibration').should('contain.text', 'Target Population');
    cy.get('#calibration').should('not.contain.text', 'Test Set');

    cy.get('#ssb-results-table').within(() => {
      cy.contains('Required Sample Size');
      cy.contains('N = 461');
      cy.contains('Outcome proportion precision');
      cy.contains('MAPE');
      cy.contains('Shrinkage');
      cy.contains('R² optimism');
      cy.contains('EPV rule (10 events per predictor parameter): N = 334');
      cy.contains('At the recommended sample size').should('not.exist');
    });
    cy.get('#ss-binary-container details').should('not.exist');
    cy.get('#ss-binary-container').should(
      'contain.text',
      'Predictor parameters (p)'
    );
    cy.get('#ssbPlot').then(($canvas) => {
      const datasets = $canvas[0]._chart.data.datasets;
      expect(datasets).to.have.length(5);
      expect(datasets.map((dataset) => dataset.label)).to.deep.equal([
        'EPV rule of thumb (10)',
        'Overall outcome proportion precision',
        'Shrinkage',
        'Average prediction error (MAPE; p ≤ 30)',
        'Nagelkerke R² optimism',
      ]);
      datasets.forEach((dataset) => expect(dataset.pointRadius).to.equal(5));
      expect(datasets[0].borderDash).to.be.undefined;
      expect(datasets[0].borderColor).to.equal('#888888');
      expect(datasets.slice(1).map((dataset) => dataset.borderColor))
        .not.to.include('#888888');
    });
    cy.get('#ssb-epv').should('have.value', '10');
    cy.get('#ss-binary-container').should(
      'contain.text',
      'Margin of error (m)'
    );

    cy.get('#ssb-p').clear().type('31');
    cy.get('#ssbPlot').then(($canvas) => {
      const chart = $canvas[0]._chart;
      const mape = chart.data.datasets.find((dataset) =>
        dataset.label.startsWith('Average prediction error')
      );
      expect(chart.data.labels[29]).to.equal(30);
      expect(mape.data[29]).to.be.a('number');
      expect(mape.data[30]).to.equal(null);
    });
    cy.get('#ssb-results-table').should(
      'contain.text',
      'The change after 30 reflects that limit'
    );
  });

  it('shows the three continuous criteria without additional outcome inputs', () => {
    cy.get('#continuous-button').click();

    cy.get('#calibration').should('not.be.visible');
    cy.get('#ss-binary-container').should('not.be.visible');
    cy.get('#ss-cont-container').should('be.visible');
    cy.get('#ss-cont-container details').should('not.exist');

    cy.get('#ssc-results-table').within(() => {
      cy.contains('Required Sample Size');
      cy.contains('N = 244');
      cy.contains('Residual SD precision');
      cy.contains('Shrinkage');
      cy.contains('R² optimism');
    });
    cy.get('#ssc-mean-outcome').should('not.exist');
    cy.get('#ssc-outcome-sd').should('not.exist');
    cy.get('#ssc-mmoe').should('not.exist');
    cy.get('#ss-cont-container').should(
      'contain.text',
      'Predictor parameters (p)'
    );
    cy.get('#ss-cont-container').should(
      'contain.text',
      'The calculator increases N until this condition is met'
    );
    cy.get('#ss-cont-container .equation-content').each(($equation) => {
      expect($equation[0].scrollWidth).to.be.at.most(
        $equation[0].clientWidth + 1
      );
    });
    cy.get('#sscPlot').then(($canvas) => {
      const datasets = $canvas[0]._chart.data.datasets;
      expect(datasets).to.have.length(3);
      expect(datasets.map((dataset) => dataset.label)).to.deep.equal([
        'Residual SD precision',
        'Shrinkage (S)',
        'Optimism (δ)',
      ]);
      datasets.forEach((dataset) => expect(dataset.pointRadius).to.equal(5));
    });

    cy.get('#binary-button').click();
    cy.get('#calibration').should('be.visible');
  });
});
