// Custom commands for testing

// Authentication commands (if needed)
Cypress.Commands.add('login', (username = 'test', password = 'test') => {
  // Add login logic here if authentication is implemented
  cy.log('Login command - currently not implemented');
});

// Chart specific commands
Cypress.Commands.add('waitForChartRender', () => {
  cy.get('canvas').should('exist');
  cy.wait(1000); // Wait for chart to fully render
});

Cypress.Commands.add('checkChartPerformance', () => {
  cy.window().its('performance').then((performance) => {
    const navigationTiming = performance.getEntriesByType('navigation')[0];
    const loadTime = navigationTiming.loadEventEnd - navigationTiming.navigationStart;
    
    // Chart should load within 5 seconds
    expect(loadTime).to.be.lessThan(5000);
    
    cy.log(`Page load time: ${loadTime}ms`);
  });
});

// API testing commands
Cypress.Commands.add('checkApiHealth', () => {
  cy.request({
    url: `${Cypress.env('apiUrl')}/health`,
    failOnStatusCode: false
  }).then((response) => {
    if (response.status !== 200) {
      cy.log('API not available, using mock data');
    }
  });
});

// UI interaction helpers
Cypress.Commands.add('clickAndWait', (selector, waitTime = 1000) => {
  cy.get(selector).click();
  cy.wait(waitTime);
});

// Memory leak detection
Cypress.Commands.add('checkMemoryUsage', (testName) => {
  cy.window().then((win) => {
    if (win.performance.memory) {
      const memoryInfo = win.performance.memory;
      const usedMB = (memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2);
      
      cy.log(`Memory usage in ${testName}: ${usedMB}MB`);
      
      // Alert if memory usage is too high (over 100MB)
      if (parseFloat(usedMB) > 100) {
        cy.log(`⚠️ High memory usage detected: ${usedMB}MB`);
      }
    }
  });
});