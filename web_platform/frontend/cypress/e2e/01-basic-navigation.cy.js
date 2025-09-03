describe('🧭 Basic Navigation & Routing Tests', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should load the main application', () => {
    cy.measurePerformance('app-load');
    
    cy.get('[data-testid="header"]', { timeout: 10000 })
      .should('be.visible');
    
    cy.get('[data-testid="sidebar"]')
      .should('be.visible');
    
    cy.endPerformanceTest('app-load', 5000);
    cy.checkMemoryUsage('app-load');
  });

  it('should navigate to different pages via sidebar', () => {
    const pages = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Charts', path: '/charts' },
      { name: 'Advanced Charts', path: '/advanced-charts' },
      { name: 'Currencies', path: '/currencies' },
      { name: 'Screener', path: '/screener' },
      { name: 'Industry Analysis', path: '/industry-analysis' },
      { name: 'Portfolio', path: '/portfolio' },
      { name: 'Watchlist', path: '/watchlist' }
    ];

    pages.forEach(page => {
      cy.log(`🔗 Testing navigation to ${page.name}`);
      
      cy.get('[data-testid="sidebar"]')
        .contains(page.name)
        .click();
      
      cy.url().should('include', page.path);
      
      // Check if page loads without errors
      cy.get('body').should('not.contain', 'Error');
      cy.get('body').should('not.contain', '404');
      
      // Performance check for each page
      cy.checkChartPerformance();
      cy.checkMemoryUsage(`${page.name}-navigation`);
    });
  });

  it('should handle direct URL navigation', () => {
    cy.visit('/advanced-charts');
    cy.url().should('include', '/advanced-charts');
    
    // Should show advanced charts page
    cy.get('h1', { timeout: 10000 })
      .should('be.visible');
    
    cy.checkMemoryUsage('direct-navigation');
  });

  it('should handle invalid routes gracefully', () => {
    cy.visit('/invalid-route', { failOnStatusCode: false });
    
    // Should redirect or show 404 gracefully
    cy.get('body').should('be.visible');
    cy.checkMemoryUsage('invalid-route');
  });

  it('should maintain responsive design on different viewports', () => {
    const viewports = [
      [1920, 1080], // Desktop
      [1366, 768],  // Laptop
      [768, 1024],  // Tablet
      [375, 667]    // Mobile
    ];

    viewports.forEach(([width, height]) => {
      cy.viewport(width, height);
      cy.log(`📱 Testing viewport: ${width}x${height}`);
      
      cy.get('[data-testid="header"]')
        .should('be.visible');
      
      if (width >= 768) {
        cy.get('[data-testid="sidebar"]')
          .should('be.visible');
      }
      
      cy.checkMemoryUsage(`viewport-${width}x${height}`);
    });
  });
});