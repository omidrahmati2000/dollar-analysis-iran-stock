import React, { useEffect, useRef, useState, useCallback } from 'react';
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
    useTheme,
    Dialog,
    DialogTitle,
    DialogContent,
    Slider,
    TextField,
    Grid,
    Divider
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
    Refresh,
    TrendingUp,
    Functions,
    Brush,
    Close
} from '@mui/icons-material';
import ChartEngine from './ChartEngine';

const AdvancedChart = ({ 
    symbol = 'TAPICO', 
    data = [], 
    indicators = [], 
    onSymbolChange,
    height = 600,
    enableDrawing = true,
    enableIndicators = true 
}) => {
    const theme = useTheme();
    const chartContainerRef = useRef(null);
    const chartEngineRef = useRef(null);
    
    // State
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [chartType, setChartType] = useState('candlestick');
    const [timeframe, setTimeframe] = useState('1D');
    const [priceScale, setPriceScale] = useState('normal');
    const [loading, setLoading] = useState(false);
    const [crosshairData, setCrosshairData] = useState(null);
    
    // Indicator settings dialog
    const [indicatorDialog, setIndicatorDialog] = useState({ open: false, type: null });
    const [activeIndicators, setActiveIndicators] = useState([]);
    
    // Chart types
    const chartTypes = [
        { value: 'candlestick', label: 'Candlestick', icon: <CandlestickChart /> },
        { value: 'line', label: 'Line', icon: <ShowChart /> },
        { value: 'area', label: 'Area', icon: <Timeline /> },
        { value: 'bars', label: 'OHLC', icon: <BarChart /> }
    ];

    // Timeframes
    const timeframes = [
        '1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'
    ];

    // Available indicators
    const availableIndicators = [
        { type: 'sma', name: 'Simple Moving Average', category: 'overlay' },
        { type: 'ema', name: 'Exponential Moving Average', category: 'overlay' },
        { type: 'bb', name: 'Bollinger Bands', category: 'overlay' },
        { type: 'rsi', name: 'RSI', category: 'oscillator' },
        { type: 'macd', name: 'MACD', category: 'oscillator' },
        { type: 'stoch', name: 'Stochastic', category: 'oscillator' }
    ];

    // Initialize chart
    useEffect(() => {
        if (chartContainerRef.current && !chartEngineRef.current) {
            chartEngineRef.current = new ChartEngine(chartContainerRef.current, {
                darkMode: theme.palette.mode === 'dark'
            });

            // Setup event handlers
            chartEngineRef.current.onCrosshairMove = handleCrosshairMove;
            chartEngineRef.current.onChartClick = handleChartClick;
            chartEngineRef.current.onTimeRangeChange = handleTimeRangeChange;

            // Create main series
            createMainSeries();
        }

        return () => {
            if (chartEngineRef.current) {
                chartEngineRef.current.destroy();
                chartEngineRef.current = null;
            }
        };
    }, []);

    // Update theme
    useEffect(() => {
        if (chartEngineRef.current) {
            chartEngineRef.current.setTheme(theme.palette.mode === 'dark');
        }
    }, [theme.palette.mode]);

    // Update data
    useEffect(() => {
        if (chartEngineRef.current && data.length > 0) {
            updateChartData();
        }
    }, [data, chartType]);

    const createMainSeries = useCallback(() => {
        if (!chartEngineRef.current) return;

        switch (chartType) {
            case 'candlestick':
                chartEngineRef.current.createCandlestickSeries();
                break;
            case 'line':
                chartEngineRef.current.createLineSeries('main', {
                    color: theme.palette.primary.main,
                    lineWidth: 2
                });
                break;
            case 'area':
                chartEngineRef.current.createAreaSeries('main', {
                    topColor: `${theme.palette.primary.main}88`,
                    bottomColor: `${theme.palette.primary.main}11`,
                    lineColor: theme.palette.primary.main
                });
                break;
            default:
                chartEngineRef.current.createCandlestickSeries();
        }
    }, [chartType, theme.palette.primary.main]);

    const updateChartData = useCallback(() => {
        if (!chartEngineRef.current || !data.length) return;

        const formattedData = data.map(item => ({
            time: item.time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume
        }));

        if (chartType === 'candlestick') {
            chartEngineRef.current.setData('main', formattedData);
        } else {
            // For line/area charts, use close prices
            const closeData = formattedData.map(item => ({
                time: item.time,
                value: item.close
            }));
            chartEngineRef.current.setData('main', closeData);
        }

        // Update indicators
        updateIndicators(formattedData);
    }, [data, chartType]);

    const updateIndicators = useCallback((chartData) => {
        // This is where you'd calculate and update indicator data
        // In a real implementation, this would come from the backend
        activeIndicators.forEach(indicator => {
            const indicatorData = calculateIndicator(indicator.type, chartData, indicator.params);
            chartEngineRef.current.setData(indicator.id, indicatorData);
        });
    }, [activeIndicators]);

    // Event handlers
    const handleCrosshairMove = useCallback((param) => {
        if (!param.time) {
            setCrosshairData(null);
            return;
        }

        const data = param.seriesData?.get(chartEngineRef.current.series.main);
        if (data) {
            setCrosshairData({
                time: param.time,
                ...data
            });
        }
    }, []);

    const handleChartClick = useCallback((param) => {
        // Handle drawing tools
        console.log('Chart clicked:', param);
    }, []);

    const handleTimeRangeChange = useCallback((timeRange) => {
        // Handle lazy loading of historical data
        console.log('Time range changed:', timeRange);
    }, []);

    // Chart controls
    const handleZoomIn = () => {
        chartEngineRef.current?.zoomIn();
    };

    const handleZoomOut = () => {
        chartEngineRef.current?.zoomOut();
    };

    const handleFitContent = () => {
        chartEngineRef.current?.fitContent();
    };

    const handleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const handleChartTypeChange = (newType) => {
        setChartType(newType);
        // Recreate series with new type
        if (chartEngineRef.current) {
            // Remove existing series
            Object.keys(chartEngineRef.current.series).forEach(key => {
                if (key === 'main') {
                    chartEngineRef.current.chart.removeSeries(chartEngineRef.current.series[key]);
                }
            });
            
            createMainSeries();
        }
    };

    const handlePriceScaleChange = (scale) => {
        setPriceScale(scale);
        chartEngineRef.current?.setPriceScale(scale);
    };

    const handleAddIndicator = (type) => {
        setIndicatorDialog({ open: true, type });
    };

    const handleIndicatorDialogClose = () => {
        setIndicatorDialog({ open: false, type: null });
    };

    const addIndicator = (type, params) => {
        const id = chartEngineRef.current?.addIndicator(type, params);
        if (id) {
            setActiveIndicators(prev => [...prev, { id, type, params }]);
        }
        handleIndicatorDialogClose();
    };

    const removeIndicator = (indicatorId) => {
        chartEngineRef.current?.removeIndicator(indicatorId);
        setActiveIndicators(prev => prev.filter(ind => ind.id !== indicatorId));
    };

    const handleDownload = () => {
        const screenshot = chartEngineRef.current?.takeScreenshot();
        if (screenshot) {
            const link = document.createElement('a');
            link.download = `${symbol}_chart_${new Date().toISOString().split('T')[0]}.png`;
            link.href = screenshot;
            link.click();
        }
    };

    // Simplified indicator calculation (in production, this should be server-side)
    const calculateIndicator = (type, data, params) => {
        switch (type) {
            case 'sma':
                return calculateSMA(data, params.period);
            case 'ema':
                return calculateEMA(data, params.period);
            case 'rsi':
                return calculateRSI(data, params.period);
            default:
                return [];
        }
    };

    const calculateSMA = (data, period) => {
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0);
            result.push({
                time: data[i].time,
                value: sum / period
            });
        }
        return result;
    };

    const calculateEMA = (data, period) => {
        const multiplier = 2 / (period + 1);
        const result = [];
        let ema = data[0].close;
        
        result.push({ time: data[0].time, value: ema });
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i].close - ema) * multiplier + ema;
            result.push({ time: data[i].time, value: ema });
        }
        return result;
    };

    const calculateRSI = (data, period) => {
        // Simplified RSI calculation
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
    };

    return (
        <Paper 
            sx={{ 
                height: isFullscreen ? '100vh' : height, 
                position: isFullscreen ? 'fixed' : 'relative',
                top: isFullscreen ? 0 : 'auto',
                left: isFullscreen ? 0 : 'auto',
                right: isFullscreen ? 0 : 'auto',
                bottom: isFullscreen ? 0 : 'auto',
                zIndex: isFullscreen ? 10000 : 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Chart Toolbar */}
            <Box sx={{ 
                p: 2, 
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap'
            }}>
                {/* Symbol */}
                <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                    📊 {symbol}
                </Typography>

                {/* Chart Type */}
                <ButtonGroup size="small">
                    {chartTypes.map((type) => (
                        <Tooltip key={type.value} title={type.label}>
                            <Button
                                variant={chartType === type.value ? 'contained' : 'outlined'}
                                onClick={() => handleChartTypeChange(type.value)}
                                startIcon={type.icon}
                                size="small"
                            >
                                {type.label}
                            </Button>
                        </Tooltip>
                    ))}
                </ButtonGroup>

                {/* Timeframe */}
                <FormControl size="small" sx={{ minWidth: 80 }}>
                    <Select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        displayEmpty
                    >
                        {timeframes.map(tf => (
                            <MenuItem key={tf} value={tf}>{tf}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Indicators */}
                {enableIndicators && (
                    <ButtonGroup size="small">
                        <Tooltip title="Add Indicator">
                            <Button
                                onClick={() => handleAddIndicator('sma')}
                                startIcon={<Functions />}
                            >
                                Indicators
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                )}

                {/* Chart Controls */}
                <ButtonGroup size="small">
                    <Tooltip title="Zoom In">
                        <IconButton onClick={handleZoomIn} size="small">
                            <ZoomIn />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Zoom Out">
                        <IconButton onClick={handleZoomOut} size="small">
                            <ZoomOut />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Fit Content">
                        <IconButton onClick={handleFitContent} size="small">
                            <Timeline />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                        <IconButton onClick={handleFullscreen} size="small">
                            {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Download Screenshot">
                        <IconButton onClick={handleDownload} size="small">
                            <Download />
                        </IconButton>
                    </Tooltip>
                </ButtonGroup>

                {/* Price Scale */}
                <FormControl size="small">
                    <Select
                        value={priceScale}
                        onChange={(e) => handlePriceScaleChange(e.target.value)}
                        displayEmpty
                    >
                        <MenuItem value="normal">Linear</MenuItem>
                        <MenuItem value="logarithmic">Log</MenuItem>
                    </Select>
                </FormControl>

                {loading && <CircularProgress size={20} />}
            </Box>

            {/* Active Indicators */}
            {activeIndicators.length > 0 && (
                <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {activeIndicators.map((indicator) => (
                        <Chip
                            key={indicator.id}
                            label={`${indicator.type.toUpperCase()}(${Object.values(indicator.params).join(',')})`}
                            size="small"
                            onDelete={() => removeIndicator(indicator.id)}
                            color="primary"
                            variant="outlined"
                        />
                    ))}
                </Box>
            )}

            {/* Crosshair Data */}
            {crosshairData && (
                <Box sx={{ px: 2, py: 1, backgroundColor: theme.palette.action.hover }}>
                    <Typography variant="body2">
                        Time: {new Date(crosshairData.time * 1000).toLocaleString()} | 
                        O: {crosshairData.open?.toFixed(2)} | 
                        H: {crosshairData.high?.toFixed(2)} | 
                        L: {crosshairData.low?.toFixed(2)} | 
                        C: {crosshairData.close?.toFixed(2)}
                    </Typography>
                </Box>
            )}

            {/* Chart Container */}
            <Box 
                ref={chartContainerRef}
                sx={{ 
                    flex: 1,
                    minHeight: 0,
                    '& canvas': {
                        display: 'block'
                    }
                }}
            />

            {/* Indicator Settings Dialog */}
            <Dialog 
                open={indicatorDialog.open} 
                onClose={handleIndicatorDialogClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Add Indicator
                    <IconButton
                        onClick={handleIndicatorDialogClose}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <Close />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {indicatorDialog.type === 'sma' && (
                        <IndicatorSMASettings onAdd={addIndicator} />
                    )}
                </DialogContent>
            </Dialog>
        </Paper>
    );
};

// Indicator Settings Components
const IndicatorSMASettings = ({ onAdd }) => {
    const [period, setPeriod] = useState(20);
    const [color, setColor] = useState('#FF6B35');

    const handleAdd = () => {
        onAdd('sma', { period, color });
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Simple Moving Average</Typography>
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Typography gutterBottom>Period: {period}</Typography>
                    <Slider
                        value={period}
                        onChange={(e, value) => setPeriod(value)}
                        min={5}
                        max={200}
                        marks={[
                            { value: 10, label: '10' },
                            { value: 50, label: '50' },
                            { value: 100, label: '100' },
                            { value: 200, label: '200' }
                        ]}
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        label="Color"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12}>
                    <Button variant="contained" onClick={handleAdd} fullWidth>
                        Add Indicator
                    </Button>
                </Grid>
            </Grid>
        </Box>
    );
};

export default AdvancedChart;