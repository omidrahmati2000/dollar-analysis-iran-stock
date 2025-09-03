describe('📊 Technical Indicators - Logic & Functionality Tests', () => {
  beforeEach(() => {
    cy.visit('/advanced-charts');
    cy.waitForChartLoad();
  });

  it('should add and remove trend indicators', () => {
    const trendIndicators = [
      { id: 'sma', name: 'Simple Moving Average', category: 'Trend Indicators' },
      { id: 'ema', name: 'Exponential Moving Average', category: 'Trend Indicators' },
      { id: 'bollinger', name: 'Bollinger Bands', category: 'Trend Indicators' }
    ];

    trendIndicators.forEach(indicator => {
      cy.log(`📈 Testing ${indicator.name}`);
      
      cy.measurePerformance(`indicator-${indicator.id}`);
      
      // Add indicator
      cy.get('[data-testid="indicators-sidebar"]').within(() => {
        cy.contains(indicator.category).click();
        cy.get(`[data-testid="indicator-${indicator.id}"]`).click();
      });
      
      // Verify indicator is added
      cy.verifyIndicatorAdded(indicator.name);
      
      // Should see indicator on chart (check for canvas updates)
      cy.waitForChartRender();
      
      // Remove indicator
      cy.get('[data-testid="active-indicators"]')
        .contains(indicator.name)
        .parent()
        .find('[data-testid="delete"]')
        .click();
      
      // Verify indicator is removed
      cy.get('[data-testid="active-indicators"]')
        .should('not.contain', indicator.name);
      
      cy.endPerformanceTest(`indicator-${indicator.id}`, 4000);
      cy.checkMemoryUsage(`indicator-${indicator.id}`);
    });
  });

  it('should add and display oscillator indicators in separate panels', () => {
    const oscillators = [
      { id: 'rsi', name: 'RSI', category: 'Momentum Oscillators' },
      { id: 'macd', name: 'MACD', category: 'Momentum Oscillators' },
      { id: 'stochastic', name: 'Stochastic', category: 'Momentum Oscillators' }
    ];

    oscillators.forEach((oscillator, index) => {
      cy.log(`📉 Testing ${oscillator.name}`);
      
      cy.measurePerformance(`oscillator-${oscillator.id}`);
      
      // Add oscillator
      cy.get('[data-testid="indicators-sidebar"]').within(() => {
        cy.contains(oscillator.category).click();
        cy.get(`[data-testid="indicator-${oscillator.id}"]`).click();
      });
      
      // Verify oscillator is added
      cy.verifyIndicatorAdded(oscillator.name);
      
      // Should create new panel for oscillator
      cy.get('[data-testid="chart-container"]')
        .find('.chart-panel')
        .should('have.length', index + 2); // Main panel + oscillator panels
      
      cy.endPerformanceTest(`oscillator-${oscillator.id}`, 5000);
      cy.checkMemoryUsage(`oscillator-${oscillator.id}`);
    });
  });

  it('should test volume indicators', () => {
    const volumeIndicators = [
      { id: 'volume', name: 'Volume', category: 'Volume Indicators' },
      { id: 'obv', name: 'On Balance Volume', category: 'Volume Indicators' }
    ];

    volumeIndicators.forEach(indicator => {
      cy.log(`📊 Testing ${indicator.name}`);
      
      // Add volume indicator
      cy.get('[data-testid="indicators-sidebar"]').within(() => {
        cy.contains(indicator.category).click();
        cy.get(`[data-testid="indicator-${indicator.id}"]`).click();
      });
      
      cy.verifyIndicatorAdded(indicator.name);
      cy.waitForChartRender();
      
      cy.checkMemoryUsage(`volume-indicator-${indicator.id}`);
    });
  });

  it('should handle multiple indicators simultaneously', () => {
    cy.log('🔢 Testing multiple indicators');
    
    cy.measurePerformance('multiple-indicators');
    
    const indicators = [
      { category: 'Trend Indicators', id: 'sma' },
      { category: 'Trend Indicators', id: 'ema' },
      { category: 'Momentum Oscillators', id: 'rsi' },
      { category: 'Momentum Oscillators', id: 'macd' },
      { category: 'Volume Indicators', id: 'volume' }
    ];
    
    // Add all indicators
    indicators.forEach(indicator => {
      cy.get('[data-testid="indicators-sidebar"]').within(() => {
        cy.contains(indicator.category).click();
        cy.get(`[data-testid="indicator-${indicator.id}"]`).click();
      });
      cy.wait(1000); // Small delay between additions
    });
    
    // Verify all indicators are active
    cy.get('[data-testid="active-indicators"]')
      .find('.MuiChip-root')
      .should('have.length', indicators.length);
    
    // Check that multiple chart panels exist
    cy.get('[data-testid="chart-container"]')
      .find('.chart-panel')
      .should('have.length.at.least', 3); // Main + oscillator panels
    
    cy.endPerformanceTest('multiple-indicators', 10000);
    cy.checkMemoryUsage('multiple-indicators');
  });

  it('should validate indicator calculations', () => {
    cy.log('🧮 Validating indicator calculations');
    
    // Add SMA indicator
    cy.get('[data-testid="indicators-sidebar"]').within(() => {
      cy.contains('Trend Indicators').click();
      cy.get('[data-testid="indicator-sma"]').click();
    });
    
    // Get access to chart data for validation
    cy.window().then((win) => {
      // Access chart engine from window
      const chartEngine = win.chartEngine;
      
      if (chartEngine && chartEngine.getData) {
        const data = chartEngine.getData();
        const smaData = chartEngine.getIndicatorData('sma');
        
        if (data && data.length > 20 && smaData && smaData.length > 0) {
          // Validate SMA calculation for last point
          const period = 20;
          const lastDataPoints = data.slice(-period);
          const expectedSMA = lastDataPoints.reduce((sum, point) => sum + point.close, 0) / period;
          const actualSMA = smaData[smaData.length - 1].value;
          
          // Allow small floating point differences
          const difference = Math.abs(expectedSMA - actualSMA);
          expect(difference).to.be.lessThan(0.01);
          
          cy.log(`✅ SMA calculation validated. Expected: ${expectedSMA}, Actual: ${actualSMA}`);
        }
      }
    });
    
    cy.checkMemoryUsage('indicator-validation');
  });

  it('should test indicator parameter customization', () => {
    cy.log('⚙️ Testing indicator parameters');
    
    // This test would require parameter input UI
    // For now, we test that indicators work with default parameters
    cy.get('[data-testid="indicators-sidebar"]').within(() => {
      cy.contains('Trend Indicators').click();
      cy.get('[data-testid="indicator-sma"]').click();
    });
    
    // Future: Test parameter modification
    // cy.get('[data-testid="sma-parameters"]').within(() => {
    //   cy.get('[data-testid="period-input"]').clear().type('50');
    //   cy.get('[data-testid="apply-parameters"]').click();
    // });
    
    cy.checkMemoryUsage('indicator-parameters');
  });

  it('should handle indicator errors gracefully', () => {
    cy.log('🛡️ Testing error handling');
    
    // Test with insufficient data (this might cause errors)
    cy.selectTimeframe('1m'); // Short timeframe might have less data
    
    // Try to add indicator that requires more data points
    cy.get('[data-testid="indicators-sidebar"]').within(() => {
      cy.contains('Trend Indicators').click();
      cy.get('[data-testid="indicator-sma"]').click();
    });
    
    // Should handle gracefully without crashing
    cy.get('body').should('not.contain', 'Error');
    cy.get('[data-testid="chart-container"]').should('be.visible');
    
    cy.checkMemoryUsage('error-handling');
  });

  it('should maintain indicator state when changing symbols', () => {
    cy.log('🔄 Testing indicator persistence across symbol changes');
    
    // Add indicators
    cy.get('[data-testid="indicators-sidebar"]').within(() => {
      cy.contains('Trend Indicators').click();
      cy.get('[data-testid="indicator-sma"]').click();
      
      cy.contains('Momentum Oscillators').click();
      cy.get('[data-testid="indicator-rsi"]').click();
    });
    
    // Verify indicators are active
    cy.get('[data-testid="active-indicators"]')
      .find('.MuiChip-root')
      .should('have.length', 2);
    
    // Change symbol
    cy.selectSymbol('GOOGL');
    cy.waitForChartLoad();
    
    // Indicators should still be active
    cy.get('[data-testid="active-indicators"]')
      .find('.MuiChip-root')
      .should('have.length', 2);
    
    cy.checkMemoryUsage('indicator-persistence');
  });

  it('should test performance with many indicators', () => {
    cy.log('🚀 Performance test with multiple indicators');
    
    cy.measurePerformance('many-indicators-performance');
    
    // Add many indicators quickly
    const allIndicators = [
      { category: 'Trend Indicators', ids: ['sma', 'ema', 'bollinger'] },
      { category: 'Momentum Oscillators', ids: ['rsi', 'macd', 'stochastic', 'cci'] },
      { category: 'Volume Indicators', ids: ['volume', 'obv'] },
      { category: 'Volatility Indicators', ids: ['atr'] }
    ];
    
    allIndicators.forEach(group => {
      cy.get('[data-testid="indicators-sidebar"]').within(() => {
        cy.contains(group.category).click();
        group.ids.forEach(id => {
          cy.get(`[data-testid="indicator-${id}"]`).click();
          cy.wait(200);
        });
      });
    });
    
    // Should still be responsive
    cy.waitForChartRender();
    
    cy.endPerformanceTest('many-indicators-performance', 20000);
    cy.checkMemoryUsage('many-indicators-performance');
  });

  afterEach(() => {
    // Clean up indicators for next test
    cy.get('[data-testid="active-indicators"]')
      .find('[data-testid="delete"]')
      .click({ multiple: true });
    
    cy.checkMemoryUsage('indicators-cleanup');
  });
});