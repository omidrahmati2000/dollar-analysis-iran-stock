import { createChart } from 'lightweight-charts';

class MultiPanelChartEngine {
    constructor(container, options = {}) {
        this.container = container;
        this.panels = new Map();
        this.series = new Map();
        this.indicators = new Map();
        this.drawingTools = [];
        this.isFullscreen = false;
        this.panelHeight = options.panelHeight || 200;
        this.mainPanelRatio = 1; // Always use full space for main panel initially
        
        this.options = {
            darkMode: options.darkMode || false,
            ...options
        };
        
        this.init();
    }

    init() {
        if (!this.container) return;
        
        this.setupContainer();
        this.createMainPanel();
        this.setupEventListeners();
        this.setupResizeObserver();
    }

    setupContainer() {
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.width = '100%';
        this.container.style.position = 'relative';
        this.container.style.flex = '1';
        this.container.style.minHeight = '0';
    }

    createMainPanel() {
        const mainContainer = document.createElement('div');
        // Use flex: 1 to take all available space and remove empty space
        mainContainer.style.flex = '1';
        mainContainer.style.minHeight = '200px';
        mainContainer.style.position = 'relative';
        mainContainer.style.height = '100%';
        mainContainer.style.width = '100%';
        mainContainer.style.backgroundColor = 'transparent';
        
        this.container.appendChild(mainContainer);
        
        const chart = createChart(mainContainer, {
            ...this.getChartOptions(),
            autoSize: true,
            handleScroll: true,
            handleScale: true
        });
        
        this.panels.set('main', {
            container: mainContainer,
            chart,
            type: 'main',
            series: new Map(),
            height: 0
        });
        
        this.updatePanelSizes();
    }

    createOscillatorPanel(id, title = '', height = this.panelHeight) {
        const panelContainer = document.createElement('div');
        panelContainer.style.height = `${height}px`;
        panelContainer.style.minHeight = '100px';
        panelContainer.style.position = 'relative';
        panelContainer.style.borderTop = `1px solid ${this.options.darkMode ? '#21262d' : '#E0E0E0'}`;
        
        // Add title if provided
        if (title) {
            const titleElement = document.createElement('div');
            titleElement.style.position = 'absolute';
            titleElement.style.top = '5px';
            titleElement.style.left = '10px';
            titleElement.style.zIndex = '1000';
            titleElement.style.color = this.options.darkMode ? '#F0F6FC' : '#000000';
            titleElement.style.fontSize = '12px';
            titleElement.style.fontWeight = 'bold';
            titleElement.textContent = title;
            panelContainer.appendChild(titleElement);
        }
        
        this.container.appendChild(panelContainer);
        
        const chart = createChart(panelContainer, {
            ...this.getChartOptions(),
            height: height
        });
        
        this.panels.set(id, {
            container: panelContainer,
            chart,
            type: 'oscillator',
            series: new Map(),
            height,
            title
        });
        
        return this.panels.get(id);
    }

