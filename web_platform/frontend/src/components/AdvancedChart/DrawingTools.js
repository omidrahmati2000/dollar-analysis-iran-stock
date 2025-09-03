class DrawingTools {
    constructor(chartEngine) {
        this.chartEngine = chartEngine;
        this.tools = new Map();
        this.activeTool = null;
        this.isDrawing = false;
        this.currentDrawing = null;
        this.drawingHistory = [];
        this.historyIndex = -1;
        this.snapToPrice = true;
        this.snapToTime = true;
        
        this.colors = {
            trendline: '#2196F3',
            horizontal: '#FF9800',
            vertical: '#4CAF50',
            rectangle: '#9C27B0',
            fibonacci: '#F44336',
            text: '#607D8B'
        };
        
        this.setupEventListeners();
        this.loadFromStorage();
    }

    setupEventListeners() {
        // Mouse events for drawing
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    setActiveTool(toolType) {
        this.activeTool = toolType;
        this.updateCursor();
    }

    updateCursor() {
        const container = this.chartEngine.container;
        if (!container) return;

        switch (this.activeTool) {
            case 'trendline':
            case 'horizontal':
            case 'vertical':
                container.style.cursor = 'crosshair';
                break;
            case 'rectangle':
                container.style.cursor = 'nw-resize';
                break;
            case 'fibonacci':
                container.style.cursor = 'crosshair';
                break;
            case 'text':
                container.style.cursor = 'text';
                break;
            default:
                container.style.cursor = 'default';
        }
    }

    handleMouseDown(event) {
        if (!this.activeTool) return;
        
        const rect = this.chartEngine.container.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) {
            return;
        }

        this.isDrawing = true;
        const point = this.getChartPoint(event);
        
        switch (this.activeTool) {
            case 'trendline':
                this.startTrendLine(point);
                break;
            case 'horizontal':
                this.drawHorizontalLine(point);
                break;
            case 'vertical':
                this.drawVerticalLine(point);
                break;
            case 'rectangle':
                this.startRectangle(point);
                break;
            case 'fibonacci':
                this.startFibonacci(point);
                break;
            case 'text':
                this.addText(point);
                break;
        }
    }

    handleMouseMove(event) {
        if (!this.isDrawing || !this.currentDrawing) return;
        
        const point = this.getChartPoint(event);
        this.updateCurrentDrawing(point);
    }

    handleMouseUp(event) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        if (this.currentDrawing) {
            this.finalizeDrawing();
        }
    }

    handleKeyDown(event) {
        // Undo with Ctrl+Z
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            this.undo();
        }
        
        // Redo with Ctrl+Y
        if (event.ctrlKey && event.key === 'y') {
            event.preventDefault();
            this.redo();
        }
        
        // Delete selected drawing with Delete key
        if (event.key === 'Delete') {
            this.deleteSelected();
        }
        
        // Escape to cancel current drawing
        if (event.key === 'Escape') {
            this.cancelDrawing();
        }
    }

    getChartPoint(event) {
        const rect = this.chartEngine.container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Get main panel for coordinate conversion
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return null;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        
        const time = timeScale.coordinateToTime(x);
        const price = priceScale.coordinateToPrice(y);
        
        return {
            x,
            y,
            time: this.snapToTime ? this.snapTimeToCandle(time) : time,
            price: this.snapToPrice ? this.snapPriceToLevel(price) : price
        };
    }

    snapTimeToCandle(time) {
        // In a real implementation, you would snap to actual candle times
        return time;
    }

    snapPriceToLevel(price) {
        // Snap to round price levels
        const decimals = this.getPriceDecimals(price);
        const factor = Math.pow(10, Math.max(0, 2 - decimals));
        return Math.round(price * factor) / factor;
    }

    getPriceDecimals(price) {
        if (price < 1) return 4;
        if (price < 10) return 3;
        if (price < 100) return 2;
        return 1;
    }

    // Drawing tool implementations
    startTrendLine(startPoint) {
        const id = this.generateId('trendline');
        this.currentDrawing = {
            id,
            type: 'trendline',
            startPoint,
            endPoint: startPoint,
            color: this.colors.trendline,
            lineWidth: 2,
            lineStyle: 0
        };
        
        this.renderTrendLine(this.currentDrawing);
    }

    drawHorizontalLine(point) {
        const id = this.generateId('horizontal');
        const drawing = {
            id,
            type: 'horizontal',
            price: point.price,
            color: this.colors.horizontal,
            lineWidth: 2,
            lineStyle: 0
        };
        
        this.tools.set(id, drawing);
        this.renderHorizontalLine(drawing);
        this.addToHistory();
        this.saveToStorage();
        
        // Auto-deselect tool after drawing
        this.activeTool = null;
        this.updateCursor();
    }

    drawVerticalLine(point) {
        const id = this.generateId('vertical');
        const drawing = {
            id,
            type: 'vertical',
            time: point.time,
            color: this.colors.vertical,
            lineWidth: 2,
            lineStyle: 0
        };
        
        this.tools.set(id, drawing);
        this.renderVerticalLine(drawing);
        this.addToHistory();
        this.saveToStorage();
        
        this.activeTool = null;
        this.updateCursor();
    }

    startRectangle(startPoint) {
        const id = this.generateId('rectangle');
        this.currentDrawing = {
            id,
            type: 'rectangle',
            startPoint,
            endPoint: startPoint,
            color: this.colors.rectangle,
            fillColor: `${this.colors.rectangle}20`,
            lineWidth: 2
        };
        
        this.renderRectangle(this.currentDrawing);
    }

    startFibonacci(startPoint) {
        const id = this.generateId('fibonacci');
        this.currentDrawing = {
            id,
            type: 'fibonacci',
            startPoint,
            endPoint: startPoint,
            color: this.colors.fibonacci,
            lineWidth: 1,
            levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
        };
        
        this.renderFibonacci(this.currentDrawing);
    }

    addText(point) {
        const text = prompt('Enter text:');
        if (!text) return;
        
        const id = this.generateId('text');
        const drawing = {
            id,
            type: 'text',
            point,
            text,
            color: this.colors.text,
            fontSize: 12,
            fontFamily: 'Arial'
        };
        
        this.tools.set(id, drawing);
        this.renderText(drawing);
        this.addToHistory();
        this.saveToStorage();
        
        this.activeTool = null;
        this.updateCursor();
    }

    updateCurrentDrawing(point) {
        if (!this.currentDrawing) return;
        
        this.currentDrawing.endPoint = point;
        
        switch (this.currentDrawing.type) {
            case 'trendline':
                this.renderTrendLine(this.currentDrawing);
                break;
            case 'rectangle':
                this.renderRectangle(this.currentDrawing);
                break;
            case 'fibonacci':
                this.renderFibonacci(this.currentDrawing);
                break;
        }
    }

    finalizeDrawing() {
        if (!this.currentDrawing) return;
        
        this.tools.set(this.currentDrawing.id, { ...this.currentDrawing });
        this.currentDrawing = null;
        this.activeTool = null;
        this.updateCursor();
        this.addToHistory();
        this.saveToStorage();
    }

    cancelDrawing() {
        if (this.currentDrawing) {
            this.removeDrawingElement(this.currentDrawing.id);
            this.currentDrawing = null;
            this.isDrawing = false;
            this.activeTool = null;
            this.updateCursor();
        }
    }

    // Rendering methods
    renderTrendLine(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const element = this.createSVGLine(
            drawing.startPoint,
            drawing.endPoint,
            drawing.color,
            drawing.lineWidth,
            drawing.lineStyle
        );
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'trendline');
        this.appendToChart(element);
    }

    renderHorizontalLine(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const priceScale = mainPanel.chart.priceScale('right');
        const y = priceScale.priceToCoordinate(drawing.price);
        
        const element = this.createSVGElement('line', {
            x1: 0,
            y1: y,
            x2: '100%',
            y2: y,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth,
            'stroke-dasharray': this.getStrokeDashArray(drawing.lineStyle)
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'horizontal');
        this.appendToChart(element);
    }

    renderVerticalLine(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const x = timeScale.timeToCoordinate(drawing.time);
        
        const element = this.createSVGElement('line', {
            x1: x,
            y1: 0,
            x2: x,
            y2: '100%',
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth,
            'stroke-dasharray': this.getStrokeDashArray(drawing.lineStyle)
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'vertical');
        this.appendToChart(element);
    }

    renderRectangle(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        
        const x1 = timeScale.timeToCoordinate(drawing.startPoint.time);
        const y1 = priceScale.priceToCoordinate(drawing.startPoint.price);
        const x2 = timeScale.timeToCoordinate(drawing.endPoint.time);
        const y2 = priceScale.priceToCoordinate(drawing.endPoint.price);
        
        const element = this.createSVGElement('rect', {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
            stroke: drawing.color,
            fill: drawing.fillColor || 'transparent',
            'stroke-width': drawing.lineWidth
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'rectangle');
        this.appendToChart(element);
    }

    renderFibonacci(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        
        const x1 = timeScale.timeToCoordinate(drawing.startPoint.time);
        const y1 = priceScale.priceToCoordinate(drawing.startPoint.price);
        const x2 = timeScale.timeToCoordinate(drawing.endPoint.time);
        const y2 = priceScale.priceToCoordinate(drawing.endPoint.price);
        
        const group = this.createSVGElement('g');
        group.setAttribute('data-drawing-id', drawing.id);
        group.setAttribute('data-drawing-type', 'fibonacci');
        
        // Main trend line
        const trendLine = this.createSVGElement('line', {
            x1, y1, x2, y2,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth
        });
        group.appendChild(trendLine);
        
        // Fibonacci levels
        const priceRange = drawing.endPoint.price - drawing.startPoint.price;
        drawing.levels.forEach(level => {
            const levelPrice = drawing.startPoint.price + (priceRange * level);
            const levelY = priceScale.priceToCoordinate(levelPrice);
            
            const line = this.createSVGElement('line', {
                x1: Math.min(x1, x2),
                y1: levelY,
                x2: Math.max(x1, x2),
                y2: levelY,
                stroke: drawing.color,
                'stroke-width': 1,
                'stroke-dasharray': '3,3',
                opacity: 0.7
            });
            group.appendChild(line);
            
            // Level text
            const text = this.createSVGElement('text', {
                x: Math.max(x1, x2) + 5,
                y: levelY - 3,
                fill: drawing.color,
                'font-size': 10,
                'font-family': 'Arial'
            });
            text.textContent = `${(level * 100).toFixed(1)}% (${levelPrice.toFixed(2)})`;
            group.appendChild(text);
        });
        
        this.appendToChart(group);
    }

    renderText(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        
        const x = timeScale.timeToCoordinate(drawing.point.time);
        const y = priceScale.priceToCoordinate(drawing.point.price);
        
        const element = this.createSVGElement('text', {
            x,
            y,
            fill: drawing.color,
            'font-size': drawing.fontSize,
            'font-family': drawing.fontFamily
        });
        element.textContent = drawing.text;
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'text');
        
        this.appendToChart(element);
    }

    // Helper methods
    createSVGLine(startPoint, endPoint, color, lineWidth, lineStyle) {
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return null;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        
        const x1 = timeScale.timeToCoordinate(startPoint.time);
        const y1 = priceScale.priceToCoordinate(startPoint.price);
        const x2 = timeScale.timeToCoordinate(endPoint.time);
        const y2 = priceScale.priceToCoordinate(endPoint.price);
        
        return this.createSVGElement('line', {
            x1, y1, x2, y2,
            stroke: color,
            'stroke-width': lineWidth,
            'stroke-dasharray': this.getStrokeDashArray(lineStyle)
        });
    }

    createSVGElement(tagName, attributes = {}) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        return element;
    }

    getStrokeDashArray(lineStyle) {
        const styles = {
            0: 'none', // Solid
            1: '5,5',   // Dashed
            2: '2,2',   // Dotted
            3: '10,5,2,5' // Dash-dot
        };
        return styles[lineStyle] || 'none';
    }

    appendToChart(element) {
        let svg = this.chartEngine.container.querySelector('.drawing-overlay');
        if (!svg) {
            svg = this.createSVGElement('svg', {
                class: 'drawing-overlay',
                style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000;'
            });
            this.chartEngine.container.appendChild(svg);
        }
        svg.appendChild(element);
    }

    removeDrawingElement(id) {
        const elements = this.chartEngine.container.querySelectorAll(`[data-drawing-id="${id}"]`);
        elements.forEach(element => element.remove());
    }

    generateId(type) {
        return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // History management
    addToHistory() {
        const state = this.getState();
        this.drawingHistory = this.drawingHistory.slice(0, this.historyIndex + 1);
        this.drawingHistory.push(state);
        this.historyIndex++;
        
        // Limit history size
        if (this.drawingHistory.length > 50) {
            this.drawingHistory.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.drawingHistory[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.drawingHistory.length - 1) {
            this.historyIndex++;
            this.restoreState(this.drawingHistory[this.historyIndex]);
        }
    }

    getState() {
        return {
            tools: new Map(this.tools),
            timestamp: Date.now()
        };
    }

    restoreState(state) {
        this.clearAll();
        this.tools = new Map(state.tools);
        this.renderAll();
        this.saveToStorage();
    }

    // Tool management
    deleteTool(id) {
        this.tools.delete(id);
        this.removeDrawingElement(id);
        this.addToHistory();
        this.saveToStorage();
    }

    deleteSelected() {
        // In a full implementation, you would track selected tools
        // For now, this is a placeholder
        console.log('Delete selected tools');
    }

    clearAll() {
        const svg = this.chartEngine.container.querySelector('.drawing-overlay');
        if (svg) {
            svg.innerHTML = '';
        }
        this.tools.clear();
        this.addToHistory();
        this.saveToStorage();
    }

    renderAll() {
        this.tools.forEach(drawing => {
            switch (drawing.type) {
                case 'trendline':
                    this.renderTrendLine(drawing);
                    break;
                case 'horizontal':
                    this.renderHorizontalLine(drawing);
                    break;
                case 'vertical':
                    this.renderVerticalLine(drawing);
                    break;
                case 'rectangle':
                    this.renderRectangle(drawing);
                    break;
                case 'fibonacci':
                    this.renderFibonacci(drawing);
                    break;
                case 'text':
                    this.renderText(drawing);
                    break;
            }
        });
    }

    // Persistence
    saveToStorage() {
        const data = {
            tools: Array.from(this.tools.entries()),
            colors: this.colors,
            settings: {
                snapToPrice: this.snapToPrice,
                snapToTime: this.snapToTime
            }
        };
        
        localStorage.setItem('chart_drawings', JSON.stringify(data));
    }

    loadFromStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('chart_drawings') || '{}');
            
            if (data.tools) {
                this.tools = new Map(data.tools);
            }
            
            if (data.colors) {
                this.colors = { ...this.colors, ...data.colors };
            }
            
            if (data.settings) {
                this.snapToPrice = data.settings.snapToPrice ?? true;
                this.snapToTime = data.settings.snapToTime ?? true;
            }
            
            // Initial history state
            this.addToHistory();
            
        } catch (error) {
            console.error('Error loading drawings from storage:', error);
        }
    }

    // Configuration
    setColor(toolType, color) {
        this.colors[toolType] = color;
        this.saveToStorage();
    }

    setSnapToPrice(enabled) {
        this.snapToPrice = enabled;
        this.saveToStorage();
    }

    setSnapToTime(enabled) {
        this.snapToTime = enabled;
        this.saveToStorage();
    }

    // Cleanup
    destroy() {
        document.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('keydown', this.handleKeyDown);
        
        this.clearAll();
    }

    // Export/Import
    export() {
        return {
            tools: Array.from(this.tools.entries()),
            colors: this.colors,
            settings: {
                snapToPrice: this.snapToPrice,
                snapToTime: this.snapToTime
            },
            version: '1.0'
        };
    }

    import(data) {
        try {
            this.clearAll();
            
            if (data.tools) {
                this.tools = new Map(data.tools);
            }
            
            if (data.colors) {
                this.colors = { ...this.colors, ...data.colors };
            }
            
            if (data.settings) {
                this.snapToPrice = data.settings.snapToPrice ?? true;
                this.snapToTime = data.settings.snapToTime ?? true;
            }
            
            this.renderAll();
            this.addToHistory();
            
        } catch (error) {
            console.error('Error importing drawings:', error);
        }
    }
}

export default DrawingTools;