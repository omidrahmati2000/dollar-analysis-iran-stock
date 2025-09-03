import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    ButtonGroup,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Tooltip,
    Chip,
    CircularProgress,
    useTheme
} from '@mui/material';
import {
    ZoomIn,
    ZoomOut,
    Fullscreen,
    FullscreenExit,
    Timeline,
    CandlestickChart,
    ShowChart,
    BarChart,
    Settings,
    Download,
    Refresh
} from '@mui/icons-material';

class ChartEngine {
    constructor(container, options = {}) {
        this.container = container;
        this.chart = null;
        this.series = {};
        this.indicators = {};
        this.drawingTools = [];
        this.isFullscreen = false;
        
        // Chart configuration
        this.config = {
            layout: {
                background: { type: 'solid', color: options.darkMode ? '#0D1117' : '#FFFFFF' },
                textColor: options.darkMode ? '#F0F6FC' : '#000000',
            },
            grid: {
                vertLines: {
                    color: options.darkMode ? '#21262d' : '#E0E0E0',
                },
                horzLines: {
                    color: options.darkMode ? '#21262d' : '#E0E0E0',
                },
            },
            crosshair: {
                mode: 1, // Crosshair mode
                vertLine: {
                    width: 1,
                    color: options.darkMode ? '#758595' : '#666666',
                    style: 1,
                },
                horzLine: {
                    width: 1,
                    color: options.darkMode ? '#758595' : '#666666',
                    style: 1,
                },
            },
            rightPriceScale: {
                borderColor: options.darkMode ? '#21262d' : '#E0E0E0',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            timeScale: {
                borderColor: options.darkMode ? '#21262d' : '#E0E0E0',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
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
        
        this.init();
    }

    init() {
        if (!this.container) return;
        
        this.chart = createChart(this.container, {
            ...this.config,
            width: this.container.clientWidth,
            height: this.container.clientHeight,
        });

        // Handle resize
        this.resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            this.chart.applyOptions({ width, height });
        });
        
        this.resizeObserver.observe(this.container);

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Crosshair move event for tooltip
        this.chart.subscribeCrosshairMove(this.handleCrosshairMove.bind(this));
        
        // Click events for drawing tools
        this.chart.subscribeClick(this.handleChartClick.bind(this));
        
        // Time scale visible range change
        this.chart.timeScale().subscribeVisibleTimeRangeChange(this.handleTimeRangeChange.bind(this));
    }

    handleCrosshairMove(param) {
        if (this.onCrosshairMove) {
            this.onCrosshairMove(param);
        }
    }

    handleChartClick(param) {
        if (this.onChartClick) {
            this.onChartClick(param);
        }
    }

    handleTimeRangeChange(timeRange) {
        if (this.onTimeRangeChange) {
            this.onTimeRangeChange(timeRange);
        }
    }

    // Main series management
    createCandlestickSeries(options = {}) {
        const defaultOptions = {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        };

        this.series.main = this.chart.addCandlestickSeries({
            ...defaultOptions,
            ...options
        });
        
        return this.series.main;
    }

    createLineSeries(id, options = {}) {
        const defaultOptions = {
            color: '#2196F3',
            lineWidth: 2,
        };

        this.series[id] = this.chart.addLineSeries({
            ...defaultOptions,
            ...options
        });
        
        return this.series[id];
    }

    createAreaSeries(id, options = {}) {
        const defaultOptions = {
            topColor: 'rgba(33, 150, 243, 0.56)',
            bottomColor: 'rgba(33, 150, 243, 0.04)',
            lineColor: 'rgba(33, 150, 243, 1)',
            lineWidth: 2,
        };

        this.series[id] = this.chart.addAreaSeries({
            ...defaultOptions,
            ...options
        });
        
        return this.series[id];
    }

    createHistogramSeries(id, options = {}) {
        const defaultOptions = {
            color: '#26a69a',
            base: 0,
        };

        this.series[id] = this.chart.addHistogramSeries({
            ...defaultOptions,
            ...options
        });
        
        return this.series[id];
    }

    // Data management
    setData(seriesId, data) {
        if (this.series[seriesId]) {
            this.series[seriesId].setData(data);
        }
    }

    updateData(seriesId, dataPoint) {
        if (this.series[seriesId]) {
            this.series[seriesId].update(dataPoint);
        }
    }

    // Navigation methods
    zoomIn() {
        const timeScale = this.chart.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (visibleRange) {
            const middle = (visibleRange.from + visibleRange.to) / 2;
            const range = (visibleRange.to - visibleRange.from) * 0.25; // Zoom to 50%
            
            timeScale.setVisibleRange({
                from: middle - range,
                to: middle + range
            });
        }
    }

    zoomOut() {
        const timeScale = this.chart.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (visibleRange) {
            const middle = (visibleRange.from + visibleRange.to) / 2;
            const range = (visibleRange.to - visibleRange.from) * 1; // Zoom out to 200%
            
            timeScale.setVisibleRange({
                from: middle - range,
                to: middle + range
            });
        }
    }

    fitContent() {
        this.chart.timeScale().fitContent();
    }

    scrollToPosition(position) {
        this.chart.timeScale().scrollToPosition(position, false);
    }

    // Price scale methods
    setPriceScale(type = 'normal') {
        this.chart.priceScale('right').applyOptions({
            mode: type === 'logarithmic' ? 1 : 0, // 0 = Normal, 1 = Logarithmic
        });
    }

    // Drawing tools (simplified implementation)
    addTrendLine(point1, point2, options = {}) {
        // This is a simplified implementation
        // In a full implementation, you'd need to create custom drawing overlays
        const trendLine = {
            id: `trendline_${Date.now()}`,
            type: 'trendline',
            point1,
            point2,
            options: {
                color: options.color || '#2196F3',
                lineWidth: options.lineWidth || 2,
                lineStyle: options.lineStyle || 0, // 0 = Solid
            }
        };
        
        this.drawingTools.push(trendLine);
        this.renderDrawingTools();
        return trendLine.id;
    }

    removeTrendLine(id) {
        this.drawingTools = this.drawingTools.filter(tool => tool.id !== id);
        this.renderDrawingTools();
    }

    renderDrawingTools() {
        // In a full implementation, this would render all drawing tools
        // For now, this is a placeholder
        console.log('Rendering drawing tools:', this.drawingTools);
    }

    // Indicators
    addIndicator(type, params = {}) {
        const indicatorId = `${type}_${Date.now()}`;
        
        // This is a simplified implementation
        // In production, you'd calculate indicators server-side or use TA-Lib
        switch (type) {
            case 'sma':
                this.indicators[indicatorId] = this.createSimpleMovingAverage(params);
                break;
            case 'ema':
                this.indicators[indicatorId] = this.createExponentialMovingAverage(params);
                break;
            case 'rsi':
                this.indicators[indicatorId] = this.createRSI(params);
                break;
            case 'macd':
                this.indicators[indicatorId] = this.createMACD(params);
                break;
            default:
                console.warn(`Indicator ${type} not implemented`);
        }
        
        return indicatorId;
    }

    createSimpleMovingAverage(params = { period: 20, color: '#FF6B35' }) {
        const series = this.createLineSeries(`sma_${params.period}`, {
            color: params.color,
            lineWidth: 2,
            title: `SMA(${params.period})`
        });
        
        return {
            type: 'sma',
            series,
            params
        };
    }

    createExponentialMovingAverage(params = { period: 20, color: '#4ECDC4' }) {
        const series = this.createLineSeries(`ema_${params.period}`, {
            color: params.color,
            lineWidth: 2,
            title: `EMA(${params.period})`
        });
        
        return {
            type: 'ema',
            series,
            params
        };
    }

    createRSI(params = { period: 14 }) {
        // RSI would typically be in a separate panel
        const series = this.createLineSeries(`rsi_${params.period}`, {
            color: '#9B59B6',
            lineWidth: 2,
            title: `RSI(${params.period})`
        });
        
        return {
            type: 'rsi',
            series,
            params
        };
    }

    createMACD(params = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }) {
        // MACD would typically be in a separate panel with multiple series
        const macdLine = this.createLineSeries('macd_line', {
            color: '#3498DB',
            lineWidth: 2,
            title: 'MACD'
        });
        
        const signalLine = this.createLineSeries('macd_signal', {
            color: '#E74C3C',
            lineWidth: 2,
            title: 'Signal'
        });
        
        const histogram = this.createHistogramSeries('macd_histogram', {
            color: '#95A5A6',
            title: 'Histogram'
        });
        
        return {
            type: 'macd',
            series: { macdLine, signalLine, histogram },
            params
        };
    }

