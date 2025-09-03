// Import commands
import './commands';

// Global configurations
Cypress.on('uncaught:exception', (err, runnable) => {
  // Don't fail tests on unhandled exceptions
  console.log('Uncaught exception:', err.message);
  return false;
});

// Custom commands for Advanced Chart Testing
Cypress.Commands.add('waitForChartLoad', (timeout = 10000) => {
  cy.get('[data-testid="chart-container"]', { timeout }).should('be.visible');
  cy.get('.loading', { timeout: 5000 }).should('not.exist');
});

Cypress.Commands.add('selectSymbol', (symbol) => {
  cy.get('[data-testid="symbol-select"]').click();
  cy.get(`[data-value="${symbol}"]`).click();
});

Cypress.Commands.add('selectTimeframe', (timeframe) => {
  cy.get('[data-testid="timeframe-select"]').click();
  cy.get(`[data-value="${timeframe}"]`).click();
});

Cypress.Commands.add('addIndicator', (indicatorId) => {
  cy.get('[data-testid="indicators-sidebar"]').should('be.visible');
  cy.get(`[data-testid="indicator-${indicatorId}"]`).click();
});

Cypress.Commands.add('selectDrawingTool', (tool) => {
  cy.get(`[data-testid="drawing-tool-${tool}"]`).click();
});

Cypress.Commands.add('verifyChartData', () => {
  cy.get('canvas').should('be.visible');
  cy.get('canvas').should('have.length.at.least', 1);
});

Cypress.Commands.add('verifyIndicatorAdded', (indicatorName) => {
  cy.get('[data-testid="active-indicators"]')
    .should('contain', indicatorName);
});

Cypress.Commands.add('verifyDrawingToolActive', (tool) => {
  cy.get(`[data-testid="drawing-tool-${tool}"]`)
    .should('have.class', 'MuiButton-contained');
});

// Performance monitoring
Cypress.Commands.add('measurePerformance', (testName) => {
  cy.window().then((win) => {
    win.performance.mark(`${testName}-start`);
  });
});

Cypress.Commands.add('endPerformanceTest', (testName, maxTime = 5000) => {
  cy.window().then((win) => {
    win.performance.mark(`${testName}-end`);
    win.performance.measure(testName, `${testName}-start`, `${testName}-end`);
    
    const measure = win.performance.getEntriesByName(testName)[0];
    expect(measure.duration).to.be.lessThan(maxTime);
    
    cy.log(`Performance ${testName}: ${measure.duration.toFixed(2)}ms`);
  });
});