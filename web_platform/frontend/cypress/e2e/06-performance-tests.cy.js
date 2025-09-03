describe('🚀 Performance & Load Tests', () => {
  beforeEach(() => {
    cy.visit('/advanced-charts');
  });

  it('should load chart within performance thresholds', () => {
    cy.log('⏱️ Chart loading performance test');
    
    cy.measurePerformance('initial-load');
    
    // Measure time to interactive
    cy.waitForChartLoad();
    cy.get('[data-testid="symbol-select"]').should('be.visible');
    cy.get('[data-testid="timeframe-select"]').should('be.visible');
    
    cy.endPerformanceTest('initial-load', 5000);
    
    // Check Core Web Vitals
    cy.window().then((win) => {
      // First Contentful Paint
      const navigation = win.performance.getEntriesByType('navigation')[0];
      if (navigation) {
        const fcp = navigation.responseEnd - navigation.navigationStart;
        expect(fcp).to.be.lessThan(2000);
        cy.log(`First Contentful Paint: ${fcp}ms`);
      }
      
      // Check memory usage
      if (win.performance.memory) {
        const memory = win.performance.memory;
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        expect(usedMB).to.be.lessThan(50); // Should use less than 50MB initially
        cy.log(`Initial memory usage: ${usedMB.toFixed(2)}MB`);
      }
    });
  });

  it('should handle large datasets efficiently', () => {
    cy.log('📊 Large dataset performance');
    
    cy.measurePerformance('large-dataset');
    
    // Select 1-minute timeframe (generates more data points)
    cy.selectTimeframe('1m');
    cy.waitForChartLoad();
    
    // Add multiple indicators
    cy.addIndicator('sma');
    cy.addIndicator('ema');
    cy.addIndicator('bollinger');
    cy.addIndicator('rsi');
    cy.addIndicator('macd');
    
    // Chart should still be responsive
    cy.selectSymbol('GOOGL');
    cy.waitForChartLoad();
    
    cy.endPerformanceTest('large-dataset', 10000);
    
    // Memory should not exceed reasonable limits
    cy.window().then((win) => {
      if (win.performance.memory) {
        const memory = win.performance.memory;
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        expect(usedMB).to.be.lessThan(100); // Should use less than 100MB
        cy.log(`Memory with large dataset: ${usedMB.toFixed(2)}MB`);
      }
    });
  });

  it('should maintain 60fps during chart interactions', () => {
    cy.log('🎯 Frame rate performance test');
    
    cy.waitForChartLoad();
    
    let frameCount = 0;
    let startTime = 0;
    
    cy.window().then((win) => {
      startTime = win.performance.now();
      
      const countFrames = () => {
        frameCount++;
        if (win.performance.now() - startTime < 1000) {
          win.requestAnimationFrame(countFrames);
        }
      };
      
      win.requestAnimationFrame(countFrames);
      
      // Interact with chart while measuring frames
      cy.get('canvas').trigger('wheel', { deltaY: -100 });
      cy.wait(500);
      cy.get('canvas').trigger('mousemove', { clientX: 100, clientY: 100 });
      cy.wait(500);
      
      cy.then(() => {
        const fps = frameCount;
        expect(fps).to.be.at.least(30); // Should maintain at least 30fps
        cy.log(`Frame rate during interactions: ${fps}fps`);
      });
    });
  });

  it('should handle rapid user interactions without lag', () => {
    cy.log('⚡ Rapid interaction test');
    
    cy.measurePerformance('rapid-interactions');
    
    cy.waitForChartLoad();
    
    // Rapid symbol switching
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
    symbols.forEach(symbol => {
      cy.selectSymbol(symbol);
      cy.wait(200); // Very fast switching
    });
    
    // Rapid timeframe switching
    const timeframes = ['1m', '15m', '1h', '1D'];
    timeframes.forEach(tf => {
      cy.selectTimeframe(tf);
      cy.wait(300);
    });
    
    // Rapid indicator adding/removing
    for (let i = 0; i < 5; i++) {
      cy.addIndicator('sma');
      cy.wait(100);
      cy.get('[data-testid="active-indicators"]')
        .find('[data-testid="delete"]')
        .first()
        .click();
      cy.wait(100);
    }
    
    cy.endPerformanceTest('rapid-interactions', 8000);
    cy.checkMemoryUsage('rapid-interactions');
  });

  it('should handle concurrent data requests efficiently', () => {
    cy.log('🔄 Concurrent requests test');
    
    cy.measurePerformance('concurrent-requests');
    
    cy.waitForChartLoad();
    
    // Trigger multiple data requests simultaneously
    cy.window().then((win) => {
      const promises = [];
      const symbols = ['AAPL', 'GOOGL', 'MSFT'];
      
      // Simulate concurrent requests
      symbols.forEach(symbol => {
        if (win.dataService && win.dataService.getHistoricalData) {
          promises.push(
            win.dataService.getHistoricalData(symbol, '1D', null, null)
          );
        }
      });
      
      // All requests should complete without errors
      cy.wrap(Promise.allSettled(promises)).then((results) => {
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        expect(successCount).to.be.at.least(1);
        cy.log(`${successCount} concurrent requests succeeded`);
      });
    });
    
    cy.endPerformanceTest('concurrent-requests', 15000);
  });

  it('should efficiently manage memory with prolonged usage', () => {
    cy.log('🧠 Memory management test');
    
    let initialMemory = 0;
    
    cy.window().then((win) => {
      if (win.performance.memory) {
        initialMemory = win.performance.memory.usedJSHeapSize;
      }
    });
    
    cy.waitForChartLoad();
    
    // Simulate prolonged usage
    for (let i = 0; i < 10; i++) {
      // Change symbol and add indicators
      cy.selectSymbol(['AAPL', 'GOOGL', 'MSFT'][i % 3]);
      cy.addIndicator('sma');
      cy.wait(200);
      
      // Remove indicators to test cleanup
      cy.get('[data-testid="active-indicators"]')
        .find('[data-testid="delete"]')
        .click({ multiple: true });
      cy.wait(200);
      
      // Check memory every few iterations
      if (i % 3 === 0) {
        cy.window().then((win) => {
          if (win.performance.memory) {
            const currentMemory = win.performance.memory.usedJSHeapSize;
            const memoryGrowth = (currentMemory - initialMemory) / 1024 / 1024;
            
            cy.log(`Memory growth after ${i + 1} iterations: ${memoryGrowth.toFixed(2)}MB`);
            
            // Memory growth should be reasonable
            expect(memoryGrowth).to.be.lessThan(50); // Less than 50MB growth
          }
        });
      }
    }
    
    // Force garbage collection if available
    cy.window().then((win) => {
      if (win.gc) {
        win.gc();
      }
    });
    
    cy.checkMemoryUsage('prolonged-usage');
  });

  it('should handle chart rendering performance with many indicators', () => {
    cy.log('📈 Complex chart rendering test');
    
    cy.measurePerformance('complex-chart');
    
    cy.waitForChartLoad();
    
    // Add many indicators
    const indicators = [
      'sma', 'ema', 'bollinger', 'rsi', 'macd', 
      'stochastic', 'volume', 'atr', 'cci'
    ];
    
    indicators.forEach(indicator => {
      cy.addIndicator(indicator);
      cy.wait(300);
    });
    
    // Test chart interactions with complex setup
    cy.get('canvas').trigger('wheel', { deltaY: -100 });
    cy.get('canvas').trigger('mousemove', { clientX: 200, clientY: 200 });
    
    // Chart should still be responsive
    cy.selectSymbol('TSLA');
    cy.waitForChartLoad();
    
    cy.endPerformanceTest('complex-chart', 20000);
    cy.checkMemoryUsage('complex-chart');
  });

  it('should test network performance simulation', () => {
    cy.log('🌐 Network performance test');
    
    // Simulate slow network
    cy.intercept('GET', '**/api/**', {
      delay: 1000,
      fixture: 'chart-data.json'
    }).as('slowNetwork');
    
    cy.measurePerformance('slow-network');
    
    cy.selectSymbol('NVDA');
    
    // Should show loading state
    cy.get('[data-testid="loading"]').should('be.visible');
    
    cy.wait('@slowNetwork');
    
    // Should complete loading
    cy.get('[data-testid="loading"]').should('not.exist');
    cy.waitForChartLoad();
    
    cy.endPerformanceTest('slow-network', 5000);
  });

  it('should benchmark against performance targets', () => {
    cy.log('🎯 Performance benchmarks');
    
    const benchmarks = {
      'initial-load': 3000,
      'symbol-switch': 2000,
      'indicator-add': 1000,
      'chart-interaction': 100
    };
    
    Object.entries(benchmarks).forEach(([test, threshold]) => {
      cy.measurePerformance(test);
      
      switch (test) {
        case 'initial-load':
          cy.waitForChartLoad();
          break;
        case 'symbol-switch':
          cy.selectSymbol('GOOGL');
          cy.waitForChartLoad();
          break;
        case 'indicator-add':
          cy.addIndicator('sma');
          break;
        case 'chart-interaction':
          cy.get('canvas').trigger('mousemove', { clientX: 150, clientY: 150 });
          break;
      }
      
      cy.endPerformanceTest(test, threshold);
    });
  });

  afterEach(() => {
    // Performance test cleanup
    cy.window().then((win) => {
      // Clear performance marks
      if (win.performance.clearMarks) {
        win.performance.clearMarks();
      }
      if (win.performance.clearMeasures) {
        win.performance.clearMeasures();
      }
    });
    
    cy.checkMemoryUsage('performance-test-cleanup');
  });
});