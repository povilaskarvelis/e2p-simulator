const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // Run only app specs (skip Cypress scaffold examples under 1-getting-started / 2-advanced-examples)
    specPattern: [
      "cypress/e2e/binary-tests.cy.js",
      "cypress/e2e/continuous-tests.cy.js",
    ],
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
