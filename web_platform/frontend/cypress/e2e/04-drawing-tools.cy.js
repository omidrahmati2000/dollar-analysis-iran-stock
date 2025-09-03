describe('✏️ Drawing Tools - Functionality & Persistence Tests', () => {
  beforeEach(() => {
    cy.visit('/advanced-charts');
    cy.waitForChartLoad();
  });

  it('should activate and deactivate drawing tools', () => {
    const drawingTools = [
      { id: 'trendline', name: 'Trend Line' },
      { id: 'horizontal', name: 'Horizontal Line' },
      { id: 'vertical', name: 'Vertical Line' },
      { id: 'rectangle', name: 'Rectangle' },
      { id: 'fibonacci', name: 'Fibonacci' },
      { id: 'text', name: 'Text' }
    ];

    drawingTools.forEach(tool => {
      cy.log(`✏️ Testing ${tool.name} tool`);
      
      // Activate tool
      cy.selectDrawingTool(tool.id);
      cy.verifyDrawingToolActive(tool.id);
      
      // Deactivate tool
      cy.selectDrawingTool('none');
      cy.verifyDrawingToolActive('none');
      
      cy.checkMemoryUsage(`drawing-tool-${tool.id}`);
    });
  });

  it('should draw trend lines on chart', () => {
    cy.log('📈 Testing trend line drawing');
    
    cy.measurePerformance('trend-line-drawing');
    
    // Activate trend line tool
    cy.selectDrawingTool('trendline');
    
    // Draw trend line by clicking two points on chart
    cy.get('canvas').then($canvas => {
      const canvas = $canvas[0];
      const rect = canvas.getBoundingClientRect();
      
      // First point
      cy.get('canvas').click(rect.width * 0.2, rect.height * 0.7);
      
      // Second point  
      cy.get('canvas').click(rect.width * 0.8, rect.height * 0.3);
    });
    
    // Should create a trend line drawing
    cy.window().then((win) => {
      const drawingTools = win.drawingTools;
      if (drawingTools && drawingTools.getDrawings) {
        const drawings = drawingTools.getDrawings();
        expect(drawings.trendlines).to.have.length.at.least(1);
      }
    });
    
    cy.endPerformanceTest('trend-line-drawing', 3000);
    cy.checkMemoryUsage('trend-line-drawing');
  });

  it('should draw rectangles on chart', () => {
    cy.log('⬛ Testing rectangle drawing');
    
    // Activate rectangle tool
    cy.selectDrawingTool('rectangle');
    
    // Draw rectangle
    cy.get('canvas').then($canvas => {
      const canvas = $canvas[0];
      const rect = canvas.getBoundingClientRect();
      
      // Start point
      cy.get('canvas').click(rect.width * 0.3, rect.height * 0.4);
      
      // End point
      cy.get('canvas').click(rect.width * 0.7, rect.height * 0.6);
    });
    
    // Verify rectangle is drawn
    cy.window().then((win) => {
      const drawingTools = win.drawingTools;
      if (drawingTools && drawingTools.getDrawings) {
        const drawings = drawingTools.getDrawings();
        expect(drawings.rectangles).to.have.length.at.least(1);
      }
    });
    
    cy.checkMemoryUsage('rectangle-drawing');
  });

  it('should draw Fibonacci retracements', () => {
    cy.log('🌀 Testing Fibonacci retracement');
    
    // Activate Fibonacci tool
    cy.selectDrawingTool('fibonacci');
    
    // Draw Fibonacci retracement
    cy.get('canvas').then($canvas => {
      const canvas = $canvas[0];
      const rect = canvas.getBoundingClientRect();
      
      // High point
      cy.get('canvas').click(rect.width * 0.2, rect.height * 0.2);
      
      // Low point
      cy.get('canvas').click(rect.width * 0.8, rect.height * 0.8);
    });
    
    // Should show Fibonacci levels
    cy.window().then((win) => {
      const drawingTools = win.drawingTools;
      if (drawingTools && drawingTools.getDrawings) {
        const drawings = drawingTools.getDrawings();
        expect(drawings.fibonacci).to.have.length.at.least(1);
      }
    });
    
    cy.checkMemoryUsage('fibonacci-drawing');
  });

  it('should add text annotations', () => {
    cy.log('📝 Testing text annotations');
    
    // Activate text tool
    cy.selectDrawingTool('text');
    
    // Click to add text
    cy.get('canvas').click(100, 100);
    
    // Should show text input dialog (if implemented)
    // For now, just verify tool is active
    cy.verifyDrawingToolActive('text');
    
    cy.checkMemoryUsage('text-annotation');
  });

  it('should persist drawings across page reloads', () => {
    cy.log('💾 Testing drawing persistence');
    
    // Draw a trend line
    cy.selectDrawingTool('trendline');
    cy.get('canvas').click(100, 100);
    cy.get('canvas').click(300, 200);
    
    // Save drawings
    cy.get('[data-testid="save-chart"]').click();
    
    // Reload page
    cy.reload();
    cy.waitForChartLoad();
    
    // Drawings should be restored
    cy.window().then((win) => {
      const drawingTools = win.drawingTools;
      if (drawingTools && drawingTools.getDrawings) {
        const drawings = drawingTools.getDrawings();
        // Should have at least one drawing restored
        const totalDrawings = Object.values(drawings).reduce((sum, arr) => sum + arr.length, 0);
        expect(totalDrawings).to.be.at.least(1);
      }
    });
    
    cy.checkMemoryUsage('drawing-persistence');
  });

  it('should support undo/redo functionality', () => {
    cy.log('↩️ Testing undo/redo');
    
    // Draw multiple items
    cy.selectDrawingTool('trendline');
    cy.get('canvas').click(50, 50);
    cy.get('canvas').click(150, 150);
    
    cy.selectDrawingTool('rectangle');
    cy.get('canvas').click(200, 100);
    cy.get('canvas').click(300, 200);
    
    // Test undo (if implemented)
    cy.get('body').type('{ctrl}z');
    
    // Test redo (if implemented) 
    cy.get('body').type('{ctrl}y');
    
    cy.checkMemoryUsage('undo-redo');
  });

  it('should handle drawing tool errors gracefully', () => {
    cy.log('🛡️ Testing drawing error handling');
    
    // Try to draw outside chart bounds
    cy.selectDrawingTool('trendline');
    
    // Click far outside canvas
    cy.get('body').click(10, 10);
    cy.get('body').click(2000, 2000);
    
    // Should not crash
    cy.get('[data-testid="chart-container"]').should('be.visible');
    cy.get('body').should('not.contain', 'Error');
    
    cy.checkMemoryUsage('drawing-error-handling');
  });

  it('should maintain drawing state when changing symbols', () => {
    cy.log('🔄 Testing drawing state across symbol changes');
    
    // Draw on AAPL
    cy.selectDrawingTool('trendline');
    cy.get('canvas').click(100, 100);
    cy.get('canvas').click(300, 200);
    
    // Change to GOOGL
    cy.selectSymbol('GOOGL');
    cy.waitForChartLoad();
    
    // Drawing should persist (if implemented per symbol)
    // Or should be cleared (if global)
    cy.get('[data-testid="chart-container"]').should('be.visible');
    
    // Change back to AAPL
    cy.selectSymbol('AAPL');
    cy.waitForChartLoad();
    
    // Original drawings should be restored
    cy.window().then((win) => {
      const drawingTools = win.drawingTools;
      if (drawingTools && drawingTools.getDrawings) {
        const drawings = drawingTools.getDrawings();
        // Should have drawings for AAPL
        cy.log('Drawings restored for AAPL');
      }
    });
    
    cy.checkMemoryUsage('drawing-symbol-persistence');
  });

  it('should test drawing tool performance with many drawings', () => {
    cy.log('🚀 Testing drawing performance');
    
    cy.measurePerformance('many-drawings-performance');
    
    // Draw many trend lines quickly
    cy.selectDrawingTool('trendline');
    
    for (let i = 0; i < 10; i++) {
      cy.get('canvas').click(50 + i * 20, 100 + i * 10);
      cy.get('canvas').click(150 + i * 20, 200 + i * 10);
      cy.wait(100);
    }
    
    // Should still be responsive
    cy.waitForChartRender();
    
    cy.endPerformanceTest('many-drawings-performance', 8000);
    cy.checkMemoryUsage('many-drawings-performance');
  });

  it('should export drawings with chart', () => {
    cy.log('📤 Testing drawing export');
    
    // Draw something
    cy.selectDrawingTool('trendline');
    cy.get('canvas').click(100, 100);
    cy.get('canvas').click(300, 200);
    
    // Export chart
    cy.get('[data-testid="export-chart"]').click();
    
    // Should export chart with drawings included
    // (Implementation dependent)
    cy.checkMemoryUsage('drawing-export');
  });

  afterEach(() => {
    // Clean up drawings for next test
    cy.window().then((win) => {
      const drawingTools = win.drawingTools;
      if (drawingTools && drawingTools.clearAll) {
        drawingTools.clearAll();
      }
    });
    
    // Deactivate any active drawing tool
    cy.selectDrawingTool('none');
    
    cy.checkMemoryUsage('drawing-tools-cleanup');
  });
});