    removeIndicator(id) {
        if (this.indicators[id]) {
            const indicator = this.indicators[id];
            
            if (indicator.series) {
                if (Array.isArray(indicator.series)) {
                    indicator.series.forEach(series => this.chart.removeSeries(series));
                } else if (typeof indicator.series === 'object' && indicator.series.series) {
                    this.chart.removeSeries(indicator.series.series);
                } else {
                    this.chart.removeSeries(indicator.series);
                }
            }
            
            delete this.indicators[id];
        }
    }

    // Chart appearance
    setTheme(darkMode) {
        const newConfig = {
            layout: {
                background: { type: 'solid', color: darkMode ? '#0D1117' : '#FFFFFF' },
                textColor: darkMode ? '#F0F6FC' : '#000000',
            },
            grid: {
                vertLines: { color: darkMode ? '#21262d' : '#E0E0E0' },
                horzLines: { color: darkMode ? '#21262d' : '#E0E0E0' },
            },
            rightPriceScale: {
                borderColor: darkMode ? '#21262d' : '#E0E0E0',
            },
            timeScale: {
                borderColor: darkMode ? '#21262d' : '#E0E0E0',
            },
        };
        
        this.chart.applyOptions(newConfig);
    }

    // Export functionality
    takeScreenshot() {
        return this.chart.takeScreenshot();
    }

    // Cleanup
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        if (this.chart) {
            this.chart.remove();
        }
    }

    // Event handlers (to be overridden)
    onCrosshairMove = null;
    onChartClick = null;
    onTimeRangeChange = null;
}

export default ChartEngine;