    getChartOptions() {
        return {
            layout: {
                background: { 
                    type: 'solid', 
                    color: this.options.darkMode ? '#0D1117' : '#FFFFFF' 
                },
                textColor: this.options.darkMode ? '#F0F6FC' : '#000000',
            },
            grid: {
                vertLines: {
                    color: this.options.darkMode ? '#21262d' : '#E0E0E0',
                    style: 1,
                },
                horzLines: {
                    color: this.options.darkMode ? '#21262d' : '#E0E0E0',
                    style: 1,
                },
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    width: 1,
                    color: this.options.darkMode ? '#758595' : '#666666',
                    style: 1,
                },
                horzLine: {
                    width: 1,
                    color: this.options.darkMode ? '#758595' : '#666666',
                    style: 1,
                },
            },
            rightPriceScale: {
                borderColor: this.options.darkMode ? '#21262d' : '#E0E0E0',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            timeScale: {
                borderColor: this.options.darkMode ? '#21262d' : '#E0E0E0',
                timeVisible: true,
                secondsVisible: false,
                fixLeftEdge: true,
                fixRightEdge: true,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            handleScale: {
                axisPressedMouseMove: {
                    time: true,
                    price: true,
                },
                axisDoubleClickReset: true,
                mouseWheel: true,
                pinch: true,
            },
        };
    }

    setupEventListeners() {
        // Sync time scales across all panels
        const panels = Array.from(this.panels.values());
        
        panels.forEach(panel => {
            panel.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
                this.syncTimeScales();
            });
            
            panel.chart.subscribeCrosshairMove((param) => {
                this.syncCrosshairs(param);
                if (this.onCrosshairMove) {
                    this.onCrosshairMove(param, panel);
                }
            });
            
            panel.chart.subscribeClick((param) => {
                if (this.onChartClick) {
                    this.onChartClick(param, panel);
                }
            });
        });
    }

    syncTimeScales() {
        if (!this.panels.has('main')) return;
        
        const mainTimeScale = this.panels.get('main').chart.timeScale();
        const visibleRange = mainTimeScale.getVisibleRange();
        
        if (!visibleRange) return;
        
        this.panels.forEach((panel, id) => {
            if (id !== 'main') {
                panel.chart.timeScale().setVisibleRange(visibleRange);
            }
        });
    }

    syncCrosshairs(param) {
        if (!param || !param.time) return;
        
        this.panels.forEach(panel => {
            panel.chart.setCrosshairPosition(param.time, param.point?.x || 0);
        });
    }

    setupResizeObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            this.updatePanelSizes();
        });
        
        this.resizeObserver.observe(this.container);
    }

    updatePanelSizes() {
        if (!this.container) return;
        
        const containerWidth = this.container.clientWidth;
        
        this.panels.forEach((panel, id) => {
            if (id === 'main') {
                // Let flex handle the height automatically, just set width
                const actualHeight = panel.container.clientHeight || 400;
                panel.height = actualHeight;
                panel.chart.applyOptions({ 
                    width: containerWidth, 
                    height: actualHeight 
                });
            } else {
                // Oscillator panels use fixed height
                panel.chart.applyOptions({ 
                    width: containerWidth, 
                    height: panel.height 
                });
            }
        });
    }

    // Series management
    createCandlestickSeries(panelId = 'main', options = {}) {
        const panel = this.panels.get(panelId);
        if (!panel) return null;

        const defaultOptions = {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        };

        const series = panel.chart.addCandlestickSeries({
            ...defaultOptions,
            ...options
        });
        
        const seriesId = `${panelId}_candlestick_${Date.now()}`;
        panel.series.set(seriesId, series);
        this.series.set(seriesId, { series, panel: panelId, type: 'candlestick' });
        
        return { seriesId, series };
    }

    createLineSeries(panelId, options = {}) {
        const panel = this.panels.get(panelId);
        if (!panel) return null;

        const defaultOptions = {
            color: '#2196F3',
            lineWidth: 2,
        };

        const series = panel.chart.addLineSeries({
            ...defaultOptions,
            ...options
        });
        
        const seriesId = `${panelId}_line_${Date.now()}`;
        panel.series.set(seriesId, series);
        this.series.set(seriesId, { series, panel: panelId, type: 'line' });
        
        return { seriesId, series };
    }

    createAreaSeries(panelId, options = {}) {
        const panel = this.panels.get(panelId);
        if (!panel) return null;

        const defaultOptions = {
            topColor: 'rgba(33, 150, 243, 0.56)',
            bottomColor: 'rgba(33, 150, 243, 0.04)',
            lineColor: 'rgba(33, 150, 243, 1)',
            lineWidth: 2,
        };

        const series = panel.chart.addAreaSeries({
            ...defaultOptions,
            ...options
        });
        
        const seriesId = `${panelId}_area_${Date.now()}`;
        panel.series.set(seriesId, series);
        this.series.set(seriesId, { series, panel: panelId, type: 'area' });
        
        return { seriesId, series };
    }

    createHistogramSeries(panelId, options = {}) {
        const panel = this.panels.get(panelId);
        if (!panel) return null;

        const defaultOptions = {
            color: '#26a69a',
            base: 0,
        };

        const series = panel.chart.addHistogramSeries({
            ...defaultOptions,
            ...options
        });
        
        const seriesId = `${panelId}_histogram_${Date.now()}`;
        panel.series.set(seriesId, series);
        this.series.set(seriesId, { series, panel: panelId, type: 'histogram' });
        
        return { seriesId, series };
    }

    // Data management
    setData(seriesId, data) {
        const seriesInfo = this.series.get(seriesId);
        if (seriesInfo && seriesInfo.series) {
            seriesInfo.series.setData(data);
        }
    }

    updateData(seriesId, dataPoint) {
        const seriesInfo = this.series.get(seriesId);
        if (seriesInfo && seriesInfo.series) {
            seriesInfo.series.update(dataPoint);
        }
    }

    // Navigation methods
    zoomIn() {
        const mainPanel = this.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (visibleRange) {
            const middle = (visibleRange.from + visibleRange.to) / 2;
            const range = (visibleRange.to - visibleRange.from) * 0.25;
            
            timeScale.setVisibleRange({
                from: middle - range,
                to: middle + range
            });
        }
    }

    zoomOut() {
        const mainPanel = this.panels.get('main');
        if (!mainPanel) return;
        
        const timeScale = mainPanel.chart.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (visibleRange) {
            const middle = (visibleRange.from + visibleRange.to) / 2;
            const range = (visibleRange.to - visibleRange.from) * 1;
            
            timeScale.setVisibleRange({
                from: middle - range,
                to: middle + range
            });
        }
    }

    fitContent() {
        this.panels.forEach(panel => {
            panel.chart.timeScale().fitContent();
        });
    }

    scrollToPosition(position) {
        this.panels.forEach(panel => {
            panel.chart.timeScale().scrollToPosition(position, false);
        });
    }

    // Price scale methods
    setPriceScale(panelId, type = 'normal') {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.chart.priceScale('right').applyOptions({
                mode: type === 'logarithmic' ? 1 : 0,
            });
        }
    }

    // Indicator management
    addIndicator(type, data, options = {}) {
        
        const indicatorId = `${type}_${Date.now()}`;
        let panelId = 'main';
        
        // Determine panel based on indicator type
        if (['rsi', 'macd', 'stoch', 'cci', 'williams'].includes(type)) {
            panelId = this.getOrCreateOscillatorPanel(type);
        }
        
        // Get panel and create series
        const panel = this.panels.get(panelId);
        if (!panel) {
            return null;
        }
        
        let series;
        const color = options.color || this.getDefaultColor(type);
        
        try {
            switch (type) {
                case 'sma':
                case 'ema':
                    // Line series for moving averages (overlay on main chart)
                    series = panel.chart.addLineSeries({
                        color,
                        lineWidth: 2,
                        title: `${type.toUpperCase()}(${options.params?.period || options.period || 20})`
                    });
                    if (data && data.length > 0) {
                        series.setData(data.map(d => ({ time: d.time, value: d.value })));
                    }
                    break;
                    
                case 'rsi':
                    // Line series for RSI in oscillator panel
                    series = panel.chart.addLineSeries({
                        color,
                        lineWidth: 2,
                        title: `RSI(${options.params?.period || options.period || 14})`
                    });
                    if (data && data.length > 0) {
                        series.setData(data.map(d => ({ time: d.time, value: d.value })));
                    }
                    // Add reference lines for RSI
                    this.addRSIReferenceLinesIfNeeded(panel, panelId);
                    break;
                    
                case 'macd':
                    // MACD has multiple lines
                    const macdSeries = panel.chart.addLineSeries({
                        color: color,
                        lineWidth: 2,
                        title: 'MACD'
                    });
                    const signalSeries = panel.chart.addLineSeries({
                        color: options.signalColor || '#ff9500',
                        lineWidth: 1,
                        title: 'Signal'
                    });
                    const histogramSeries = panel.chart.addHistogramSeries({
                        color: options.histogramColor || '#26a69a',
                        title: 'Histogram'
                    });
                    
                    if (data && data.length > 0) {
                        macdSeries.setData(data.map(d => ({ time: d.time, value: d.macd })));
                        signalSeries.setData(data.map(d => ({ time: d.time, value: d.signal })));
                        histogramSeries.setData(data.map(d => ({ time: d.time, value: d.histogram })));
                    }
                    
                    series = { macd: macdSeries, signal: signalSeries, histogram: histogramSeries };
                    break;
                    
                case 'bollinger':
                case 'bb':
                    // Bollinger Bands have upper, middle, lower lines
                    const upperSeries = panel.chart.addLineSeries({
                        color: color,
                        lineWidth: 1,
                        title: 'BB Upper'
                    });
                    const middleSeries = panel.chart.addLineSeries({
                        color: options.middleColor || '#2196f3',
                        lineWidth: 2,
                        title: 'BB Middle'
                    });
                    const lowerSeries = panel.chart.addLineSeries({
                        color: color,
                        lineWidth: 1,
                        title: 'BB Lower'
                    });
                    
                    if (data && data.length > 0) {
                        upperSeries.setData(data.map(d => ({ time: d.time, value: d.upper })));
                        middleSeries.setData(data.map(d => ({ time: d.time, value: d.middle })));
                        lowerSeries.setData(data.map(d => ({ time: d.time, value: d.lower })));
                    }
                    
                    series = { upper: upperSeries, middle: middleSeries, lower: lowerSeries };
                    break;
                    
                case 'volume':
                    // Volume histogram
                    series = panel.chart.addHistogramSeries({
                        color: '#26a69a',
                        title: 'Volume'
                    });
                    if (data && data.length > 0) {
                        series.setData(data.map(d => ({ time: d.time, value: d.volume })));
                    }
                    break;
                    
                default:
                    return null;
            }
            
            // Store indicator info
            this.indicators.set(indicatorId, {
                id: indicatorId,
                type,
                params: options.params || options,
                panel: panelId,
                series,
                color,
                options
            });
            
            return indicatorId;
            
        } catch (error) {
            return null;
        }
    }
    
    getDefaultColor(type) {
        const colors = {
            'sma': '#2196f3',
            'ema': '#ff9500',
            'rsi': '#9c27b0',
            'macd': '#4caf50',
            'bollinger': '#e91e63',
            'bb': '#e91e63',
            'volume': '#26a69a'
        };
        return colors[type] || '#2196f3';
    }
    
    addRSIReferenceLinesIfNeeded(panel, panelId) {
        // Check if reference lines already exist
        if (this.rsiReferenceLines && this.rsiReferenceLines.has(panelId)) {
            return;
        }
        
        try {
            // Add horizontal reference lines at 30 and 70 for RSI
            const line70 = panel.chart.addLineSeries({
                color: '#ff4444',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                title: 'RSI 70'
            });
            const line30 = panel.chart.addLineSeries({
                color: '#44ff44',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                title: 'RSI 30'
            });
            
            // Store reference to prevent duplicates
            if (!this.rsiReferenceLines) {
                this.rsiReferenceLines = new Map();
            }
            this.rsiReferenceLines.set(panelId, { line70, line30 });
            
        } catch (error) {
        }
    }

    getOrCreateOscillatorPanel(indicatorType) {
        const existingPanel = Array.from(this.panels.keys()).find(id => 
            id.startsWith('oscillator_') && 
            this.panels.get(id).title.toLowerCase().includes(indicatorType)
        );
        
        if (existingPanel) {
            return existingPanel;
        }
        
        const panelId = `oscillator_${indicatorType}_${Date.now()}`;
        const title = this.getIndicatorTitle(indicatorType);
        
        // Only create oscillator panel when actually needed
        this.createOscillatorPanel(panelId, title);
        
        // Update main panel ratio to make room for oscillator
        this.updatePanelRatios();
        
        return panelId;
    }
    
    updatePanelRatios() {
        const oscillatorPanels = Array.from(this.panels.keys()).filter(id => id.startsWith('oscillator_'));
        const hasOscillators = oscillatorPanels.length > 0;
        
        // Adjust main panel ratio based on whether oscillators exist
        this.mainPanelRatio = hasOscillators ? 0.7 : 1;
        
        // Update main panel flex style
        const mainPanel = this.panels.get('main');
        if (mainPanel && mainPanel.container) {
            mainPanel.container.style.flex = `${this.mainPanelRatio}`;
        }
    }

    getIndicatorTitle(type) {
        const titles = {
            rsi: 'RSI (14)',
            macd: 'MACD (12,26,9)',
            stoch: 'Stochastic (14,3,3)',
            cci: 'CCI (20)',
            williams: 'Williams %R (14)'
        };
        
        return titles[type] || type.toUpperCase();
    }

    // Specific indicator implementations
    createSMA(panelId, params = { period: 20, color: '#FF6B35' }) {
        const result = this.createLineSeries(panelId, {
            color: params.color,
            lineWidth: 2,
            title: `SMA(${params.period})`
        });
        
        return {
            seriesId: result.seriesId,
            series: result.series,
            calculate: (data) => this.calculateSMA(data, params.period)
        };
    }

    createEMA(panelId, params = { period: 20, color: '#4ECDC4' }) {
        const result = this.createLineSeries(panelId, {
            color: params.color,
            lineWidth: 2,
            title: `EMA(${params.period})`
        });
        
        return {
            seriesId: result.seriesId,
            series: result.series,
            calculate: (data) => this.calculateEMA(data, params.period)
        };
    }

    createBollingerBands(panelId, params = { period: 20, stdDev: 2 }) {
        const upperBand = this.createLineSeries(panelId, {
            color: '#9E9E9E',
            lineWidth: 1,
            title: `BB Upper(${params.period},${params.stdDev})`
        });
        
        const middleBand = this.createLineSeries(panelId, {
            color: '#2196F3',
            lineWidth: 1,
            title: `BB Middle(${params.period})`
        });
        
        const lowerBand = this.createLineSeries(panelId, {
            color: '#9E9E9E',
            lineWidth: 1,
            title: `BB Lower(${params.period},${params.stdDev})`
        });
        
        return {
            upperSeriesId: upperBand.seriesId,
            middleSeriesId: middleBand.seriesId,
            lowerSeriesId: lowerBand.seriesId,
            upperSeries: upperBand.series,
            middleSeries: middleBand.series,
            lowerSeries: lowerBand.series,
            calculate: (data) => this.calculateBollingerBands(data, params.period, params.stdDev)
        };
    }

    createRSI(panelId, params = { period: 14 }) {
        const result = this.createLineSeries(panelId, {
            color: '#9B59B6',
            lineWidth: 2,
            title: `RSI(${params.period})`
        });
        
        // Add overbought/oversold lines
        const overboughtLine = this.createLineSeries(panelId, {
            color: '#E74C3C',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Overbought (70)'
        });
        
        const oversoldLine = this.createLineSeries(panelId, {
            color: '#27AE60',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            title: 'Oversold (30)'
        });
        
        return {
            seriesId: result.seriesId,
            series: result.series,
            overboughtSeriesId: overboughtLine.seriesId,
            oversoldSeriesId: oversoldLine.seriesId,
            overboughtSeries: overboughtLine.series,
            oversoldSeries: oversoldLine.series,
            calculate: (data) => this.calculateRSI(data, params.period)
        };
    }

    createMACD(panelId, params = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }) {
        const macdLine = this.createLineSeries(panelId, {
            color: '#3498DB',
            lineWidth: 2,
            title: 'MACD'
        });
        
        const signalLine = this.createLineSeries(panelId, {
            color: '#E74C3C',
            lineWidth: 2,
            title: 'Signal'
        });
        
        const histogram = this.createHistogramSeries(panelId, {
            color: '#95A5A6',
            title: 'Histogram'
        });
        
        return {
            macdSeriesId: macdLine.seriesId,
            signalSeriesId: signalLine.seriesId,
            histogramSeriesId: histogram.seriesId,
            macdSeries: macdLine.series,
            signalSeries: signalLine.series,
            histogramSeries: histogram.series,
            calculate: (data) => this.calculateMACD(data, params.fastPeriod, params.slowPeriod, params.signalPeriod)
        };
    }

    createVolume(panelId, params = {}) {
        const result = this.createHistogramSeries(panelId, {
            color: '#26a69a',
            title: 'Volume'
        });
        
        return {
            seriesId: result.seriesId,
            series: result.series,
            calculate: (data) => data.map(item => ({
                time: item.time,
                value: item.volume || 0,
                color: item.close >= item.open ? '#26a69a' : '#ef5350'
            }))
        };
    }

    // Technical Analysis Calculations
    calculateSMA(data, period) {
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0);
            result.push({
                time: data[i].time,
                value: sum / period
            });
        }
        return result;
    }

    calculateEMA(data, period) {
        const multiplier = 2 / (period + 1);
        const result = [];
        let ema = data[0].close;
        
        result.push({ time: data[0].time, value: ema });
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i].close - ema) * multiplier + ema;
            result.push({ time: data[i].time, value: ema });
        }
        return result;
    }

    calculateRSI(data, period = 14) {
        const result = [];
        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const change = data[i].close - data[i-1].close;
            if (change > 0) gains += change;
            else losses -= change;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period; i < data.length; i++) {
            const change = data[i].close - data[i-1].close;
            
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - change) / period;
            }

            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));

            result.push({
                time: data[i].time,
                value: rsi
            });
        }
        
        return result;
    }

    calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const fastEMA = this.calculateEMA(data, fastPeriod);
        const slowEMA = this.calculateEMA(data, slowPeriod);
        
        const macdLine = [];
        const minLength = Math.min(fastEMA.length, slowEMA.length);
        
        for (let i = 0; i < minLength; i++) {
            if (fastEMA[i].time === slowEMA[i].time) {
                macdLine.push({
                    time: fastEMA[i].time,
                    value: fastEMA[i].value - slowEMA[i].value
                });
            }
        }
        
        const signalLine = this.calculateEMA(macdLine.map((item, index) => ({
            ...item,
            close: item.value
        })), signalPeriod);
        
        const histogram = [];
        for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
            if (macdLine[i] && signalLine[i] && macdLine[i].time === signalLine[i].time) {
                histogram.push({
                    time: macdLine[i].time,
                    value: macdLine[i].value - signalLine[i].value,
                    color: macdLine[i].value >= signalLine[i].value ? '#26a69a' : '#ef5350'
                });
            }
        }

        return {
            macd: macdLine,
            signal: signalLine,
            histogram: histogram
        };
    }

    calculateBollingerBands(data, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(data, period);
        const result = { upper: [], middle: [], lower: [] };

        for (let i = 0; i < sma.length; i++) {
            const dataIndex = i + period - 1;
            const slice = data.slice(dataIndex - period + 1, dataIndex + 1);
            
            const mean = sma[i].value;
            const variance = slice.reduce((acc, item) => acc + Math.pow(item.close - mean, 2), 0) / period;
            const standardDeviation = Math.sqrt(variance);

            result.middle.push(sma[i]);
            result.upper.push({
                time: sma[i].time,
                value: mean + (stdDev * standardDeviation)
            });
            result.lower.push({
                time: sma[i].time,
                value: mean - (stdDev * standardDeviation)
            });
        }

        return result;
    }

    // Remove indicator
    removeIndicator(indicatorId) {
        
        const indicator = this.indicators.get(indicatorId);
        if (!indicator) {
            return;
        }
        
        try {
            const panel = this.panels.get(indicator.panel);
            if (!panel) {
                return;
            }
            
            // Remove series based on indicator type and structure
            if (indicator.series) {
                if (typeof indicator.series === 'object' && !indicator.series.setData) {
                    // Complex indicator with multiple series (MACD, Bollinger Bands, etc.)
                    Object.values(indicator.series).forEach(series => {
                        if (series && series.setData) {
                            try {
                                panel.chart.removeSeries(series);
                            } catch (error) {
                            }
                        }
                    });
                } else if (indicator.series.setData) {
                    // Simple indicator with single series
                    try {
                        panel.chart.removeSeries(indicator.series);
                    } catch (error) {
                    }
                }
            }
            
            // Remove from indicators map
            this.indicators.delete(indicatorId);
            
            // Check if oscillator panel is empty and remove it
            this.cleanupEmptyPanels();
            
            
        } catch (error) {
        }
    }

    cleanupEmptyPanels() {
        let panelsRemoved = false;
        
        this.panels.forEach((panel, panelId) => {
            if (panelId !== 'main' && panel.series.size === 0) {
                this.removePanel(panelId);
                panelsRemoved = true;
            }
        });
        
        // Update panel ratios if panels were removed
        if (panelsRemoved) {
            this.updatePanelRatios();
        }
    }

    removePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel && panelId !== 'main') {
            panel.chart.remove();
            panel.container.remove();
            this.panels.delete(panelId);
        }
    }

    // Theme management
    setTheme(darkMode) {
        this.options.darkMode = darkMode;
        const newOptions = this.getChartOptions();
        
        this.panels.forEach(panel => {
            panel.chart.applyOptions(newOptions);
        });
    }

    // Export functionality
    takeScreenshot() {
        const screenshots = new Map();
        
        this.panels.forEach((panel, panelId) => {
            screenshots.set(panelId, panel.chart.takeScreenshot());
        });
        
        return screenshots;
    }

    // Chart access methods
    getMainChart() {
        const mainPanel = this.panels.get('main');
        return mainPanel ? mainPanel.chart : null;
    }

    setChartType(type) {
        
        const mainPanel = this.panels.get('main');
        if (!mainPanel || !this.mainChartData) {
            return;
        }

        try {
            // Remove existing main series
            const existingMainSeries = this.getMainSeries();
            if (existingMainSeries) {
                mainPanel.chart.removeSeries(existingMainSeries.series);
                this.series.delete(existingMainSeries.seriesId);
                mainPanel.series.delete(existingMainSeries.seriesId);
            }

            // Create new series based on type
            let newSeries;
            const seriesId = `main_${type}_${Date.now()}`;
            
            switch (type) {
                case 'candlestick':
                    newSeries = mainPanel.chart.addCandlestickSeries({
                        upColor: '#26a69a',
                        downColor: '#ef5350',
                        borderVisible: false,
                        wickUpColor: '#26a69a',
                        wickDownColor: '#ef5350',
                    });
                    break;
                    
                case 'line':
                    newSeries = mainPanel.chart.addLineSeries({
                        color: '#2196f3',
                        lineWidth: 2,
                    });
                    // For line chart, use close prices
                    const lineData = this.mainChartData.map(item => ({
                        time: item.time,
                        value: item.close
                    }));
                    newSeries.setData(lineData);
                    break;
                    
                case 'area':
                    newSeries = mainPanel.chart.addAreaSeries({
                        topColor: 'rgba(33, 150, 243, 0.56)',
                        bottomColor: 'rgba(33, 150, 243, 0.04)',
                        lineColor: '#2196f3',
                        lineWidth: 2,
                    });
                    // For area chart, use close prices
                    const areaData = this.mainChartData.map(item => ({
                        time: item.time,
                        value: item.close
                    }));
                    newSeries.setData(areaData);
                    break;
                    
                case 'ohlc':
                case 'bars':
                    newSeries = mainPanel.chart.addCandlestickSeries({
                        upColor: 'rgba(38, 166, 154, 0)',
                        downColor: 'rgba(239, 83, 80, 0)',
                        borderUpColor: '#26a69a',
                        borderDownColor: '#ef5350',
                        wickUpColor: '#26a69a',
                        wickDownColor: '#ef5350',
                    });
                    break;
                    
                case 'heikinashi':
                    // Calculate Heikin Ashi data
                    const heikinAshiData = this.calculateHeikinAshi(this.mainChartData);
                    newSeries = mainPanel.chart.addCandlestickSeries({
                        upColor: '#26a69a',
                        downColor: '#ef5350',
                        borderVisible: false,
                        wickUpColor: '#26a69a',
                        wickDownColor: '#ef5350',
                    });
                    newSeries.setData(heikinAshiData);
                    break;
                    
                default:
                    newSeries = mainPanel.chart.addCandlestickSeries({
                        upColor: '#26a69a',
                        downColor: '#ef5350',
                        borderVisible: false,
                        wickUpColor: '#26a69a',
                        wickDownColor: '#ef5350',
                    });
            }

            // Set data for candlestick and OHLC types
            if (['candlestick', 'ohlc', 'bars'].includes(type) && type !== 'heikinashi') {
                newSeries.setData(this.mainChartData);
            }

            // Store new series
            this.series.set(seriesId, {
                seriesId,
                series: newSeries,
                type: 'main',
                panel: 'main',
                chartType: type
            });
            
            mainPanel.series.set(seriesId, {
                seriesId,
                series: newSeries,
                type: 'main',
                chartType: type
            });

            
        } catch (error) {
        }
    }
    
    calculateHeikinAshi(data) {
        const result = [];
        let prevHA = null;
        
        for (let i = 0; i < data.length; i++) {
            const current = data[i];
            
            if (i === 0) {
                // First candle
                result.push({
                    time: current.time,
                    open: (current.open + current.close) / 2,
                    high: current.high,
                    low: current.low,
                    close: (current.open + current.high + current.low + current.close) / 4
                });
            } else {
                const haClose = (current.open + current.high + current.low + current.close) / 4;
                const haOpen = (prevHA.open + prevHA.close) / 2;
                const haHigh = Math.max(current.high, haOpen, haClose);
                const haLow = Math.min(current.low, haOpen, haClose);
                
                const haCandle = {
                    time: current.time,
                    open: haOpen,
                    high: haHigh,
                    low: haLow,
                    close: haClose
                };
                
                result.push(haCandle);
                prevHA = haCandle;
            }
        }
        
        return result;
    }

    // Get main series for data updates
    getMainSeries() {
        // Find the main candlestick or line series
        for (const [seriesId, seriesInfo] of this.series) {
            if (seriesInfo.panel === 'main' && 
                ['candlestick', 'line', 'area'].includes(seriesInfo.type)) {
                return { seriesId, seriesInfo };
            }
        }
        return null;
    }

    // Update main chart data
    updateMainData(data) {
        const mainSeries = this.getMainSeries();
        if (mainSeries) {
            this.setData(mainSeries.seriesId, data);
            // Store the data for indicator calculations
            this.mainChartData = data;
        }
    }

    // Get main chart data for indicator calculations
    getData() {
        return this.mainChartData || [];
    }

    // Cleanup
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        this.panels.forEach(panel => {
            panel.chart.remove();
            // Also remove DOM container element
            if (panel.container && panel.container.parentNode) {
                panel.container.parentNode.removeChild(panel.container);
            }
        });
        
        this.panels.clear();
        this.series.clear();
        this.indicators.clear();
        
        // Clear main container
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    // Event handlers (to be overridden)
    onCrosshairMove = null;
    onChartClick = null;
    onTimeRangeChange = null;
}

export default MultiPanelChartEngine;