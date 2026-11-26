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

  it('separates the threshold arrows and the Export control on phones', () => {
    cy.viewport(390, 844);

    for (const mode of ['binary', 'continuous']) {
      cy.get(`#${mode}-button`).click();

      cy.get(`#${mode}-container .workbench > .export-bar button`).should(($button) => {
        const button = $button[0];
        const toggle = button.ownerDocument.querySelector('.global-mode').getBoundingClientRect();
        expect(button.getBoundingClientRect().top - toggle.bottom).to.be.at.least(10);
        const settings = button.closest('.workbench').querySelector('.slider-section');
        const labelBottom = button.querySelector('span').getBoundingClientRect().bottom;
        expect(settings.getBoundingClientRect().top - labelBottom).to.be.closeTo(4, 1);
        expect(button.getBoundingClientRect().height).to.be.at.least(44);
      });

      cy.get(`#${mode}-container .main-plot-section .threshold-group:visible`).should(($group) => {
        const group = $group[0];
        const svg = group.ownerSVGElement;
        const axis = svg.querySelector('.y-axis .domain').getBoundingClientRect();
        const legend = svg.querySelector('.legend-group').getBoundingClientRect();
        expect(legend.left - axis.right).to.be.closeTo(20, 1);
        const lineX = group.querySelector('.threshold-line').getBoundingClientRect().x;
        const [left, right] = group.querySelectorAll('.threshold-arrow');
        // The 4 px line has a 5 px gap between each edge and its arrow.
        expect(lineX - left.getBoundingClientRect().right).to.be.closeTo(7, 0.5);
        expect(right.getBoundingClientRect().left - lineX).to.be.closeTo(7, 0.5);
      });
    }
  });

  it('pairs the ROC and PR plots when they fit and stacks them on a narrow phone', () => {
    for (const mode of ['binary', 'continuous']) {
      cy.viewport(390, 844);
      cy.get(`#${mode}-button`).click();
      const charts = `#${mode}-plots .roc-pr-section .index-plot-fill`;

      cy.get(charts).should(($plots) => {
        const [roc, pr] = Array.from($plots, plot => plot.getBoundingClientRect());
        expect(pr.top).to.be.closeTo(roc.top, 1);
        expect(pr.left).to.be.greaterThan(roc.right);
        for (const plot of $plots) {
          const layout = plot._fullLayout;
          expect(layout._size.w).to.be.at.least(100);
          expect(layout._size.w).to.be.closeTo(layout._size.h, 1);
          expect(layout.xaxis.title.font.size).to.be.at.least(16);
          expect(layout.yaxis.title.font.size).to.be.at.least(16);
        }
      });

      cy.viewport(320, 667);
      cy.get(charts).should(($plots) => {
        const [roc, pr] = Array.from($plots, plot => plot.getBoundingClientRect());
        expect(pr.top).to.be.at.least(roc.bottom);
        expect(pr.width).to.be.closeTo(roc.width, 1);
      });

      cy.viewport(1440, 900);
      cy.get(charts).first().should(($plot) => {
        expect($plot[0]._fullLayout.xaxis.title.text).to.equal('1 - Specificity (FPR)');
      });
    }
  });

  it('shows all effect sizes together and centers each dashboard label with its value', () => {
    cy.viewport(390, 844);
    for (const mode of ['binary', 'continuous']) {
      cy.get(`#${mode}-button`).click();
      const root = `#${mode}-container`;
      const table = `${root} .slider-section .index-metric-stack`;
      cy.get(table).should('have.length', 1);
      cy.get(`${table} > .index-metric-row:visible`).should('have.length', mode === 'binary' ? 6 : 10);
      cy.get(`${root} .dashboard-heading`).should('have.css', 'text-align', 'center');
      cy.get(`${root} .dashboard p:visible`).each(($metric) => {
        const cell = $metric[0];
        const label = cell.firstChild;
        const range = cell.ownerDocument.createRange();
        range.setStart(label, 0);
        range.setEnd(label, label.textContent.trimEnd().length);
        const value = cell.querySelector('span').getBoundingClientRect();
        const text = range.getBoundingClientRect();
        expect(value.left - text.right).to.be.within(0, 8);
        expect(value.top).to.be.closeTo(text.top, 1);
        const column = cell.getBoundingClientRect();
        expect((text.left + value.right) / 2).to.be.closeTo((column.left + column.right) / 2, 1);
      });
    }
  });

  it('lays out five visible equations in three rows on a narrow phone', () => {
    cy.viewport(320, 667);
    for (const mode of ['binary', 'continuous']) {
      cy.get(`#${mode}-button`).click();
      cy.get(`#${mode}-container .equations-container > .equation-box`).should(($cards) => {
        expect($cards).to.have.length(5);
        expect($cards.first().text()).to.include("Cohen's d");
        const [lead, second, third, fourth, fifth] = Array.from($cards, card => card.getBoundingClientRect());
        expect(second.top).to.be.greaterThan(lead.bottom);
        expect(second.top).to.equal(third.top);
        expect(fourth.top).to.be.greaterThan(second.bottom);
        expect(fourth.top).to.equal(fifth.top);
        expect(second.left).to.equal(fourth.left).and.to.equal(lead.left);
        expect(third.right).to.equal(fifth.right).and.to.equal(lead.right);
        for (const card of $cards) {
          const equation = card.querySelector('.equation-content');
          expect(equation.querySelector('mjx-container mjx-container')).to.equal(null);
          const frame = equation.getBoundingClientRect();
          const expressions = equation.querySelectorAll('mjx-math');
          expect(expressions.length).to.be.greaterThan(0);
          for (const expression of expressions) {
            const math = expression.getBoundingClientRect();
            expect(math.width).to.be.greaterThan(0);
            const title = card.querySelector('.equation-title').textContent;
            expect(math.left, title).to.be.at.least(frame.left - 0.5);
            expect(math.right, title).to.be.at.most(frame.right + 0.5);
          }
        }
      });
    }
  });

  it('places AUC values in the plots and moves the PR value above a low curve', () => {
    cy.viewport(390, 844);
    for (const mode of ['binary', 'continuous']) {
      const suffix = mode === 'binary' ? '' : '-cont';
      cy.get(`#${mode}-button`).click();
      cy.get(`#roc-plot${suffix}`).should(($p) => {
        expect($p[0]._fullLayout.annotations[0]).to.include({ x: 0.95, y: 0.05 });
      });
      cy.get(`#pr-plot${suffix}`).should(($p) => {
        expect($p[0]._fullLayout.annotations[0]).to.include({ x: 0.05, y: 0.05 });
      });
      cy.get(`#base-rate-number${suffix}`).clear().type('1').blur();
      cy.get(`#pr-plot${suffix}`).should(($p) => {
        expect($p[0]._fullLayout.annotations[0]).to.include({ x: 0.95, y: 0.95 });
      });
    }
  });

  it('opens guide sections directly on a phone', () => {
    cy.viewport(320, 667);
    cy.visit('get-started.html');
    cy.get('#toc-sidebar summary').click();
    cy.get('#toc-sidebar a[href="#sample-size"]').click();
    cy.location('hash').should('equal', '#sample-size');
  });

  it('keeps both sample-size charts inside their cards on a narrow phone', () => {
    cy.viewport(320, 667);

    function checkChart(id) {
      cy.get(id).should(($canvas) => {
        const canvas = $canvas[0];
        const plot = canvas.getBoundingClientRect();
        const bubble = canvas.closest('.plot-bubble');
        const card = bubble.getBoundingClientRect();
        const legend = bubble.querySelector('.chart-legend').getBoundingClientRect();
        expect(plot.left).to.be.at.least(card.left - 1);
        expect(plot.right).to.be.at.most(card.right + 1);
        expect(plot.top).to.be.at.least(legend.bottom - 1);
        expect(plot.bottom).to.be.at.most(card.bottom + 1);
        expect(canvas._chart.chartArea.height).to.be.greaterThan(150);
      });
    }

    checkChart('#ssbPlot');
    cy.get('#ssb-p').clear().type('31');
    cy.get('#ssb-results-table').should('contain.text', 'MAPE applies only through 30');
    checkChart('#ssbPlot');

    cy.get('#continuous-button').click();
    checkChart('#sscPlot');
    cy.viewport(844, 390);
    checkChart('#sscPlot');
    cy.get('#binary-button').click();
    checkChart('#ssbPlot');
  });

  it('loads binary multivariable controls from an example URL', () => {
    cy.visit(
      'index.html?mode=binary&baseRate=0.08&multiTargetRocAuc=0.965&multiEffectSize=0.8&multiCollinearity=0.05&multiPredictors=20'
    );

    cy.get('#mahalanobis-base-rate').should('have.value', '8');
    cy.get('#targetRocAuc').should('have.value', '0.965');
    cy.get('#effectSize').should('have.value', '0.8');
    cy.get('#correlation').should('have.value', '0.05');
    cy.get('#numVariables').should('have.value', '20');
  });

  it('loads continuous multivariable controls from an example URL', () => {
    cy.visit(
      'index.html?mode=continuous&baseRate=0.46&multiTargetR2=0.47&multiPredictorCorrelation=0.3&multiCollinearity=0.15&multiPredictors=20'
    );

    cy.get('#r2-base-rate').should('have.value', '46');
    cy.get('#target-r2').should('have.value', '0.47');
    cy.get('#predictor-correlation').should('have.value', '0.3');
    cy.get('#collinearity').should('have.value', '0.15');
    cy.get('#num-predictors-r2').should('have.value', '20');
  });
});
