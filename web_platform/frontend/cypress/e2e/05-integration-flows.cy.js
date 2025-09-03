describe('🌊 Complete User Flows - Integration Tests', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should complete full trading analysis workflow', () => {
    cy.log('🎯 Complete trading analysis workflow');
    
    cy.measurePerformance('full-workflow');
    
    // Step 1: Navigate to Advanced Charts
    cy.get('[data-testid="sidebar"]')
      .contains('Advanced Charts')
      .click();
    
    cy.url().should('include', '/advanced-charts');
    cy.waitForChartLoad();
    
    // Step 2: Select a symbol
    cy.selectSymbol('TSLA');
    cy.waitForChartLoad();
    
    // Step 3: Change timeframe for analysis
    cy.selectTimeframe('1h');
    cy.waitForChartLoad();
    
    // Step 4: Switch to candlestick chart
    cy.get('[data-testid="chart-type-candlestick"]').click();
    cy.waitForChartRender();
    
    // Step 5: Add trend analysis indicators
    cy.get('[data-testid="indicators-sidebar"]').within(() => {
      cy.contains('Trend Indicators').click();
      cy.get('[data-testid="indicator-sma"]').click();
      cy.get('[data-testid="indicator-ema"]').click();
      cy.get('[data-testid="indicator-bollinger"]').click();
    });
    
    // Step 6: Add momentum indicators
    cy.get('[data-testid="indicators-sidebar"]').within(() => {
      cy.contains('Momentum Oscillators').click();
      cy.get('[data-testid="indicator-rsi"]').click();
      cy.get('[data-testid="indicator-macd"]').click();
    });
    
    // Step 7: Add volume analysis
    cy.get('[data-testid="indicators-sidebar"]').within(() => {
      cy.contains('Volume Indicators').click();
      cy.get('[data-testid="indicator-volume"]').click();
    });
    
    // Step 8: Draw trend lines for technical analysis
    cy.selectDrawingTool('trendline');
    cy.get('canvas').click(100, 300);
    cy.get('canvas').click(500, 200);
    
    // Step 9: Add Fibonacci retracement
    cy.selectDrawingTool('fibonacci');
    cy.get('canvas').click(150, 150);
    cy.get('canvas').click(450, 400);
    
    // Step 10: Add support/resistance levels
    cy.selectDrawingTool('horizontal');
    cy.get('canvas').click(200, 250);
    
    // Step 11: Save analysis
    cy.get('[data-testid="save-chart"]').click();
    
    // Step 12: Verify all components are working
    cy.get('[data-testid="active-indicators"]')
      .find('.MuiChip-root')
      .should('have.length', 6);
    
    cy.get('[data-testid="chart-container"]')
      .find('.chart-panel')
      .should('have.length.at.least', 3);
    
    cy.endPerformanceTest('full-workflow', 30000);
    cy.checkMemoryUsage('full-workflow');
  });

  it('should handle rapid symbol switching with analysis preserved', () => {
    cy.log('🔄 Rapid symbol switching test');
    
    cy.measurePerformance('rapid-switching');
    
    // Navigate to charts
    cy.visit('/advanced-charts');
    cy.waitForChartLoad();
    
    // Setup analysis on first symbol
    cy.selectSymbol('AAPL');
    cy.addIndicator('sma');
    cy.addIndicator('rsi');
    
    // Rapidly switch between symbols
    const symbols = ['GOOGL', 'MSFT', 'TSLA', 'AMZN', 'AAPL'];
    
    symbols.forEach(symbol => {
      cy.selectSymbol(symbol);
      cy.wait(1000); // Allow time for data loading
      cy.waitForChartLoad();
      
      // Verify indicators are still active
      cy.get('[data-testid="active-indicators"]')
        .find('.MuiChip-root')
        .should('have.length', 2);
    });
    
    cy.endPerformanceTest('rapid-switching', 20000);
    cy.checkMemoryUsage('rapid-switching');
  });

  it('should handle multiple timeframe analysis', () => {
    cy.log('⏰ Multiple timeframe analysis');
    
    cy.visit('/advanced-charts');
    cy.waitForChartLoad();
    
    // Select symbol
    cy.selectSymbol('NVDA');
    
    // Test different timeframes with same analysis
    const timeframes = ['1m', '15m', '1h', '4h', '1D', '1W'];
    
    // Add indicators first
    cy.addIndicator('sma');
    cy.addIndicator('rsi');
    
    timeframes.forEach(tf => {
      cy.log(`📊 Analyzing ${tf} timeframe`);
      
      cy.selectTimeframe(tf);
      cy.waitForChartLoad();
      
      // Verify chart loads and indicators work
      cy.get('[data-testid="active-indicators"]')
        .find('.MuiChip-root')
        .should('have.length', 2);
      
      cy.verifyChartData();
      cy.checkMemoryUsage(`timeframe-${tf}`);
    });
  });

  it('should test complete portfolio analysis workflow', () => {
    cy.log('💼 Portfolio analysis workflow');
    
    const portfolioSymbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA'];
    
    portfolioSymbols.forEach((symbol, index) => {
      cy.log(`📈 Analyzing ${symbol} for portfolio`);
      
      // Navigate to charts
      if (index === 0) {
        cy.visit('/advanced-charts');
        cy.waitForChartLoad();
      }
      
      // Select symbol
      cy.selectSymbol(symbol);
      cy.waitForChartLoad();
      
      // Set to daily timeframe for portfolio analysis
      cy.selectTimeframe('1D');
      cy.waitForChartLoad();
      
      // Add standard analysis indicators
      if (index === 0) { // Only add indicators for first symbol
        cy.addIndicator('sma');
        cy.addIndicator('bollinger');
        cy.addIndicator('rsi');
        cy.addIndicator('volume');
      }
      
      // Quick technical check
      cy.verifyChartData();
      
      // Save analysis
      cy.get('[data-testid="save-chart"]').click();
      
      cy.wait(1000);
      cy.checkMemoryUsage(`portfolio-analysis-${symbol}`);
    });
  });

  it('should test error recovery and resilience', () => {
    cy.log('🛡️ Error recovery test');
    
    cy.visit('/advanced-charts');
    cy.waitForChartLoad();
    
    // Test with invalid symbol (should handle gracefully)
    cy.get('[data-testid="symbol-select"]').click();
    cy.get('[data-testid="symbol-select"]').type('INVALID{enter}');
    
    // Should not crash
    cy.get('[data-testid="chart-container"]').should('be.visible');
    cy.get('body').should('not.contain', 'Error');
    
    // Recover with valid symbol
    cy.selectSymbol('AAPL');
    cy.waitForChartLoad();
    
    // Test rapid indicator addition/removal
    for (let i = 0; i < 5; i++) {
      cy.addIndicator('sma');
      cy.get('[data-testid="active-indicators"]')
        .find('[data-testid="delete"]')
        .first()
        .click();
      cy.wait(200);
    }
    
    cy.verifyChartData();
    cy.checkMemoryUsage('error-recovery');
  });

  it('should test cross-browser compatibility simulation', () => {
    cy.log('🌐 Cross-browser compatibility');
    
    // Simulate different user agent strings
    cy.visit('/advanced-charts', {
      onBeforeLoad: (win) => {
        // Simulate different browsers
        Object.defineProperty(win.navigator, 'userAgent', {
          writable: false,
          value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
      }
    });
    
    cy.waitForChartLoad();
    
    // Test core functionality works
    cy.selectSymbol('AAPL');
    cy.addIndicator('sma');
    cy.selectDrawingTool('trendline');
    
    cy.verifyChartData();
    cy.checkMemoryUsage('cross-browser');
  });

  it('should test accessibility features', () => {
    cy.log('♿ Accessibility test');
    
    cy.visit('/advanced-charts');
    cy.waitForChartLoad();
    
    // Test keyboard navigation
    cy.get('body').tab();
    cy.focused().should('be.visible');
    
    // Test with reduced motion (if implemented)
    cy.window().then((win) => {
      win.matchMedia = cy.stub().returns({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: cy.stub(),
        removeListener: cy.stub(),
        addEventListener: cy.stub(),
        removeEventListener: cy.stub(),
        dispatchEvent: cy.stub(),
      });
    });
    
    // Should still work with accessibility preferences
    cy.selectSymbol('AAPL');
    cy.verifyChartData();
    
    cy.checkMemoryUsage('accessibility');
  });

  it('should test mobile responsive behavior', () => {
    cy.log('📱 Mobile responsive test');
    
    // Test on mobile viewport
    cy.viewport(375, 667);
    cy.visit('/advanced-charts');
    
    // Should adapt layout for mobile
    cy.get('[data-testid="chart-container"]').should('be.visible');
    
    // Test basic functionality on mobile
    cy.selectSymbol('AAPL');
    cy.waitForChartLoad();
    
    // Touch interactions (if implemented)
    cy.get('canvas').trigger('touchstart', { touches: [{ clientX: 100, clientY: 100 }] });
    cy.get('canvas').trigger('touchend');
    
    cy.checkMemoryUsage('mobile-responsive');
  });

  it('should test data loading edge cases', () => {
    cy.log('📊 Data loading edge cases');
    
    cy.visit('/advanced-charts');
    cy.waitForChartLoad();
    
    // Test with very short timeframes
    cy.selectTimeframe('1m');
    cy.waitForChartLoad();
    
    // Test with very long timeframes
    cy.selectTimeframe('1M');
    cy.waitForChartLoad();
    
    // Test rapid timeframe switching
    for (let i = 0; i < 3; i++) {
      cy.selectTimeframe('1D');
      cy.selectTimeframe('1h');
      cy.wait(500);
    }
    
    cy.verifyChartData();
    cy.checkMemoryUsage('data-loading-edge-cases');
  });

  afterEach(() => {
    // Global cleanup and memory check
    cy.window().then((win) => {
      // Clear any stored data
      win.localStorage.clear();
      
      // Clean up any global state
      if (win.chartEngine && win.chartEngine.destroy) {
        win.chartEngine.destroy();
      }
    });
    
    cy.checkMemoryUsage('test-cleanup');
  });
});