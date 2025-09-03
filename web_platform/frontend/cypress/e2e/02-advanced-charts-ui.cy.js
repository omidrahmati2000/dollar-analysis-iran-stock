describe('📈 Advanced Charts - UI/UX Tests', () => {
  beforeEach(() => {
    cy.visit('/advanced-charts');
    cy.measurePerformance('chart-page-load');
  });

  it('should load Advanced Charts page with all UI elements', () => {
    // Check main toolbar
    cy.get('[data-testid="symbol-select"]', { timeout: 10000 })
      .should('be.visible');
    
    cy.get('[data-testid="timeframe-select"]')
      .should('be.visible');
    
    // Check chart types buttons
    const chartTypes = ['candlestick', 'ohlc', 'line', 'area', 'heikinashi'];
    chartTypes.forEach(type => {
      cy.get(`[data-testid="chart-type-${type}"]`)
        .should('be.visible');
    });
    
    // Check chart container
    cy.get('[data-testid="chart-container"]')
      .should('be.visible')
      .should('have.css', 'height');
    
    // Check sidebar
    cy.get('[data-testid="indicators-sidebar"]')
      .should('be.visible');
    
    cy.endPerformanceTest('chart-page-load', 8000);
  });

  it('should switch between different chart types', () => {
    cy.waitForChartLoad();
    
    const chartTypes = [
      { id: 'candlestick', name: 'Candlestick' },
      { id: 'line', name: 'Line' },
      { id: 'area', name: 'Area' },
      { id: 'ohlc', name: 'OHLC Bars' }
    ];

    chartTypes.forEach(type => {
      cy.log(`📊 Testing chart type: ${type.name}`);
      
      cy.measurePerformance(`chart-type-${type.id}`);
      
      cy.get(`[data-testid="chart-type-${type.id}"]`)
        .click();
      
      cy.get(`[data-testid="chart-type-${type.id}"]`)
        .should('have.class', 'MuiIconButton-colorPrimary');
      
      cy.waitForChartRender();
      cy.endPerformanceTest(`chart-type-${type.id}`, 3000);
      cy.checkMemoryUsage(`chart-type-${type.id}`);
    });
  });

  it('should change symbols and load new data', () => {
    cy.waitForChartLoad();
    
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA'];
    
    symbols.forEach(symbol => {
      cy.log(`🔄 Testing symbol change to: ${symbol}`);
      
      cy.measurePerformance(`symbol-${symbol}`);
      
      cy.selectSymbol(symbol);
      
      // Wait for data to load
      cy.get('[data-testid="loading"]', { timeout: 2000 })
        .should('not.exist');
      
      cy.waitForChartRender();
      
      // Verify symbol is selected
      cy.get('[data-testid="symbol-select"]')
        .should('contain', symbol);
      
      cy.endPerformanceTest(`symbol-${symbol}`, 5000);
      cy.checkMemoryUsage(`symbol-${symbol}`);
    });
  });

  it('should change timeframes and adjust data range', () => {
    cy.waitForChartLoad();
    
    const timeframes = [
      { value: '1m', label: '1 Minute' },
      { value: '1h', label: '1 Hour' },
      { value: '1D', label: '1 Day' },
      { value: '1W', label: '1 Week' }
    ];

    timeframes.forEach(tf => {
      cy.log(`⏰ Testing timeframe: ${tf.label}`);
      
      cy.measurePerformance(`timeframe-${tf.value}`);
      
      cy.selectTimeframe(tf.value);
      
      // Wait for chart to reload with new timeframe
      cy.get('[data-testid="loading"]', { timeout: 10000 })
        .should('not.exist');
      
      cy.waitForChartRender();
      
      // Verify timeframe is selected
      cy.get('[data-testid="timeframe-select"]')
        .should('contain', tf.label);
      
      cy.endPerformanceTest(`timeframe-${tf.value}`, 6000);
      cy.checkMemoryUsage(`timeframe-${tf.value}`);
    });
  });

  it('should test drawing tools functionality', () => {
    cy.waitForChartLoad();
    
    const drawingTools = [
      { id: 'trendline', name: 'Trend Line' },
      { id: 'horizontal', name: 'Horizontal Line' },
      { id: 'rectangle', name: 'Rectangle' },
      { id: 'fibonacci', name: 'Fibonacci' },
      { id: 'text', name: 'Text' }
    ];

    drawingTools.forEach(tool => {
      cy.log(`✏️ Testing drawing tool: ${tool.name}`);
      
      cy.selectDrawingTool(tool.id);
      cy.verifyDrawingToolActive(tool.id);
      
      // Test tool deactivation
      cy.selectDrawingTool('none');
      cy.verifyDrawingToolActive('none');
      
      cy.checkMemoryUsage(`drawing-tool-${tool.id}`);
    });
  });

  it('should test zoom and pan functionality', () => {
    cy.waitForChartLoad();
    
    // Test zoom in
    cy.get('[data-testid="zoom-in"]').click();
    cy.waitForChartRender();
    
    // Test zoom out
    cy.get('[data-testid="zoom-out"]').click();
    cy.waitForChartRender();
    
    // Test chart interactions
    cy.get('canvas')
      .trigger('wheel', { deltaY: -100 }); // Zoom with mouse wheel
    
    cy.checkMemoryUsage('zoom-pan-test');
  });

  it('should test chart save and export functionality', () => {
    cy.waitForChartLoad();
    
    // Test save chart
    cy.get('[data-testid="save-chart"]').click();
    
    // Should save to localStorage (we can check this via window)
    cy.window().then((win) => {
      const savedChart = win.localStorage.getItem('chart_AAPL_1D');
      expect(savedChart).to.exist;
    });
    
    // Test export chart
    cy.get('[data-testid="export-chart"]').click();
    
    cy.checkMemoryUsage('save-export-test');
  });

  it('should handle loading states gracefully', () => {
    // Intercept API calls to simulate slow loading
    cy.intercept('GET', '**/api/**', {
      delay: 2000,
      fixture: 'chart-data.json'
    }).as('slowApi');
    
    cy.selectSymbol('GOOGL');
    
    // Should show loading indicator
    cy.get('[data-testid="loading"]')
      .should('be.visible');
    
    cy.wait('@slowApi');
    
    // Loading should disappear
    cy.get('[data-testid="loading"]')
      .should('not.exist');
    
    cy.checkMemoryUsage('loading-states-test');
  });

  it('should maintain performance under stress', () => {
    cy.log('🚀 Performance stress test');
    
    cy.measurePerformance('stress-test');
    
    // Rapidly change symbols and timeframes
    for (let i = 0; i < 5; i++) {
      cy.selectSymbol(['AAPL', 'GOOGL', 'MSFT'][i % 3]);
      cy.selectTimeframe(['1m', '1h', '1D'][i % 3]);
      cy.wait(1000);
    }
    
    cy.waitForChartLoad();
    cy.endPerformanceTest('stress-test', 15000);
    cy.checkMemoryUsage('stress-test');
  });

  afterEach(() => {
    // Clean up and check for memory leaks
    cy.checkMemoryUsage('test-cleanup');
  });
});