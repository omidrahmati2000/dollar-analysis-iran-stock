class DrawingTools {
    constructor(chartEngine) {
        this.chartEngine = chartEngine;
        this.tools = new Map();
        this.activeTool = null;
        this.isDrawing = false;
        this.currentDrawing = null;
        this.selectedDrawing = null;
        this.drawingHistory = [];
        this.historyIndex = -1;
        this.snapToPrice = true;
        this.snapToTime = true;
        this.isDragging = false;
        this.dragStartPoint = null;
        this.frozenTools = new Set(); // Tools that should not be redrawn
        
        // اضافه کردن tracking برای context کامل
        this.currentTimeframe = '1D';
        this.currentDataType = 'unadjusted'; // 'adjusted' یا 'unadjusted'
        
        // Advanced Fibonacci system
        this.fibonacciSettings = {
            'retracement': {
                levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
                customLevels: [],
                showLabels: true,
                showPrices: true,
                showPercents: true,
                extendLeft: false,
                extendRight: true,
                lineStyle: 'solid',
                lineWidth: 1,
                showBackground: true,
                backgroundOpacity: 0.15,
                dragHandles: true,
                editMode: false
            },
            'extension': {
                levels: [0, 0.618, 1, 1.618, 2.618, 4.236],
                customLevels: [],
                showLabels: true,
                showPrices: true,
                showPercents: true,
                extendLeft: false,
                extendRight: true,
                lineStyle: 'solid',
                lineWidth: 1,
                showBackground: false,
                dragHandles: true,
                editMode: false
            },
            'fan': {
                levels: [0.236, 0.382, 0.5, 0.618, 0.786],
                showLabels: true,
                lineStyle: 'solid',
                lineWidth: 1,
                dragHandles: true,
                editMode: false
            },
            'arcs': {
                levels: [0.236, 0.382, 0.5, 0.618, 0.786],
                showLabels: true,
                lineStyle: 'solid',
                lineWidth: 1,
                dragHandles: true,
                editMode: false
            },
            'timezones': {
                sequence: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
                showLabels: true,
                lineStyle: 'solid',
                lineWidth: 1,
                dragHandles: true,
                editMode: false
            }
        };

        this.fibColors = {
            0: '#FF6B6B',      // Light Red
            0.236: '#4ECDC4',  // Teal
            0.382: '#45B7D1',  // Blue
            0.5: '#96CEB4',    // Green
            0.618: '#FFEAA7',  // Yellow
            0.786: '#DDA0DD',  // Plum
            1: '#FF6B6B',      // Light Red
            1.618: '#FF8A80',  // Pink
            2.618: '#A8E6CF', // Light Green
            4.236: '#87CEEB'   // Sky Blue
        };

        this.currentFibType = 'retracement';
        this.selectedLevel = null;
        this.levelDragMode = false;
        
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
        this.setupChartEventListeners();
    }

    setupEventListeners() {
        // Mouse events only for chart container to prevent interference
        if (this.chartEngine.container) {
            this.chartEngine.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
            this.chartEngine.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.chartEngine.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
            this.chartEngine.container.addEventListener('mouseleave', this.handleMouseUp.bind(this)); // End drawing if mouse leaves
        }
        document.addEventListener('keydown', this.handleKeyDown.bind(this)); // Keep global for keyboard shortcuts
    }

    setupChartEventListeners() {
        // Listen for chart updates to redraw elements with fixed positions
        const mainPanel = this.chartEngine.panels.get('main');
        if (mainPanel && mainPanel.chart) {
            // Listen to time scale changes (pan/zoom)
            try {
                const timeScale = mainPanel.chart.timeScale();
                if (timeScale && typeof timeScale.subscribeVisibleTimeRangeChange === 'function') {
                    // Use debounced redraw to avoid too many redraws during rapid changes
                    timeScale.subscribeVisibleTimeRangeChange(() => {
                        this.debounceRedraw('timeScale');
                    });
                }
            } catch (error) {
                console.warn('Error setting up time scale listener:', error);
            }
            
            // Listen to price scale changes
            try {
                const priceScale = mainPanel.chart.priceScale('right');
                if (priceScale && typeof priceScale.subscribeVisibleRangeChange === 'function') {
                    priceScale.subscribeVisibleRangeChange(() => {
                        this.debounceRedraw('priceScale');
                    });
                }
            } catch (error) {
                console.warn('Error setting up price scale listener:', error);
            }
            
            // Also listen to chart resize
            if (typeof ResizeObserver !== 'undefined') {
                const resizeObserver = new ResizeObserver(() => {
                    this.debounceRedraw('resize');
                });
                resizeObserver.observe(this.chartEngine.container);
                this.resizeObserver = resizeObserver;
            }
        }
    }

    debounceRedraw(reason) {
        // Clear existing timeout to avoid multiple rapid redraws
        if (this.redrawTimeout) {
            clearTimeout(this.redrawTimeout);
        }
        
        // Invalidate cache when chart changes
        this.cachedPriceRange = null;
        this.cacheTimestamp = 0;
        
        // Use longer delay for better performance
        this.redrawTimeout = setTimeout(() => {
            requestAnimationFrame(() => {
                // Only log major redraws to reduce console spam
                if (reason !== 'timeScale' && reason !== 'priceScale') {
                    console.log(`Chart ${reason} changed - redrawing ${this.tools.size} elements`);
                }
                this.redrawAllElements();
                this.redrawTimeout = null;
            });
        }, reason === 'timeScale' || reason === 'priceScale' ? 200 : 50); // Much longer delay for scale changes
    }

    redrawAllElements() {
        // Redraw all elements to maintain their position relative to price/time
        if (this.isRedrawing) return; // Prevent recursive redraws
        
        this.isRedrawing = true;
        try {
            // Update SVG overlay size first
            const svg = this.chartEngine.container.querySelector('.drawing-overlay');
            if (svg) {
                const containerRect = this.chartEngine.container.getBoundingClientRect();
                svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
            }
            
            // Get visible range for optimization
            const mainPanel = this.chartEngine.panels.get('main');
            let visibleTimeRange = null;
            let visiblePriceRange = null;
            
            if (mainPanel && mainPanel.chart) {
                const timeScale = mainPanel.chart.timeScale();
                const priceScale = mainPanel.chart.priceScale('right');
                
                if (timeScale && typeof timeScale.getVisibleRange === 'function') {
                    visibleTimeRange = timeScale.getVisibleRange();
                }
                if (priceScale && typeof priceScale.getVisibleRange === 'function') {
                    visiblePriceRange = priceScale.getVisibleRange();
                }
            }
            
            // Redraw all drawing elements, but skip frozen ones
            this.tools.forEach(drawing => {
                // Skip frozen fibonacci tools to prevent movement during pan/zoom
                if (this.frozenTools.has(drawing.id)) {
                    return;
                }
                
                this.renderDrawing(drawing);
            });
        } catch (error) {
            console.error('Error during redraw:', error);
        } finally {
            this.isRedrawing = false;
        }
    }

    setActiveTool(toolType) {
        this.activeTool = toolType;
        this.updateCursor();
    }

    updateCursor() {
        const container = this.chartEngine.container;
        if (!container) return;

        // Add visual feedback classes
        container.classList.remove('drawing-mode-active', 'drawing-mode-none');
        
        switch (this.activeTool) {
            case 'trendline':
                container.style.cursor = 'crosshair';
                container.title = 'Draw trend line - Click and drag';
                break;
            case 'horizontal':
                container.style.cursor = 'ns-resize';
                container.title = 'Draw horizontal line - Click to place';
                break;
            case 'vertical':
                container.style.cursor = 'ew-resize';
                container.title = 'Draw vertical line - Click to place';
                break;
            case 'rectangle':
                container.style.cursor = 'nw-resize';
                container.title = 'Draw rectangle - Click and drag';
                break;
            case 'ellipse':
                container.style.cursor = 'crosshair';
                container.title = 'Draw ellipse - Click and drag';
                break;
            case 'fibonacci':
                container.style.cursor = 'crosshair';
                container.title = 'Draw Fibonacci retracement - Click and drag';
                break;
            case 'text':
                container.style.cursor = 'text';
                container.title = 'Add text - Click to place';
                break;
            case 'crosshair':
                container.style.cursor = 'crosshair';
                container.title = 'Crosshair mode - Hover to see values';
                break;
            case 'none':
            default:
                container.style.cursor = 'default';
                container.title = 'Selection mode - Click to interact';
                container.classList.add('drawing-mode-none');
                return;
        }
        
        container.classList.add('drawing-mode-active');
    }

    handleMouseDown(event) {
        const rect = this.chartEngine.container.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) {
            return;
        }

        // Prevent chart interaction when drawing tools are active
        if (this.activeTool && this.activeTool !== 'none') {
            event.preventDefault();
            event.stopPropagation();
        }

        const point = this.getChartPoint(event);
        
        // If no tool is active or select tool, check for element selection
        if (!this.activeTool || this.activeTool === 'none') {
            const clickedElement = this.getElementAtPoint(event.clientX - rect.left, event.clientY - rect.top);
            if (clickedElement) {
                this.selectDrawing(clickedElement.getAttribute('data-drawing-id'));
                this.isDragging = true;
                this.dragStartPoint = point;
                return;
            } else {
                this.clearSelection();
            }
            return;
        }

        this.isDrawing = true;
        
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
            case 'ellipse':
                this.startEllipse(point);
                break;
            case 'triangle':
                this.startTriangle(point);
                break;
            case 'ray':
                this.startRay(point);
                break;
            case 'line':
                this.startLine(point);
                break;
            case 'segment':
                this.startSegment(point);
                break;
            case 'parallel':
                this.startParallelChannel(point);
                break;
            case 'fibonacci':
                this.startAdvancedFibonacci(point);
                break;
            case 'fibonacci-retracement':
                this.currentFibType = 'retracement';
                this.startAdvancedFibonacci(point);
                break;
            case 'fibonacci-extension':
                this.currentFibType = 'extension';
                this.startAdvancedFibonacci(point);
                break;
            case 'fibonacci-fan':
                this.currentFibType = 'fan';
                this.startAdvancedFibonacci(point);
                break;
            case 'fibonacci-arcs':
                this.currentFibType = 'arcs';
                this.startAdvancedFibonacci(point);
                break;
            case 'fibonacci-timezones':
                this.currentFibType = 'timezones';
                this.startAdvancedFibonacci(point);
                break;
            case 'fibextension':
                this.startFibExtension(point);
                break;
            case 'text':
                this.addText(point);
                break;
            case 'arrow':
                this.addArrow(point);
                break;
            case 'pitchfork':
                this.startPitchfork(point);
                break;
            case 'gann':
                this.startGannFan(point);
                break;
        }
    }

    handleMouseMove(event) {
        // Prevent chart panning during drawing/dragging
        if ((this.isDrawing && this.currentDrawing) || (this.isDragging && this.selectedDrawing)) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        // Handle dragging selected elements
        if (this.isDragging && this.selectedDrawing && this.dragStartPoint) {
            const point = this.getChartPoint(event);
            this.moveSelectedDrawing(point);
            return;
        }
        
        // Handle drawing new elements
        if (!this.isDrawing || !this.currentDrawing) return;
        
        const point = this.getChartPoint(event);
        this.updateCurrentDrawing(point);
    }

    handleMouseUp(event) {
        // Handle end of dragging
        if (this.isDragging) {
            this.isDragging = false;
            this.dragStartPoint = null;
            this.addToHistory();
            this.saveToStorage();
            return;
        }
        
        // Handle end of drawing
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
        
        // Select all with Ctrl+A
        if (event.ctrlKey && event.key === 'a') {
            event.preventDefault();
            this.selectAll();
        }
        
        // Escape to cancel current drawing
        if (event.key === 'Escape') {
            this.cancelDrawing();
        }
    }

    getChartPoint(event) {
        const rect = this.chartEngine.container.getBoundingClientRect();
        const x = Math.round(event.clientX - rect.left);
        const y = Math.round(event.clientY - rect.top);
        
        // Validate coordinates are within chart bounds
        if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
            return {
                x: Math.max(0, Math.min(rect.width, x)),
                y: Math.max(0, Math.min(rect.height, y)),
                time: Date.now() / 1000,
                price: 50000
            };
        }
        
        // Get main panel for coordinate conversion
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) {
            // Return pixel-based fallback
            return {
                x,
                y,
                time: Date.now() / 1000,
                price: 50000 // Reasonable Iranian stock price fallback
            };
        }
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        
        let time, price;
        
        try {
            // Handle time coordinate conversion - try multiple methods
            time = null;
            
            // Method 1: Direct coordinateToTime
            if (typeof timeScale.coordinateToTime === 'function') {
                try {
                    const timeResult = timeScale.coordinateToTime(x);
                    if (timeResult && !isNaN(timeResult) && timeResult > 0) {
                        time = timeResult;
                    }
                } catch (e) {
                    // Method failed, try next one
                }
            }
            
            // Method 2: Logical coordinate conversion if method 1 failed
            if (!time && typeof timeScale.coordinateToLogical === 'function' && typeof timeScale.logicalToTime === 'function') {
                try {
                    const logical = timeScale.coordinateToLogical(x);
                    if (logical !== null && logical !== undefined && !isNaN(logical)) {
                        const timeResult = timeScale.logicalToTime(logical);
                        if (timeResult && !isNaN(timeResult) && timeResult > 0) {
                            time = timeResult;
                        }
                    }
                } catch (e) {
                    // Method failed, try next one
                }
            }
            
            // Method 3: Fallback using visible range
            if (!time) {
                const visibleRange = timeScale.getVisibleRange();
                if (visibleRange && visibleRange.from && visibleRange.to) {
                    const rect = this.chartEngine.container.getBoundingClientRect();
                    const timeRange = visibleRange.to - visibleRange.from;
                    const xRatio = x / rect.width;
                    const calculatedTime = visibleRange.from + (xRatio * timeRange);
                    if (calculatedTime && !isNaN(calculatedTime) && calculatedTime > 0) {
                        time = calculatedTime;
                    }
                }
            }
            
            // Final fallback - don't use Date.now(), use a default based on chart data
            if (!time) {
                console.warn('All time conversion methods failed, using fallback time');
                time = 1640995200; // A reasonable default timestamp (Jan 1, 2022)
            }
            
            // Handle price coordinate conversion  
            price = null;
            
            // Method 1: Direct coordinateToPrice
            if (typeof priceScale.coordinateToPrice === 'function') {
                try {
                    const priceResult = priceScale.coordinateToPrice(y);
                    if (priceResult && !isNaN(priceResult) && priceResult > 0) {
                        price = priceResult;
                    }
                } catch (e) {
                    // Method failed, try fallback
                }
            }
            
            // Method 2: Fallback using visible price range
            if (!price) {
                try {
                    const visiblePriceRange = priceScale.getVisibleRange();
                    if (visiblePriceRange && visiblePriceRange.from && visiblePriceRange.to) {
                        const rect = this.chartEngine.container.getBoundingClientRect();
                        const priceRange = visiblePriceRange.to - visiblePriceRange.from;
                        // Fix Y coordinate mapping - top should be high price, bottom should be low price
                        const yRatio = (y / rect.height); // Direct ratio without inversion
                        const calculatedPrice = visiblePriceRange.to - (yRatio * priceRange); // High price at top
                        
                        if (calculatedPrice && !isNaN(calculatedPrice) && calculatedPrice > 0) {
                            price = calculatedPrice;
                        }
                    }
                } catch (e) {
                    // Fallback failed
                }
            }
            
            // Method 3: Final fallback with reasonable Iranian stock prices
            if (!price) {
                const rect = this.chartEngine.container.getBoundingClientRect();
                const normalizedY = y / rect.height;
                // Estimate price range for Iranian stocks
                const minPrice = 10000;  // 10K Rials
                const maxPrice = 200000; // 200K Rials
                price = maxPrice - (normalizedY * (maxPrice - minPrice));
            }
            
            // Ensure valid values
            if (!time || isNaN(time) || time <= 0) {
                time = 1640995200; // Default timestamp
            }
            if (!price || isNaN(price) || price <= 0) {
                price = 50000; // Default price
            }
            
        } catch (error) {
            console.warn('Chart coordinate conversion error:', error);
            time = 1640995200; // Default timestamp
            price = 50000;     // Default price
        }
        
        const result = {
            x,
            y,
            time: this.snapToTime ? this.snapTimeToCandle(time) : time,
            price: this.snapToPrice ? this.snapPriceToLevel(price) : price
        };
        
        return result;
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

    // Enhanced coordinate conversion helpers with better price scale detection
    safeTimeToCoordinate(timeScale, time) {
        try {
            if (!timeScale) {
                console.warn('No timeScale provided to safeTimeToCoordinate');
                return 100;
            }
            
            // Ensure time is valid
            if (!time || isNaN(time)) {
                console.warn('Invalid time provided:', time);
                return 100;
            }
            
            // Try TradingView timeToCoordinate method
            if (typeof timeScale.timeToCoordinate === 'function') {
                const coord = timeScale.timeToCoordinate(time);
                if (this.isValidCoordinate(coord)) {
                    return coord;
                }
            }
            
            // Try logical coordinate conversion for better accuracy
            if (typeof timeScale.timeToLogical === 'function' && typeof timeScale.logicalToCoordinate === 'function') {
                const logical = timeScale.timeToLogical(time);
                if (logical !== null && logical !== undefined && !isNaN(logical)) {
                    const coord = timeScale.logicalToCoordinate(logical);
                    if (this.isValidCoordinate(coord)) {
                        return coord;
                    }
                }
            }
            
            // Enhanced fallback using visible time range
            try {
                const visibleRange = timeScale.getVisibleRange();
                if (visibleRange && visibleRange.from && visibleRange.to) {
                    const containerRect = this.chartEngine.container.getBoundingClientRect();
                    const timeRange = visibleRange.to - visibleRange.from;
                    const timeOffset = time - visibleRange.from;
                    const coord = (timeOffset / timeRange) * containerRect.width;
                    
                    if (this.isValidCoordinate(coord)) {
                        return coord;
                    }
                }
            } catch (fallbackError) {
                console.warn('Fallback time coordinate calculation failed:', fallbackError);
            }
            
            // Last resort fallback
            console.warn('Using default time coordinate for time:', time);
            return 100;
            
        } catch (error) {
            console.warn('Time coordinate conversion failed:', error, 'for time:', time);
            return 100;
        }
    }

    // Cache for price range to avoid repeated calculations
    cachedPriceRange = null;
    cacheTimestamp = 0;
    cacheValidFor = 1000; // Cache valid for 1 second
    lastChartState = null; // Track chart state changes

    safePriceToCoordinate(priceScale, price, containerHeight = 400) {
        if (price === null || price === undefined || isNaN(price)) {
            return containerHeight / 2;
        }
        
        try {
            // First try the official lightweight-charts API method
            if (priceScale && typeof priceScale.priceToCoordinate === 'function') {
                const coord = priceScale.priceToCoordinate(price);
                if (this.isValidCoordinate(coord)) {
                    return coord;
                }
            }
            
            // Fallback: Get price range from visible range and calculate proportionally
            if (priceScale && typeof priceScale.getVisibleRange === 'function') {
                const visibleRange = priceScale.getVisibleRange();
                if (visibleRange && visibleRange.from !== undefined && visibleRange.to !== undefined) {
                    // Fix Y coordinate mapping to match getChartPoint logic
                    const priceRatio = (price - visibleRange.from) / (visibleRange.to - visibleRange.from);
                    const coord = containerHeight * (1 - priceRatio); // High price at top (y=0), low price at bottom
                    if (this.isValidCoordinate(coord)) {
                        return coord;
                    }
                }
            }
            
        } catch (error) {
            console.warn('Price coordinate conversion failed:', error);
        }
        
        // Final fallback with reasonable Iranian stock price estimation
        const estimatedMin = 1000;
        const estimatedMax = 500000;
        const normalizedPrice = Math.max(0, Math.min(1, (price - estimatedMin) / (estimatedMax - estimatedMin)));
        return containerHeight * (1 - normalizedPrice);
    }

    // Enhanced coordinate validation with bounds checking
    isValidCoordinate(coord) {
        if (coord === null || coord === undefined || isNaN(coord) || !isFinite(coord)) {
            return false;
        }
        // Allow reasonable coordinate ranges for drawing tools
        // Expanded range to handle edge cases with zooming and panning
        return coord >= -50000 && coord <= 50000;
    }

    // Drawing tool implementations
    startTrendLine(startPoint) {
        if (!startPoint || !startPoint.time || !startPoint.price) {
            console.warn('Invalid startPoint for trendline:', startPoint);
            return;
        }
        
        const id = this.generateId('trendline');
        this.currentDrawing = {
            id,
            type: 'trendline',
            startPoint: { ...startPoint },
            endPoint: { ...startPoint },
            color: this.colors.trendline,
            lineWidth: 2,
            lineStyle: 0
        };
        
        console.log('Starting trendline:', this.currentDrawing);
        this.renderTrendLinePreview(this.currentDrawing);
    }

    renderTrendLinePreview(drawing) {
        if (!drawing || !drawing.startPoint || !drawing.endPoint) return;
        
        // Remove any existing preview
        this.removeDrawingElement(drawing.id + '_preview');
        
        const container = this.chartEngine.container;
        let svg = container.querySelector('.drawing-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'drawing-svg');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '1000';
            container.appendChild(svg);
        }
        
        try {
            const mainPanel = this.chartEngine.panels.get('main');
            if (mainPanel && mainPanel.chart) {
                const timeScale = mainPanel.chart.timeScale();
                const priceScale = mainPanel.chart.priceScale('right');
                const containerRect = this.chartEngine.container.getBoundingClientRect();
                
                const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
                const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
                const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
                const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
                
                // Only draw if coordinates are valid
                if (this.isValidCoordinate(x1) && this.isValidCoordinate(y1) && 
                    this.isValidCoordinate(x2) && this.isValidCoordinate(y2)) {
                    
                    const line = this.createSVGElement('line', {
                        x1, y1, x2, y2,
                        stroke: drawing.color,
                        'stroke-width': drawing.lineWidth,
                        'stroke-dasharray': '5,5', // Dashed for preview
                        opacity: 0.7,
                        'pointer-events': 'none'
                    });
                    
                    line.setAttribute('data-drawing-id', drawing.id + '_preview');
                    line.setAttribute('class', 'trendline-preview');
                    svg.appendChild(line);
                }
            }
        } catch (error) {
            console.warn('Trendline preview rendering failed:', error);
        }
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

    startAdvancedFibonacci(startPoint) {
        if (!startPoint || !startPoint.time || !startPoint.price) {
            console.warn('Invalid startPoint for advanced fibonacci:', startPoint);
            return;
        }
        
        const fibType = this.currentFibType || 'retracement';
        const settings = this.fibonacciSettings[fibType];
        
        const id = this.generateId('fibonacci-' + fibType);
        this.currentDrawing = {
            id,
            type: 'fibonacci-' + fibType,
            fibType: fibType,
            startPoint: { ...startPoint },
            endPoint: { ...startPoint }, // شروع با همان نقطه
            settings: { ...settings },
            levels: [...settings.levels],
            customLevels: settings.customLevels ? [...settings.customLevels] : [],
            editMode: false,
            selectedLevel: null,
            isComplete: false // برای نشان دادن که هنوز کامل نشده
        };
        
        console.log(`Starting advanced fibonacci (${fibType}) - need drag to complete:`, this.currentDrawing);
        // فقط یک preview ساده بدون محاسبه levels
        this.renderFibonacciPreview(this.currentDrawing);
    }

    // Legacy method for backward compatibility
    startFibonacci(startPoint) {
        this.currentFibType = 'retracement';
        this.startAdvancedFibonacci(startPoint);
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
                this.renderTrendLinePreview(this.currentDrawing);
                break;
            case 'rectangle':
                this.renderRectangle(this.currentDrawing);
                break;
            case 'ellipse':
                this.renderEllipse(this.currentDrawing);
                break;
            case 'triangle':
                this.renderTriangle(this.currentDrawing);
                break;
            case 'ray':
                this.renderRay(this.currentDrawing);
                break;
            case 'line':
                this.renderLineExtended(this.currentDrawing);
                break;
            case 'segment':
                this.renderSegment(this.currentDrawing);
                break;
            case 'parallel':
                this.renderParallelChannel(this.currentDrawing);
                break;
            case 'fibonacci':
                this.renderFibonacci(this.currentDrawing);
                break;
            case 'fibonacci-retracement':
            case 'fibonacci-extension':
            case 'fibonacci-fan':
            case 'fibonacci-arcs':
            case 'fibonacci-timezones':
                // در حین drag، فقط preview نشان می‌دهیم
                this.renderFibonacciPreview(this.currentDrawing);
                break;
            case 'fibextension':
                this.renderFibExtension(this.currentDrawing);
                break;
            case 'pitchfork':
                this.renderPitchfork(this.currentDrawing);
                break;
            case 'gann':
                this.renderGannFan(this.currentDrawing);
                break;
        }
    }

    finalizeDrawing() {
        if (!this.currentDrawing) return;
        
        console.log('Finalizing drawing:', this.currentDrawing);
        
        // Remove preview for trendline and render final version
        if (this.currentDrawing.type === 'trendline') {
            this.removeDrawingElement(this.currentDrawing.id + '_preview');
        }
        
        // برای fibonacci، وقتی finalize می‌شود باید levels محاسبه شوند
        if (this.currentDrawing.type && this.currentDrawing.type.startsWith('fibonacci-')) {
            this.currentDrawing.isComplete = true;
            // محاسبه و رسم نهایی fibonacci با تمام levels
            this.renderAdvancedFibonacci(this.currentDrawing);
        }
        
        // Make sure we have a complete drawing object
        const finalDrawing = { ...this.currentDrawing };
        this.tools.set(finalDrawing.id, finalDrawing);
        
        console.log('Drawing added to tools map, total tools:', this.tools.size);
        
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
        
        if (!drawing.startPoint || !drawing.endPoint) {
            console.warn('TrendLine missing start or end point');
            return;
        }
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Enhanced coordinate validation
        if (!this.isValidCoordinate(x1) || !this.isValidCoordinate(y1) || 
            !this.isValidCoordinate(x2) || !this.isValidCoordinate(y2)) {
            console.warn('Invalid trendline coordinates:', {
                x1, y1, x2, y2, 
                startTime: drawing.startPoint.time, 
                endTime: drawing.endPoint.time
            });
            return;
        }
        
        const element = this.createSVGElement('line', {
            x1, y1, x2, y2,
            stroke: drawing.color || this.colors.trendline,
            'stroke-width': drawing.lineWidth || 2,
            'stroke-dasharray': this.getStrokeDashArray(drawing.lineStyle || 0),
            'pointer-events': 'all',
            'cursor': 'move'
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'trendline');
        this.appendToChart(element);
    }

    renderHorizontalLine(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        const y = this.safePriceToCoordinate(priceScale, drawing.price, containerRect.height);
        
        const element = this.createSVGElement('line', {
            x1: 0,
            y1: y,
            x2: '100%',
            y2: y,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth,
            'stroke-dasharray': this.getStrokeDashArray(drawing.lineStyle),
            'pointer-events': 'all',
            'cursor': 'move'
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
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        const x = this.safeTimeToCoordinate(timeScale, drawing.time);
        
        if (!this.isValidCoordinate(x)) {
            console.warn('Invalid vertical line coordinate:', x);
            return;
        }
        
        const element = this.createSVGElement('line', {
            x1: x,
            y1: 0,
            x2: x,
            y2: containerRect.height,
            stroke: drawing.color || this.colors.vertical,
            'stroke-width': drawing.lineWidth || 2,
            'stroke-dasharray': this.getStrokeDashArray(drawing.lineStyle || 0),
            'pointer-events': 'all',
            'cursor': 'move'
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
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        // Enhanced coordinate conversion with validation
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Validate all coordinates before proceeding
        if (!this.isValidCoordinate(x1) || !this.isValidCoordinate(y1) || 
            !this.isValidCoordinate(x2) || !this.isValidCoordinate(y2)) {
            console.warn('Invalid rectangle coordinates:', {x1, y1, x2, y2});
            return;
        }
        
        // Calculate rectangle dimensions with minimum size constraints
        const rectX = Math.min(x1, x2);
        const rectY = Math.min(y1, y2);
        const rectWidth = Math.max(Math.abs(x2 - x1), 2); // Minimum width of 2px
        const rectHeight = Math.max(Math.abs(y2 - y1), 2); // Minimum height of 2px
        
        const element = this.createSVGElement('rect', {
            x: rectX,
            y: rectY,
            width: rectWidth,
            height: rectHeight,
            stroke: drawing.color || this.colors.rectangle,
            fill: drawing.fillColor || 'transparent',
            'stroke-width': drawing.lineWidth || 2,
            'pointer-events': 'all',
            'cursor': 'move',
            opacity: drawing.opacity || 0.8
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'rectangle');
        element.setAttribute('data-start-time', drawing.startPoint.time);
        element.setAttribute('data-end-time', drawing.endPoint.time);
        element.setAttribute('data-start-price', drawing.startPoint.price);
        element.setAttribute('data-end-price', drawing.endPoint.price);
        
        this.appendToChart(element);
    }

    renderFibonacciPreview(drawing) {
        if (!drawing || !drawing.startPoint || !drawing.endPoint) return;
        
        // Much lighter throttling for smooth drawing experience
        const now = Date.now();
        if (this.lastPreviewRender && (now - this.lastPreviewRender) < 16) {
            return; // 60fps = 16ms between frames
        }
        this.lastPreviewRender = now;
        
        this.removeDrawingElement(drawing.id);
        
        const container = this.chartEngine.container;
        let svg = container.querySelector('.drawing-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'drawing-svg');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '1000';
            container.appendChild(svg);
        }
        
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-drawing-id', drawing.id);
        group.setAttribute('class', 'fibonacci-preview');
        
        // Proper coordinate conversion for smooth preview
        try {
            const mainPanel = this.chartEngine.panels.get('main');
            if (mainPanel && mainPanel.chart) {
                const timeScale = mainPanel.chart.timeScale();
                const priceScale = mainPanel.chart.priceScale('right');
                const containerRect = this.chartEngine.container.getBoundingClientRect();
                
                const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
                const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
                const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
                const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
                
                // Only draw if coordinates are valid
                if (this.isValidCoordinate(x1) && this.isValidCoordinate(y1) && 
                    this.isValidCoordinate(x2) && this.isValidCoordinate(y2)) {
                    const line = this.createSVGElement('line', {
                        x1, y1, x2, y2,
                        stroke: '#888',
                        'stroke-width': 1,
                        'stroke-dasharray': '3,3',
                        opacity: 0.6
                    });
                    
                    group.appendChild(line);
                }
            }
        } catch (error) {
            // Skip preview on error - don't add broken elements
            console.warn('Preview rendering failed:', error);
        }
        
        svg.appendChild(group);
    }

    renderAdvancedFibonacci(drawing) {
        this.removeDrawingElement(drawing.id);
        
        if (!drawing.startPoint || !drawing.endPoint) {
            console.warn('Advanced Fibonacci missing start or end point');
            return;
        }
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) {
            console.warn('Main panel not found for Advanced Fibonacci');
            return;
        }
        
        const settings = drawing.settings || this.fibonacciSettings[drawing.fibType || 'retracement'];
        
        // Create group element with proper attributes
        const group = this.createSVGElement('g');
        group.setAttribute('data-drawing-id', drawing.id);
        group.setAttribute('data-drawing-type', 'fibonacci-' + drawing.fibType);
        group.setAttribute('data-fib-type', drawing.fibType);
        group.setAttribute('data-start-time', drawing.startPoint.time);
        group.setAttribute('data-end-time', drawing.endPoint.time);
        group.setAttribute('data-start-price', drawing.startPoint.price);
        group.setAttribute('data-end-price', drawing.endPoint.price);
        group.setAttribute('pointer-events', 'all');
        group.style.cursor = drawing.editMode ? 'crosshair' : 'move';
        
        // Calculate coordinates fresh for current viewport
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Validate coordinates
        if (!this.isValidCoordinate(x1) || !this.isValidCoordinate(y1) || 
            !this.isValidCoordinate(x2) || !this.isValidCoordinate(y2)) {
            console.warn('Invalid advanced fibonacci coordinates:', {
                x1, y1, x2, y2,
                startTime: drawing.startPoint.time,
                endTime: drawing.endPoint.time,
                startPrice: drawing.startPoint.price,
                endPrice: drawing.endPoint.price
            });
            return;
        }
        
        // Render based on Fibonacci type
        switch (drawing.fibType) {
            case 'retracement':
                this.renderFibonacciRetracement(group, drawing, settings, x1, y1, x2, y2, containerRect);
                break;
            case 'extension':
                this.renderFibonacciExtension(group, drawing, settings, x1, y1, x2, y2, containerRect);
                break;
            case 'fan':
                this.renderFibonacciFan(group, drawing, settings, x1, y1, x2, y2, containerRect);
                break;
            case 'arcs':
                this.renderFibonacciArcs(group, drawing, settings, x1, y1, x2, y2, containerRect);
                break;
            case 'timezones':
                this.renderFibonacciTimezones(group, drawing, settings, x1, y1, x2, y2, containerRect);
                break;
            default:
                this.renderFibonacciRetracement(group, drawing, settings, x1, y1, x2, y2, containerRect);
        }
        
        // Add right-click context menu for editing
        group.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showFibonacciContextMenu(e, drawing);
        });
        
        // Add double-click for edit mode
        group.addEventListener('dblclick', (e) => {
            e.preventDefault();
            this.enterFibonacciEditMode(drawing);
        });
        
        console.log(`Advanced Fibonacci (${drawing.fibType}) created with`, group.children.length, 'elements');
        
        // Freeze fibonacci tools to prevent movement during pan/zoom
        if (drawing.type.includes('fibonacci')) {
            this.frozenTools.add(drawing.id);
        }
        
        this.appendToChart(group);
    }

    renderFibonacciRetracement(group, drawing, settings, x1, y1, x2, y2, containerRect) {
        const timeScale = this.chartEngine.panels.get('main').chart.timeScale();
        const priceScale = this.chartEngine.panels.get('main').chart.priceScale('right');
        
        // استفاده از قیمت‌های ثابت ذخیره شده در drawing object
        // این قیمت‌ها نباید تغییر کنند، فقط coordinate هایشان بر اساس zoom/pan به‌روزرسانی می‌شوند
        const currentStartPrice = drawing.startPoint.price;
        const currentEndPrice = drawing.endPoint.price;
        
        // Main trend line
        const trendLine = this.createSVGElement('line', {
            x1, y1, x2, y2,
            stroke: '#8B4513',
            'stroke-width': settings.lineWidth + 1,
            'stroke-dasharray': '8,4',
            opacity: 0.8
        });
        group.appendChild(trendLine);
        
        const customLevels = settings.customLevels || [];
        const levels = [...settings.levels, ...customLevels].sort((a, b) => a - b);
        const priceRange = currentEndPrice - currentStartPrice;
        
        // Calculate extension bounds
        const chartWidth = containerRect.width;
        const leftExtend = settings.extendLeft ? 0 : Math.min(x1, x2) - 20;
        const rightExtend = settings.extendRight ? chartWidth : Math.max(x1, x2) + 20;
        
        // Background zones if enabled
        if (settings.showBackground && settings.backgroundOpacity > 0) {
            for (let i = 0; i < levels.length - 1; i++) {
                const level1 = levels[i];
                const level2 = levels[i + 1];
                const price1 = currentStartPrice + (priceRange * level1);
                const price2 = currentStartPrice + (priceRange * level2);
                const y1_bg = this.safePriceToCoordinate(priceScale, price1, containerRect.height);
                const y2_bg = this.safePriceToCoordinate(priceScale, price2, containerRect.height);
                
                const bgColor = this.fibColors[level1] || this.fibColors[level2] || '#4ECDC4';
                const background = this.createSVGElement('rect', {
                    x: leftExtend,
                    y: Math.min(y1_bg, y2_bg),
                    width: rightExtend - leftExtend,
                    height: Math.abs(y2_bg - y1_bg),
                    fill: bgColor,
                    opacity: settings.backgroundOpacity,
                    'pointer-events': 'none'
                });
                group.appendChild(background);
            }
        }
        
        // Fibonacci levels
        levels.forEach((level, index) => {
            const levelPrice = currentStartPrice + (priceRange * level);
            const levelY = this.safePriceToCoordinate(priceScale, levelPrice, containerRect.height);
            
            // Debug coordinate conversion (only for first fibonacci)
            if (level === 0.5 && drawing.id.endsWith('_o6slpphro')) {
                console.log('Fibonacci level 0.5 debug:', {
                    startPrice: currentStartPrice,
                    endPrice: currentEndPrice,
                    levelPrice: levelPrice,
                    levelY: levelY,
                    containerHeight: containerRect.height,
                    priceRange: priceRange
                });
            }
            
            if (!this.isValidCoordinate(levelY)) return;
            
            const levelColor = this.fibColors[level] || '#4ECDC4';
            const isMainLevel = level === 0 || level === 0.5 || level === 1;
            const lineWidth = isMainLevel ? settings.lineWidth + 1 : settings.lineWidth;
            
            // Level line
            const line = this.createSVGElement('line', {
                x1: leftExtend,
                y1: levelY,
                x2: rightExtend,
                y2: levelY,
                stroke: levelColor,
                'stroke-width': lineWidth,
                'stroke-dasharray': this.getStrokeDashArray(settings.lineStyle),
                opacity: isMainLevel ? 1 : 0.85,
                'data-fib-level': level,
                'pointer-events': 'all',
                cursor: 'ns-resize'
            });
            
            // Add drag functionality for level
            if (settings.dragHandles) {
                line.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.startLevelDrag(drawing, level, e);
                });
            }
            
            group.appendChild(line);
            
            // Drag handle (small circle)
            if (settings.dragHandles && drawing.editMode) {
                const handle = this.createSVGElement('circle', {
                    cx: rightExtend - 10,
                    cy: levelY,
                    r: 4,
                    fill: levelColor,
                    stroke: 'white',
                    'stroke-width': 1,
                    cursor: 'ns-resize',
                    'data-fib-level': level
                });
                group.appendChild(handle);
            }
            
            // Labels and prices
            if (settings.showLabels || settings.showPrices || settings.showPercents) {
                let labelText = '';
                if (settings.showPercents) labelText += `${(level * 100).toFixed(1)}%`;
                if (settings.showPrices && settings.showPercents) labelText += ' ';
                if (settings.showPrices) labelText += `(${levelPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })})`;
                
                if (labelText) {
                    const textWidth = labelText.length * 6 + 10;
                    const textHeight = 16;
                    const textX = rightExtend + 5;
                    const textY = levelY;
                    
                    // Background
                    const textBg = this.createSVGElement('rect', {
                        x: textX,
                        y: textY - 10,
                        width: textWidth,
                        height: textHeight,
                        fill: 'rgba(0,0,0,0.8)',
                        rx: 3,
                        stroke: levelColor,
                        'stroke-width': 0.5
                    });
                    group.appendChild(textBg);
                    
                    // Text
                    const text = this.createSVGElement('text', {
                        x: textX + 5,
                        y: textY + 2,
                        fill: 'white',
                        'font-size': 10,
                        'font-family': 'IRANSans, Arial, sans-serif',
                        'font-weight': isMainLevel ? 'bold' : 'normal'
                    });
                    text.textContent = labelText;
                    group.appendChild(text);
                }
            }
        });
    }

    renderFibonacciExtension(group, drawing, settings, x1, y1, x2, y2, containerRect) {
        // Similar to retracement but levels extend beyond 100%
        // استفاده از قیمت‌های ثابت ذخیره شده در drawing object
        const currentStartPrice = drawing.startPoint.price;
        const currentEndPrice = drawing.endPoint.price;
        
        const customLevels = settings.customLevels || [];
        const levels = [...settings.levels, ...customLevels].sort((a, b) => a - b);
        const priceRange = currentEndPrice - currentStartPrice;
        const chartWidth = containerRect.width;
        
        // Extension lines project beyond the main move
        levels.forEach((level) => {
            const extensionPrice = currentEndPrice + (priceRange * level);
            const extensionY = this.safePriceToCoordinate(
                this.chartEngine.panels.get('main').chart.priceScale('right'), 
                extensionPrice, 
                containerRect.height
            );
            
            if (!this.isValidCoordinate(extensionY)) return;
            
            const levelColor = this.fibColors[level] || '#87CEEB';
            
            const line = this.createSVGElement('line', {
                x1: settings.extendLeft ? 0 : Math.min(x1, x2),
                y1: extensionY,
                x2: settings.extendRight ? chartWidth : Math.max(x1, x2),
                y2: extensionY,
                stroke: levelColor,
                'stroke-width': settings.lineWidth,
                'stroke-dasharray': level === 1 ? 'none' : '4,2',
                opacity: 0.8
            });
            group.appendChild(line);
            
            // Labels
            if (settings.showLabels) {
                const labelText = `${(level * 100).toFixed(1)}% (${extensionPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })})`;
                const text = this.createSVGElement('text', {
                    x: Math.max(x1, x2) + 10,
                    y: extensionY - 5,
                    fill: levelColor,
                    'font-size': 9,
                    'font-family': 'IRANSans, Arial, sans-serif'
                });
                text.textContent = labelText;
                group.appendChild(text);
            }
        });
    }

    renderFibonacciFan(group, drawing, settings, x1, y1, x2, y2, containerRect) {
        // Fan lines from start point at fibonacci angles
        const customLevels = settings.customLevels || [];
        const levels = [...settings.levels, ...customLevels];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        levels.forEach((level) => {
            const angle = Math.atan2(dy * level, dx);
            const fanLength = Math.min(containerRect.width, containerRect.height);
            const fanX = x1 + Math.cos(angle) * fanLength;
            const fanY = y1 + Math.sin(angle) * fanLength;
            
            const levelColor = this.fibColors[level] || '#DDA0DD';
            
            const fanLine = this.createSVGElement('line', {
                x1, y1,
                x2: fanX,
                y2: fanY,
                stroke: levelColor,
                'stroke-width': settings.lineWidth,
                'stroke-dasharray': '3,3',
                opacity: 0.7
            });
            group.appendChild(fanLine);
            
            // Label at end of fan line
            if (settings.showLabels) {
                const text = this.createSVGElement('text', {
                    x: fanX,
                    y: fanY,
                    fill: levelColor,
                    'font-size': 9,
                    'font-family': 'IRANSans, Arial, sans-serif'
                });
                text.textContent = `${(level * 100).toFixed(1)}%`;
                group.appendChild(text);
            }
        });
    }

    renderFibonacciArcs(group, drawing, settings, x1, y1, x2, y2, containerRect) {
        // Arcs centered on start point with fibonacci radii
        const customLevels = settings.customLevels || [];
        const levels = [...settings.levels, ...customLevels];
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        
        levels.forEach((level) => {
            const radius = distance * level;
            const levelColor = this.fibColors[level] || '#FF8A80';
            
            const arc = this.createSVGElement('circle', {
                cx: x1,
                cy: y1,
                r: radius,
                stroke: levelColor,
                'stroke-width': settings.lineWidth,
                fill: 'none',
                'stroke-dasharray': '2,2',
                opacity: 0.6
            });
            group.appendChild(arc);
            
            if (settings.showLabels) {
                const text = this.createSVGElement('text', {
                    x: x1 + radius * 0.7,
                    y: y1 - radius * 0.7,
                    fill: levelColor,
                    'font-size': 9,
                    'font-family': 'IRANSans, Arial, sans-serif'
                });
                text.textContent = `${(level * 100).toFixed(1)}%`;
                group.appendChild(text);
            }
        });
    }

    renderFibonacciTimezones(group, drawing, settings, x1, y1, x2, y2, containerRect) {
        // Vertical lines at fibonacci time intervals
        const sequence = settings.sequence || [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
        const timeScale = this.chartEngine.panels.get('main').chart.timeScale();
        const baseTimeInterval = Math.abs(drawing.endPoint.time - drawing.startPoint.time);
        
        // Ensure we have a valid base interval
        if (!baseTimeInterval || baseTimeInterval <= 0) {
            console.warn('Invalid base time interval for Fibonacci timezones');
            return;
        }
        
        // Get visible time range for boundary checking
        const visibleRange = timeScale.getVisibleRange();
        
        sequence.forEach((fibNumber, index) => {
            if (fibNumber === 0) return; // Skip zero
            
            const timeOffset = baseTimeInterval * fibNumber;
            const lineTime = drawing.startPoint.time + (drawing.endPoint.time > drawing.startPoint.time ? timeOffset : -timeOffset);
            
            // Skip if outside reasonable bounds
            if (visibleRange && (lineTime > visibleRange.to || lineTime < visibleRange.from)) {
                return;
            }
            
            const lineX = this.safeTimeToCoordinate(timeScale, lineTime);
            
            if (!this.isValidCoordinate(lineX) || lineX < 0 || lineX > containerRect.width + 50) return;
            
            const line = this.createSVGElement('line', {
                x1: lineX,
                y1: 0,
                x2: lineX,
                y2: containerRect.height,
                stroke: drawing.color || '#A8E6CF',
                'stroke-width': settings.lineWidth || 1,
                'stroke-dasharray': '3,2',
                opacity: 0.7
            });
            group.appendChild(line);
            
            if (settings.showLabels) {
                const text = this.createSVGElement('text', {
                    x: lineX + 3,
                    y: 20,
                    fill: drawing.color || '#2E7D32',
                    'font-weight': 'bold',
                    'font-size': 9,
                    'font-family': 'IRANSans, Arial, sans-serif',
                    transform: `rotate(-90, ${lineX + 5}, 20)`
                });
                text.textContent = `F${fibNumber}`;
                group.appendChild(text);
            }
        });
    }

    // Legacy method for backward compatibility
    renderFibonacci(drawing) {
        // Ensure drawing has all required properties
        if (!drawing.startPoint || !drawing.endPoint) {
            console.warn('Fibonacci drawing missing start or end point:', drawing);
            return;
        }
        
        if (drawing.type && drawing.type.startsWith('fibonacci-')) {
            this.renderAdvancedFibonacci(drawing);
        } else {
            // Convert legacy fibonacci to advanced retracement
            drawing.fibType = drawing.fibType || 'retracement';
            drawing.settings = drawing.settings || this.fibonacciSettings[drawing.fibType] || this.fibonacciSettings.retracement;
            drawing.type = 'fibonacci-' + drawing.fibType;
            this.renderAdvancedFibonacci(drawing);
        }
    }

    renderText(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x = this.safeTimeToCoordinate(timeScale, drawing.point.time);
        const y = this.safePriceToCoordinate(priceScale, drawing.point.price, containerRect.height);
        
        const element = this.createSVGElement('text', {
            x,
            y,
            fill: drawing.color,
            'font-size': drawing.fontSize,
            'font-family': drawing.fontFamily,
            'pointer-events': 'all',
            'cursor': 'move'
        });
        element.textContent = drawing.text;
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'text');
        
        this.appendToChart(element);
    }

    // Helper methods
    createSVGLine(startPoint, endPoint, color, lineWidth, lineStyle) {
        try {
            const mainPanel = this.chartEngine.panels.get('main');
            if (!mainPanel) return this.createSVGElement('line');
            
            const timeScale = mainPanel.chart.timeScale();
            const priceScale = mainPanel.chart.priceScale('right');
            
            // Use safe coordinate conversion with fallbacks
            let x1, y1, x2, y2;
            
            const containerRect = this.chartEngine.container.getBoundingClientRect();
            
            x1 = this.safeTimeToCoordinate(timeScale, startPoint.time) || startPoint.x || 0;
            y1 = this.safePriceToCoordinate(priceScale, startPoint.price, containerRect.height) || startPoint.y || 0;
            x2 = this.safeTimeToCoordinate(timeScale, endPoint.time) || endPoint.x || 100;
            y2 = this.safePriceToCoordinate(priceScale, endPoint.price, containerRect.height) || endPoint.y || 100;
            
            // Ensure all values are valid numbers
            x1 = isNaN(x1) || x1 === null || x1 === undefined ? 0 : Number(x1);
            y1 = isNaN(y1) || y1 === null || y1 === undefined ? 0 : Number(y1);
            x2 = isNaN(x2) || x2 === null || x2 === undefined ? 100 : Number(x2);
            y2 = isNaN(y2) || y2 === null || y2 === undefined ? 100 : Number(y2);
            
            return this.createSVGElement('line', {
                x1, y1, x2, y2,
                stroke: color,
                'stroke-width': lineWidth,
                'stroke-dasharray': this.getStrokeDashArray(lineStyle),
                'pointer-events': 'all',
                'cursor': 'move'
            });
        } catch (error) {
            console.warn('Error creating SVG line:', error);
            return this.createSVGElement('line', {
                x1: 0, y1: 0, x2: 100, y2: 100,
                stroke: color || '#2196F3',
                'stroke-width': lineWidth || 2,
                'pointer-events': 'all',
                'cursor': 'move'
            });
        }
    }

    createSVGElement(tagName, attributes = {}) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        Object.entries(attributes).forEach(([key, value]) => {
            // Validate attribute values to prevent SVG errors
            if (value !== null && value !== undefined && !isNaN(value) && value !== '') {
                element.setAttribute(key, value);
            } else if (typeof value === 'string' && value.length > 0) {
                element.setAttribute(key, value);
            } else {
                console.warn(`Invalid SVG attribute: ${key} = ${value}`);
            }
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
            // Create SVG overlay with proper positioning
            svg = this.createSVGElement('svg', {
                class: 'drawing-overlay'
            });
            
            // Set up proper positioning and size that sticks to chart
            const containerRect = this.chartEngine.container.getBoundingClientRect();
            svg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
                overflow: visible;
            `;
            
            // Ensure SVG viewport matches container for proper coordinate mapping
            svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
            svg.setAttribute('preserveAspectRatio', 'none');
            
            // Make sure it's positioned relative to chart container
            if (this.chartEngine.container.style.position !== 'relative' && 
                this.chartEngine.container.style.position !== 'absolute') {
                this.chartEngine.container.style.position = 'relative';
            }
            
            this.chartEngine.container.appendChild(svg);
            console.log('Created drawing overlay SVG');
        }
        
        // Update SVG viewBox to match current container size for proper scaling
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
        
        // Ensure element allows pointer events if it's interactive
        if (element.hasAttribute('data-drawing-id')) {
            element.style.pointerEvents = 'all';
        }
        
        svg.appendChild(element);
        console.log('Added element to drawing overlay:', element.tagName, element.getAttribute('data-drawing-id'));
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
        if (this.selectedDrawing) {
            this.deleteTool(this.selectedDrawing);
            this.selectedDrawing = null;
            console.log('Deleted selected drawing');
        } else {
            console.log('No drawing selected to delete');
        }
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

    // Persistence with symbol-specific storage
    saveToStorage() {
        // Get current symbol from chart
        const symbol = this.getCurrentSymbol();
        if (!symbol) {
            console.warn('No symbol available for saving drawings');
            return;
        }
        
        const data = {
            tools: Array.from(this.tools.entries()),
            colors: this.colors,
            settings: {
                snapToPrice: this.snapToPrice,
                snapToTime: this.snapToTime
            },
            symbol: symbol,
            timestamp: Date.now()
        };
        
        // Save with symbol-specific key
        const storageKey = this.getStorageKey(symbol);
        localStorage.setItem(storageKey, JSON.stringify(data));
        console.log(`Saved ${this.tools.size} drawings for symbol ${symbol}`);
    }

    loadFromStorage() {
        try {
            // Get current symbol from chart
            const symbol = this.getCurrentSymbol();
            if (!symbol) {
                console.warn('No symbol available for loading drawings');
                return;
            }
            
            const storageKey = this.getStorageKey(symbol);
            const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
            
            // Only load if data exists and matches current symbol
            if (data.symbol === symbol && data.tools) {
                this.tools = new Map(data.tools);
                console.log(`Loaded ${this.tools.size} drawings for symbol ${symbol}`);
            } else {
                this.tools = new Map();
                console.log(`No saved drawings found for symbol ${symbol}`);
            }
            
            if (data.colors) {
                this.colors = { ...this.colors, ...data.colors };
            }
            
            if (data.settings) {
                this.snapToPrice = data.settings.snapToPrice ?? true;
                this.snapToTime = data.settings.snapToTime ?? true;
            }
            
            // Initial history state and render
            this.addToHistory();
            this.renderAll();
            
        } catch (error) {
            console.error('Error loading drawings from storage:', error);
            this.tools = new Map();
        }
    }
    
    // Helper to get current symbol from chart
    getCurrentSymbol() {
        // Try to get symbol from chart engine
        if (this.chartEngine && this.chartEngine.currentSymbol) {
            return this.chartEngine.currentSymbol;
        }
        
        // Try to get from drawing tools instance
        if (this.currentSymbol) {
            return this.currentSymbol;
        }
        
        // Try to get from URL or page context
        const urlParams = new URLSearchParams(window.location.search);
        const symbolFromUrl = urlParams.get('symbol');
        if (symbolFromUrl) {
            return symbolFromUrl;
        }
        
        // Try to get from page title or other elements
        const titleElement = document.querySelector('.symbol-title, .stock-symbol, [data-symbol]');
        if (titleElement) {
            return titleElement.textContent || titleElement.dataset.symbol;
        }
        
        // Default fallback - use a consistent default
        return 'default';
    }
    
    // تولید کلید storage با context کامل
    getStorageKey(symbol = null) {
        const sym = symbol || this.currentSymbol || 'default';
        const tf = this.currentTimeframe || '1D';
        const dt = this.currentDataType || 'unadjusted';
        return `chart_drawings_${sym}_${tf}_${dt}`;
    }
    
    // Set current symbol
    setSymbol(symbol) {
        if (symbol && symbol !== this.currentSymbol) {
            console.log(`DrawingTools: Symbol changed from ${this.currentSymbol} to ${symbol}`);
            
            // ذخیره drawings فعلی قبل از تغییر
            this.saveToStorage();
            
            this.currentSymbol = symbol;
            // Clear current drawings and load new ones for this symbol
            this.tools.clear();
            this.loadFromStorage();
        }
    }
    
    // Set current timeframe
    setTimeframe(timeframe) {
        if (timeframe && timeframe !== this.currentTimeframe) {
            console.log(`DrawingTools: Timeframe changed from ${this.currentTimeframe} to ${timeframe}`);
            
            // ذخیره drawings فعلی قبل از تغییر
            this.saveToStorage();
            
            this.currentTimeframe = timeframe;
            // Clear current drawings and load new ones for this timeframe
            this.tools.clear();
            this.loadFromStorage();
        }
    }
    
    // Set current data type (adjusted/unadjusted)
    setDataType(dataType) {
        if (dataType && dataType !== this.currentDataType) {
            console.log(`DrawingTools: DataType changed from ${this.currentDataType} to ${dataType}`);
            
            // ذخیره drawings فعلی قبل از تغییر
            this.saveToStorage();
            
            this.currentDataType = dataType;
            // Clear current drawings and load new ones for this data type
            this.tools.clear();
            this.loadFromStorage();
        }
    }
    
    // دریافت context کامل
    getCurrentContext() {
        return {
            symbol: this.currentSymbol,
            timeframe: this.currentTimeframe,
            dataType: this.currentDataType,
            storageKey: this.getStorageKey()
        };
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

    // Selection and interaction methods
    getElementAtPoint(x, y) {
        const elements = document.elementsFromPoint(x + this.chartEngine.container.getBoundingClientRect().left, 
                                                   y + this.chartEngine.container.getBoundingClientRect().top);
        return elements.find(el => el.hasAttribute('data-drawing-id'));
    }

    selectDrawing(drawingId) {
        this.clearSelection();
        this.selectedDrawing = drawingId;
        const elements = this.chartEngine.container.querySelectorAll(`[data-drawing-id="${drawingId}"]`);
        elements.forEach(element => {
            element.classList.add('drawing-selected');
            element.style.filter = 'drop-shadow(0 0 8px #1976d2)';
            element.style.strokeWidth = (parseFloat(element.style.strokeWidth || '2') + 1) + 'px';
        });
    }

    clearSelection() {
        if (this.selectedDrawing) {
            const elements = this.chartEngine.container.querySelectorAll(`[data-drawing-id="${this.selectedDrawing}"]`);
            elements.forEach(element => {
                element.classList.remove('drawing-selected');
                element.style.filter = 'none';
                element.style.strokeWidth = (parseFloat(element.style.strokeWidth) - 1) + 'px';
            });
            this.selectedDrawing = null;
        }
    }

    moveSelectedDrawing(currentPoint) {
        if (!this.selectedDrawing || !this.dragStartPoint) return;

        const drawing = this.tools.get(this.selectedDrawing);
        if (!drawing) return;

        const deltaX = currentPoint.x - this.dragStartPoint.x;
        const deltaY = currentPoint.y - this.dragStartPoint.y;
        const deltaTime = currentPoint.time - this.dragStartPoint.time;
        const deltaPrice = currentPoint.price - this.dragStartPoint.price;

        // Update drawing data
        if (drawing.startPoint) {
            drawing.startPoint.time += deltaTime;
            drawing.startPoint.price += deltaPrice;
            drawing.startPoint.x += deltaX;
            drawing.startPoint.y += deltaY;
        }
        
        if (drawing.endPoint) {
            drawing.endPoint.time += deltaTime;
            drawing.endPoint.price += deltaPrice;
            drawing.endPoint.x += deltaX;
            drawing.endPoint.y += deltaY;
        }

        if (drawing.point) {
            drawing.point.time += deltaTime;
            drawing.point.price += deltaPrice;
            drawing.point.x += deltaX;
            drawing.point.y += deltaY;
        }

        // Update the visual representation
        this.renderDrawing(drawing);
        
        // Update drag start point
        this.dragStartPoint = currentPoint;
    }

    deleteSelected() {
        if (this.selectedDrawing) {
            this.deleteTool(this.selectedDrawing);
            this.selectedDrawing = null;
        }
    }

    selectAll() {
        // For now, just select the first drawing - could be expanded to multi-select
        const firstDrawingId = this.tools.keys().next().value;
        if (firstDrawingId) {
            this.selectDrawing(firstDrawingId);
        }
    }

    renderDrawing(drawing) {
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
            case 'ellipse':
                this.renderEllipse(drawing);
                break;
            case 'triangle':
                this.renderTriangle(drawing);
                break;
            case 'ray':
                this.renderRay(drawing);
                break;
            case 'line':
                this.renderLineExtended(drawing);
                break;
            case 'segment':
                this.renderSegment(drawing);
                break;
            case 'parallel':
                this.renderParallelChannel(drawing);
                break;
            case 'fibonacci':
                this.renderFibonacci(drawing);
                break;
            case 'fibextension':
                this.renderFibExtension(drawing);
                break;
            case 'text':
                this.renderText(drawing);
                break;
            case 'arrow':
                this.renderArrow(drawing);
                break;
            case 'pitchfork':
                this.renderPitchfork(drawing);
                break;
            case 'gann':
                this.renderGannFan(drawing);
                break;
            default:
                console.log(`Rendering ${drawing.type} drawing`);
        }
    }

    // Additional drawing tool implementations
    startTriangle(startPoint) {
        const id = this.generateId('triangle');
        this.currentDrawing = {
            id,
            type: 'triangle',
            startPoint,
            endPoint: startPoint,
            color: this.colors.rectangle || '#9C27B0',
            lineWidth: 2,
            fillColor: 'transparent'
        };
        this.renderTriangle(this.currentDrawing);
    }

    renderTriangle(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Validate coordinates before proceeding
        if (!this.isValidCoordinate(x1) || !this.isValidCoordinate(y1) || 
            !this.isValidCoordinate(x2) || !this.isValidCoordinate(y2)) {
            console.warn('Invalid triangle coordinates:', {x1, y1, x2, y2});
            return;
        }
        
        const x3 = x1;
        const y3 = y2;
        
        const points = [[x1, y1], [x2, y2], [x3, y3]].map(p => p.join(',')).join(' ');
        
        const element = this.createSVGElement('polygon', {
            points,
            stroke: drawing.color,
            fill: drawing.fillColor || 'transparent',
            'stroke-width': drawing.lineWidth,
            'pointer-events': 'all',
            'cursor': 'move'
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'triangle');
        this.appendToChart(element);
    }

    startRay(startPoint) {
        const id = this.generateId('ray');
        this.currentDrawing = {
            id,
            type: 'ray',
            startPoint,
            endPoint: startPoint,
            color: this.colors.trendline,
            lineWidth: 2,
            lineStyle: 0
        };
        this.renderRay(this.currentDrawing);
    }

    startLine(startPoint) {
        const id = this.generateId('line');
        this.currentDrawing = {
            id,
            type: 'line',
            startPoint: { ...startPoint },
            endPoint: { ...startPoint },
            color: this.colors.line || this.colors.trendline,
            lineWidth: 2,
            lineStyle: 0
        };
        this.renderLineExtended(this.currentDrawing);
    }

    startSegment(startPoint) {
        const id = this.generateId('segment');
        this.currentDrawing = {
            id,
            type: 'segment',
            startPoint: { ...startPoint },
            endPoint: { ...startPoint },
            color: this.colors.segment || this.colors.trendline,
            lineWidth: 2,
            lineStyle: 0
        };
        this.renderSegment(this.currentDrawing);
    }

    renderRay(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Extend the line to the edge of the chart
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
            const extendedLength = 2000; // Extend beyond chart bounds
            const extendedX = x1 + (dx / length) * extendedLength;
            const extendedY = y1 + (dy / length) * extendedLength;
            
            const element = this.createSVGLine(
                { x: x1, y: y1, time: drawing.startPoint.time, price: drawing.startPoint.price },
                { x: extendedX, y: extendedY, time: drawing.endPoint.time, price: drawing.endPoint.price },
                drawing.color,
                drawing.lineWidth,
                drawing.lineStyle
            );
            
            element.setAttribute('data-drawing-id', drawing.id);
            element.setAttribute('data-drawing-type', 'ray');
            this.appendToChart(element);
        }
    }

    renderLineExtended(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Extend the line to both sides infinitely
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
            const extendedLength = 3000; // Very long extension for infinite line
            const unitX = dx / length;
            const unitY = dy / length;
            
            // Extend both directions
            const startX = x1 - (unitX * extendedLength);
            const startY = y1 - (unitY * extendedLength);
            const endX = x1 + (unitX * extendedLength);
            const endY = y1 + (unitY * extendedLength);
            
            const element = this.createSVGElement('line', {
                x1: startX,
                y1: startY,
                x2: endX,
                y2: endY,
                stroke: drawing.color,
                'stroke-width': drawing.lineWidth,
                'stroke-dasharray': this.getStrokeDashArray(drawing.lineStyle),
                'pointer-events': 'all',
                'cursor': 'move'
            });
            
            element.setAttribute('data-drawing-id', drawing.id);
            element.setAttribute('data-drawing-type', 'line');
            element.setAttribute('data-start-time', drawing.startPoint.time);
            element.setAttribute('data-end-time', drawing.endPoint.time);
            element.setAttribute('data-start-price', drawing.startPoint.price);
            element.setAttribute('data-end-price', drawing.endPoint.price);
            
            this.appendToChart(element);
        }
    }

    renderSegment(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Simple segment - just draw between two points without extension
        const element = this.createSVGElement('line', {
            x1,
            y1,
            x2,
            y2,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth,
            'stroke-dasharray': this.getStrokeDashArray(drawing.lineStyle),
            'pointer-events': 'all',
            'cursor': 'move'
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'segment');
        element.setAttribute('data-start-time', drawing.startPoint.time);
        element.setAttribute('data-end-time', drawing.endPoint.time);
        element.setAttribute('data-start-price', drawing.startPoint.price);
        element.setAttribute('data-end-price', drawing.endPoint.price);
        
        this.appendToChart(element);
    }

    startParallelChannel(startPoint) {
        const id = this.generateId('parallel');
        this.currentDrawing = {
            id,
            type: 'parallel',
            startPoint,
            endPoint: startPoint,
            color: this.colors.trendline,
            lineWidth: 2,
            lineStyle: 0,
            distance: 0
        };
        this.renderParallelChannel(this.currentDrawing);
    }

    renderParallelChannel(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        const group = this.createSVGElement('g');
        group.setAttribute('data-drawing-id', drawing.id);
        group.setAttribute('data-drawing-type', 'parallel');
        group.setAttribute('pointer-events', 'all');
        group.style.cursor = 'move';
        
        // Main line
        const mainLine = this.createSVGElement('line', {
            x1, y1, x2, y2,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth
        });
        group.appendChild(mainLine);
        
        // Parallel line (offset by distance)
        const distance = drawing.distance || 50;
        const parallelLine = this.createSVGElement('line', {
            x1, y1: y1 + distance, x2, y2: y2 + distance,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth,
            'stroke-dasharray': '5,5'
        });
        group.appendChild(parallelLine);
        
        this.appendToChart(group);
    }

    startFibExtension(startPoint) {
        const id = this.generateId('fibextension');
        this.currentDrawing = {
            id,
            type: 'fibextension',
            startPoint,
            endPoint: startPoint,
            color: this.colors.fibonacci,
            lineWidth: 1,
            levels: [0, 0.618, 1, 1.618, 2.618]
        };
        this.renderFibExtension(this.currentDrawing);
    }

    renderFibExtension(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        const group = this.createSVGElement('g');
        group.setAttribute('data-drawing-id', drawing.id);
        group.setAttribute('data-drawing-type', 'fibextension');
        group.setAttribute('pointer-events', 'all');
        group.style.cursor = 'move';
        
        // Main trend line
        const trendLine = this.createSVGElement('line', {
            x1, y1, x2, y2,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth
        });
        group.appendChild(trendLine);
        
        // Extension levels
        const priceRange = drawing.endPoint.price - drawing.startPoint.price;
        drawing.levels.forEach(level => {
            const levelPrice = drawing.endPoint.price + (priceRange * level);
            const levelY = this.safePriceToCoordinate(priceScale, levelPrice, containerRect.height);
            
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
            text.textContent = `${level} (${levelPrice.toFixed(0)})`;
            group.appendChild(text);
        });
        
        this.appendToChart(group);
    }

    startEllipse(startPoint) {
        const id = this.generateId('ellipse');
        this.currentDrawing = {
            id,
            type: 'ellipse',
            startPoint,
            endPoint: startPoint,
            color: this.colors.rectangle || '#9C27B0',
            lineWidth: 2,
            fillColor: 'transparent'
        };
        this.renderEllipse(this.currentDrawing);
    }

    renderEllipse(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Validate coordinates before proceeding
        if (!this.isValidCoordinate(x1) || !this.isValidCoordinate(y1) || 
            !this.isValidCoordinate(x2) || !this.isValidCoordinate(y2)) {
            console.warn('Invalid ellipse coordinates:', {x1, y1, x2, y2});
            return;
        }
        
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        
        const element = this.createSVGElement('ellipse', {
            cx,
            cy,
            rx,
            ry,
            stroke: drawing.color,
            fill: drawing.fillColor || 'transparent',
            'stroke-width': drawing.lineWidth,
            'pointer-events': 'all',
            'cursor': 'move'
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'ellipse');
        this.appendToChart(element);
    }

    addArrow(point) {
        const id = this.generateId('arrow');
        const drawing = {
            id,
            type: 'arrow',
            point,
            color: this.colors.text || '#607D8B',
            size: 20
        };
        
        this.tools.set(id, drawing);
        this.renderArrow(drawing);
        this.addToHistory();
        this.saveToStorage();
        
        this.activeTool = null;
        this.updateCursor();
    }

    renderArrow(drawing) {
        this.removeDrawingElement(drawing.id);
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x = this.safeTimeToCoordinate(timeScale, drawing.point.time);
        const y = this.safePriceToCoordinate(priceScale, drawing.point.price, containerRect.height);
        
        const size = drawing.size || 20;
        const points = [
            [x, y - size/2],
            [x + size, y],
            [x, y + size/2],
            [x + size/3, y]
        ].map(p => p.join(',')).join(' ');
        
        const element = this.createSVGElement('polygon', {
            points,
            fill: drawing.color,
            stroke: drawing.color,
            'stroke-width': 1,
            'pointer-events': 'all',
            'cursor': 'move'
        });
        
        element.setAttribute('data-drawing-id', drawing.id);
        element.setAttribute('data-drawing-type', 'arrow');
        this.appendToChart(element);
    }

    // Advanced drawing tools
    startPitchfork(startPoint) {
        if (!startPoint || !startPoint.time || !startPoint.price) {
            console.warn('Invalid startPoint for pitchfork:', startPoint);
            return;
        }
        
        const id = this.generateId('pitchfork');
        this.currentDrawing = {
            id,
            type: 'pitchfork',
            startPoint: { ...startPoint },
            endPoint: { ...startPoint },
            midPoint: null, // Will be calculated
            color: this.colors.trendline || '#2196F3',
            lineWidth: 2,
            clickCount: 1 // Track number of clicks for 3-point drawing
        };
        
        console.log('Starting pitchfork - click 1/3:', this.currentDrawing);
        this.renderPitchfork(this.currentDrawing);
    }

    renderPitchfork(drawing) {
        this.removeDrawingElement(drawing.id);
        
        if (!drawing.startPoint || !drawing.endPoint) {
            console.warn('Pitchfork missing start or end point');
            return;
        }
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        const x2 = this.safeTimeToCoordinate(timeScale, drawing.endPoint.time);
        const y2 = this.safePriceToCoordinate(priceScale, drawing.endPoint.price, containerRect.height);
        
        // Validate coordinates
        if (!this.isValidCoordinate(x1) || !this.isValidCoordinate(y1) || 
            !this.isValidCoordinate(x2) || !this.isValidCoordinate(y2)) {
            console.warn('Invalid pitchfork coordinates');
            return;
        }
        
        const group = this.createSVGElement('g');
        group.setAttribute('data-drawing-id', drawing.id);
        group.setAttribute('data-drawing-type', 'pitchfork');
        group.setAttribute('pointer-events', 'all');
        group.style.cursor = 'move';
        
        // Main handle line (from start to end)
        const handleLine = this.createSVGElement('line', {
            x1, y1, x2, y2,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth,
            'stroke-dasharray': '5,5'
        });
        group.appendChild(handleLine);
        
        // Calculate middle point for pitchfork center line
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // Center line (median line) - extends beyond the handle
        const centerExtensionLength = 200;
        const centerEndX = midX + centerExtensionLength;
        const centerEndY = midY;
        
        const centerLine = this.createSVGElement('line', {
            x1: midX,
            y1: midY,
            x2: centerEndX,
            y2: centerEndY,
            stroke: drawing.color,
            'stroke-width': drawing.lineWidth
        });
        group.appendChild(centerLine);
        
        // Upper and lower parallel lines
        const lineHeight = Math.abs(y2 - y1);
        const parallelOffset = lineHeight / 2;
        
        // Upper parallel line
        const upperLine = this.createSVGElement('line', {
            x1: midX,
            y1: midY - parallelOffset,
            x2: centerEndX,
            y2: centerEndY - parallelOffset,
            stroke: drawing.color,
            'stroke-width': 1,
            'stroke-dasharray': '3,3',
            opacity: 0.8
        });
        group.appendChild(upperLine);
        
        // Lower parallel line
        const lowerLine = this.createSVGElement('line', {
            x1: midX,
            y1: midY + parallelOffset,
            x2: centerEndX,
            y2: centerEndY + parallelOffset,
            stroke: drawing.color,
            'stroke-width': 1,
            'stroke-dasharray': '3,3',
            opacity: 0.8
        });
        group.appendChild(lowerLine);
        
        this.appendToChart(group);
    }

    startGannFan(startPoint) {
        if (!startPoint || !startPoint.time || !startPoint.price) {
            console.warn('Invalid startPoint for gann fan:', startPoint);
            return;
        }
        
        const id = this.generateId('gann');
        this.currentDrawing = {
            id,
            type: 'gann',
            startPoint: { ...startPoint },
            endPoint: { ...startPoint },
            color: this.colors.trendline || '#2196F3',
            lineWidth: 1,
            angles: [15, 26.25, 33.75, 45, 56.25, 63.75, 75] // Gann angles in degrees
        };
        
        console.log('Starting Gann Fan:', this.currentDrawing);
        this.renderGannFan(this.currentDrawing);
    }

    renderGannFan(drawing) {
        this.removeDrawingElement(drawing.id);
        
        if (!drawing.startPoint || !drawing.endPoint) {
            console.warn('Gann Fan missing start or end point');
            return;
        }
        
        const mainPanel = this.chartEngine.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const priceScale = mainPanel.chart.priceScale('right');
        const containerRect = this.chartEngine.container.getBoundingClientRect();
        
        const x1 = this.safeTimeToCoordinate(timeScale, drawing.startPoint.time);
        const y1 = this.safePriceToCoordinate(priceScale, drawing.startPoint.price, containerRect.height);
        
        if (!this.isValidCoordinate(x1) || !this.isValidCoordinate(y1)) {
            console.warn('Invalid Gann Fan coordinates');
            return;
        }
        
        const group = this.createSVGElement('g');
        group.setAttribute('data-drawing-id', drawing.id);
        group.setAttribute('data-drawing-type', 'gann');
        group.setAttribute('pointer-events', 'all');
        group.style.cursor = 'move';
        
        // Draw fan lines at various Gann angles
        drawing.angles.forEach((angle, index) => {
            const radians = (angle * Math.PI) / 180;
            const length = 300; // Line length
            
            // Calculate end points for upward lines
            const x2Up = x1 + length * Math.cos(radians);
            const y2Up = y1 - length * Math.sin(radians);
            
            // Calculate end points for downward lines
            const x2Down = x1 + length * Math.cos(-radians);
            const y2Down = y1 - length * Math.sin(-radians);
            
            // Upward fan line
            const upLine = this.createSVGElement('line', {
                x1, y1,
                x2: x2Up,
                y2: y2Up,
                stroke: drawing.color,
                'stroke-width': angle === 45 ? 2 : 1, // Main 45° line is thicker
                'stroke-dasharray': angle === 45 ? 'none' : '2,2',
                opacity: angle === 45 ? 1 : 0.7
            });
            group.appendChild(upLine);
            
            // Downward fan line
            const downLine = this.createSVGElement('line', {
                x1, y1,
                x2: x2Down,
                y2: y2Down,
                stroke: drawing.color,
                'stroke-width': angle === 45 ? 2 : 1,
                'stroke-dasharray': angle === 45 ? 'none' : '2,2',
                opacity: angle === 45 ? 1 : 0.7
            });
            group.appendChild(downLine);
        });
        
        this.appendToChart(group);
    }

    // Fibonacci interaction methods
    startLevelDrag(drawing, level, event) {
        event.stopPropagation();
        console.log(`Starting drag for Fibonacci level ${level}:`, drawing.id);
        
        this.levelDragMode = true;
        this.selectedLevel = level;
        this.selectedDrawing = drawing.id;
        this.dragStartPoint = this.getChartPoint(event);
        
        // Visual feedback
        const drawing_element = this.chartEngine.container.querySelector(`[data-drawing-id="${drawing.id}"]`);
        if (drawing_element) {
            drawing_element.style.filter = 'drop-shadow(0 0 8px #FFD700)';
        }
        
        // Temporary drag handlers
        const handleMouseMove = (e) => {
            if (this.levelDragMode) {
                this.updateLevelDrag(drawing, level, e);
            }
        };
        
        const handleMouseUp = (e) => {
            this.endLevelDrag(drawing, level, e);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    updateLevelDrag(drawing, level, event) {
        const currentPoint = this.getChartPoint(event);
        const priceDelta = currentPoint.price - this.dragStartPoint.price;
        
        // Update the level value based on price movement
        const priceRange = drawing.endPoint.price - drawing.startPoint.price;
        const levelDelta = priceDelta / priceRange;
        const newLevel = Math.max(0, Math.min(5, level + levelDelta)); // Limit reasonable range
        
        // Update in drawing settings
        if (drawing.settings && drawing.settings.levels) {
            const levelIndex = drawing.settings.levels.indexOf(level);
            if (levelIndex !== -1) {
                drawing.settings.levels[levelIndex] = newLevel;
                drawing.levels = [...drawing.settings.levels];
            }
        }
        
        // Re-render with updated level
        this.renderAdvancedFibonacci(drawing);
    }
    
    endLevelDrag(drawing, level, event) {
        console.log(`Ended drag for Fibonacci level ${level}`);
        this.levelDragMode = false;
        this.selectedLevel = null;
        this.dragStartPoint = null;
        
        // Remove visual feedback
        const drawing_element = this.chartEngine.container.querySelector(`[data-drawing-id="${drawing.id}"]`);
        if (drawing_element) {
            drawing_element.style.filter = 'none';
        }
        
        // Save changes
        this.tools.set(drawing.id, drawing);
        this.addToHistory();
        this.saveToStorage();
    }
    
    showFibonacciContextMenu(event, drawing) {
        event.preventDefault();
        console.log('Showing Fibonacci context menu for:', drawing.id);
        
        // Remove existing menu
        const existingMenu = document.querySelector('.fib-context-menu');
        if (existingMenu) existingMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'fib-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            background: #2d3748;
            border: 1px solid #4a5568;
            border-radius: 8px;
            padding: 8px 0;
            min-width: 180px;
            z-index: 10000;
            color: white;
            font-family: IRANSans, Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        `;
        
        const menuItems = [
            { text: '⚙️ Settings', action: () => this.openFibonacciSettings(drawing) },
            { text: '🎨 Edit Colors', action: () => this.openColorEditor(drawing) },
            { text: '✏️ Edit Mode', action: () => this.enterFibonacciEditMode(drawing) },
            { text: '📋 Copy', action: () => this.copyFibonacci(drawing) },
            { text: '📋 Paste', action: () => this.pasteFibonacci(event) },
            { text: '🔄 Reset Levels', action: () => this.resetFibonacciLevels(drawing) },
            { text: '🗑️ Delete', action: () => this.deleteFibonacci(drawing) }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.2s ease;
            `;
            menuItem.textContent = item.text;
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = '#4a5568';
            });
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Close menu on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 100);
    }
    
    enterFibonacciEditMode(drawing) {
        console.log('Entering Fibonacci edit mode for:', drawing.id);
        drawing.editMode = true;
        drawing.settings.dragHandles = true;
        this.renderAdvancedFibonacci(drawing);
        
        // Show edit instructions
        this.showFibonacciEditInstructions();
    }
    
    exitFibonacciEditMode(drawing) {
        drawing.editMode = false;
        this.renderAdvancedFibonacci(drawing);
    }
    
    showFibonacciEditInstructions() {
        // Show a temporary instruction overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 10000;
            font-family: IRANSans, Arial, sans-serif;
            max-width: 300px;
        `;
        overlay.innerHTML = `
            <h4>🎛️ Fibonacci Edit Mode</h4>
            <p>• Drag levels to adjust</p>
            <p>• Right-click for options</p>
            <p>• Press ESC to exit</p>
            <button onclick="this.parentElement.remove()" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 5px;
                margin-top: 10px;
                cursor: pointer;
            ">Got it!</button>
        `;
        document.body.appendChild(overlay);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                overlay.remove();
            }
        }, 5000);
    }
    
    openFibonacciSettings(drawing) {
        console.log('Opening Fibonacci settings for:', drawing.id);
        // Create a modal for Fibonacci settings
        this.createFibonacciSettingsModal(drawing);
    }
    
    createFibonacciSettingsModal(drawing) {
        // Remove existing modal
        const existingModal = document.querySelector('.fib-settings-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'fib-settings-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: IRANSans, Arial, sans-serif;
        `;
        
        const settings = drawing.settings || this.fibonacciSettings[drawing.fibType || 'retracement'];
        
        modal.innerHTML = `
            <div style="
                background: #2d3748;
                border-radius: 15px;
                padding: 25px;
                width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                color: white;
            ">
                <h2>🌀 ${drawing.fibType || 'Fibonacci'} Settings</h2>
                
                <div style="margin: 20px 0;">
                    <h3>Fibonacci Levels</h3>
                    <div id="levels-container">
                        ${settings.levels.map((level, index) => `
                            <div style="display: flex; align-items: center; margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">
                                <input type="checkbox" checked style="margin-right: 10px;">
                                <input type="number" value="${level}" step="0.001" min="0" max="10" style="background: rgba(255,255,255,0.1); border: 1px solid #4a5568; border-radius: 4px; color: white; padding: 4px 8px; margin-right: 10px; width: 80px;">
                                <input type="color" value="${this.fibColors[level] || '#4ECDC4'}" style="width: 30px; height: 30px; border: none; border-radius: 4px; margin-right: 10px; cursor: pointer;">
                                <span style="margin-right: 10px;">${(level * 100).toFixed(1)}%</span>
                                <button onclick="this.parentElement.remove()" style="background: #e53e3e; border: none; border-radius: 4px; color: white; padding: 4px 8px; cursor: pointer; margin-left: auto;">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                    <button onclick="addCustomLevel()" style="background: #48bb78; border: none; border-radius: 6px; color: white; padding: 8px 15px; cursor: pointer; margin: 10px 0;">➕ Add Level</button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                    <div>
                        <h3>Display Options</h3>
                        <label style="display: block; margin: 8px 0;"><input type="checkbox" ${settings.showLabels ? 'checked' : ''}> Show Labels</label>
                        <label style="display: block; margin: 8px 0;"><input type="checkbox" ${settings.showPrices ? 'checked' : ''}> Show Prices</label>
                        <label style="display: block; margin: 8px 0;"><input type="checkbox" ${settings.showPercents ? 'checked' : ''}> Show Percentages</label>
                        <label style="display: block; margin: 8px 0;"><input type="checkbox" ${settings.extendLeft ? 'checked' : ''}> Extend Left</label>
                        <label style="display: block; margin: 8px 0;"><input type="checkbox" ${settings.extendRight ? 'checked' : ''}> Extend Right</label>
                        ${settings.showBackground !== undefined ? `<label style="display: block; margin: 8px 0;"><input type="checkbox" ${settings.showBackground ? 'checked' : ''}> Show Background</label>` : ''}
                    </div>
                    <div>
                        <h3>Line Style</h3>
                        <label style="display: block; margin: 8px 0;">
                            Line Width: <input type="range" min="1" max="5" value="${settings.lineWidth}" style="width: 100px;">
                            <span>${settings.lineWidth}px</span>
                        </label>
                        <label style="display: block; margin: 8px 0;">
                            Line Style:
                            <select style="background: #4a5568; color: white; border: none; padding: 4px; border-radius: 4px;">
                                <option value="solid" ${settings.lineStyle === 'solid' ? 'selected' : ''}>Solid</option>
                                <option value="dashed" ${settings.lineStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                                <option value="dotted" ${settings.lineStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                            </select>
                        </label>
                        ${settings.backgroundOpacity !== undefined ? `
                            <label style="display: block; margin: 8px 0;">
                                Background Opacity: <input type="range" min="0" max="1" step="0.1" value="${settings.backgroundOpacity}">
                                <span>${Math.round(settings.backgroundOpacity * 100)}%</span>
                            </label>
                        ` : ''}
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="saveFibSettings()" style="background: #48bb78; border: none; border-radius: 6px; color: white; padding: 12px 25px; cursor: pointer; margin: 0 10px; font-size: 1em;">✅ Apply</button>
                    <button onclick="resetFibToDefaults()" style="background: #e53e3e; border: none; border-radius: 6px; color: white; padding: 12px 25px; cursor: pointer; margin: 0 10px; font-size: 1em;">🔄 Reset</button>
                    <button onclick="this.closest('.fib-settings-modal').remove()" style="background: #4a5568; border: none; border-radius: 6px; color: white; padding: 12px 25px; cursor: pointer; margin: 0 10px; font-size: 1em;">❌ Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add functionality to buttons
        window.addCustomLevel = () => {
            const container = document.getElementById('levels-container');
            const newDiv = document.createElement('div');
            newDiv.style.cssText = 'display: flex; align-items: center; margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;';
            newDiv.innerHTML = `
                <input type="checkbox" checked style="margin-right: 10px;">
                <input type="number" value="1.272" step="0.001" min="0" max="10" style="background: rgba(255,255,255,0.1); border: 1px solid #4a5568; border-radius: 4px; color: white; padding: 4px 8px; margin-right: 10px; width: 80px;">
                <input type="color" value="#4ECDC4" style="width: 30px; height: 30px; border: none; border-radius: 4px; margin-right: 10px; cursor: pointer;">
                <span style="margin-right: 10px;">127.2%</span>
                <button onclick="this.parentElement.remove()" style="background: #e53e3e; border: none; border-radius: 4px; color: white; padding: 4px 8px; cursor: pointer; margin-left: auto;">🗑️</button>
            `;
            container.appendChild(newDiv);
        };
        
        window.saveFibSettings = () => {
            console.log('Saving Fibonacci settings...');
            modal.remove();
            this.renderAdvancedFibonacci(drawing);
        };
        
        window.resetFibToDefaults = () => {
            console.log('Resetting to defaults...');
            // Reset to default settings
            modal.remove();
        };
    }
    
    openColorEditor(drawing) {
        console.log('Opening color editor for Fibonacci');
        // Simple color picker implementation
    }
    
    copyFibonacci(drawing) {
        console.log('Copying Fibonacci:', drawing.id);
        this.fibonacciClipboard = JSON.parse(JSON.stringify(drawing));
    }
    
    pasteFibonacci(event) {
        if (this.fibonacciClipboard) {
            console.log('Pasting Fibonacci');
            const newDrawing = JSON.parse(JSON.stringify(this.fibonacciClipboard));
            newDrawing.id = this.generateId('fibonacci-paste');
            const point = this.getChartPoint(event);
            newDrawing.startPoint = point;
            newDrawing.endPoint = { ...point, price: point.price + 1000 }; // Offset for visibility
            this.tools.set(newDrawing.id, newDrawing);
            this.renderAdvancedFibonacci(newDrawing);
        }
    }
    
    resetFibonacciLevels(drawing) {
        console.log('Resetting Fibonacci levels to defaults');
        const defaults = this.fibonacciSettings[drawing.fibType || 'retracement'];
        drawing.settings.levels = [...defaults.levels];
        drawing.levels = [...defaults.levels];
        this.renderAdvancedFibonacci(drawing);
    }
    
    deleteFibonacci(drawing) {
        console.log('Deleting Fibonacci:', drawing.id);
        this.deleteTool(drawing.id);
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