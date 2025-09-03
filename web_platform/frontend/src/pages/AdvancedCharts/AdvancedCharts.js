import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Switch,
  FormControlLabel,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  TrendingUp,
  ShowChart,
  Timeline,
  Brush,
  Settings,
  Fullscreen,
  ZoomIn,
  ZoomOut,
  RestoreFromTrash,
  Save,
  FileDownload,
  ExpandMore,
  ExpandLess,
  CandlestickChart,
  BarChart,
  LineAxis,
  ScatterPlot
} from '@mui/icons-material';
import MultiPanelChartEngine from '../../components/AdvancedChart/MultiPanelChartEngine';
import DrawingTools from '../../components/AdvancedChart/DrawingTools';
import EnhancedHistoricalDataService from '../../services/EnhancedHistoricalDataService';
import benchmark from '../../utils/PerformanceBenchmark';

const AdvancedCharts = () => {
  const chartContainerRef = useRef(null);
  const engineRef = useRef(null);
  const drawingToolsRef = useRef(null);
  const dataServiceRef = useRef(null);
  
  const [selectedSymbol, setSelectedSymbol] = useState('فن آوا');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [chartType, setChartType] = useState('candlestick');
  const [indicators, setIndicators] = useState([]);
  const [drawingMode, setDrawingMode] = useState('none');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState({});
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [realSymbols, setRealSymbols] = useState([]);
  const [symbolQuotes, setSymbolQuotes] = useState({});
  const [symbolSearch, setSymbolSearch] = useState('');
  const [indicatorDialogOpen, setIndicatorDialogOpen] = useState(false);
  const [selectedIndicatorGroup, setSelectedIndicatorGroup] = useState('');
  const [selectedIndicatorType, setSelectedIndicatorType] = useState('');
  const [indicatorConfigDialogOpen, setIndicatorConfigDialogOpen] = useState(false);
  const [selectedIndicatorConfig, setSelectedIndicatorConfig] = useState(null);
  const [indicatorParams, setIndicatorParams] = useState({});
  const [lastChartData, setLastChartData] = useState(null);
  const [adjustedData, setAdjustedData] = useState(false); // For stocks: false = unadjusted, true = adjusted

  // Iranian stocks and currencies - will be populated from backend
  const symbols = realSymbols.length > 0 ? realSymbols : [
    // Fallback Iranian symbols (matching real backend data)
    'فن آوا', 'دریا', 'فجر', 'بمان', 'هرمز', 'ولراز', 'سپیدار', 'فبیرا', 'کلوند', 'پتروپاداش'
  ];
  
  const timeframes = [
    { value: '1m', label: '1 Minute' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1D', label: '1 Day' },
    { value: '1W', label: '1 Week' },
    { value: '1M', label: '1 Month' }
  ];
  
  const chartTypes = [
    { value: 'candlestick', label: 'Candlestick', icon: <CandlestickChart /> },
    { value: 'ohlc', label: 'OHLC Bars', icon: <BarChart /> },
    { value: 'line', label: 'Line', icon: <Timeline /> },
    { value: 'area', label: 'Area', icon: <ScatterPlot /> },
    { value: 'heikinashi', label: 'Heikin Ashi', icon: <CandlestickChart /> }
  ];
  
  const availableIndicators = {
    'Trend Indicators': [
      { 
        id: 'sma', 
        name: 'Simple Moving Average', 
        params: { period: 20 },
        displayName: (params) => `SMA(${params.period})`,
        color: '#FF6B35'
      },
      { 
        id: 'ema', 
        name: 'Exponential Moving Average', 
        params: { period: 20 },
        displayName: (params) => `EMA(${params.period})`,
        color: '#4ECDC4'
      },
      { 
        id: 'bollinger', 
        name: 'Bollinger Bands', 
        params: { period: 20, stdDev: 2 },
        displayName: (params) => `BB(${params.period},${params.stdDev})`,
        color: '#45B7D1'
      }
    ],
    'Momentum Oscillators': [
      { 
        id: 'rsi', 
        name: 'RSI', 
        params: { period: 14 },
        displayName: (params) => `RSI(${params.period})`,
        color: '#9B59B6'
      },
      { 
        id: 'macd', 
        name: 'MACD', 
        params: { fast: 12, slow: 26, signal: 9 },
        displayName: (params) => `MACD(${params.fast},${params.slow},${params.signal})`,
        color: '#E74C3C'
      },
      { 
        id: 'stochastic', 
        name: 'Stochastic', 
        params: { kPeriod: 14, dPeriod: 3 },
        displayName: (params) => `Stoch(${params.kPeriod},${params.dPeriod})`,
        color: '#F39C12'
      }
    ],
    'Volume Indicators': [
      { 
        id: 'volume', 
        name: 'Volume', 
        params: {},
        displayName: () => 'Volume',
        color: '#27AE60'
      }
    ]
  };
  
  const drawingTools = [
    { id: 'none', name: 'Select', icon: '🖱️' },
    { id: 'trendline', name: 'Trend Line', icon: '📈' },
    { id: 'horizontal', name: 'Horizontal Line', icon: '➖' },
    { id: 'vertical', name: 'Vertical Line', icon: '|' },
    { id: 'rectangle', name: 'Rectangle', icon: '⬛' },
    { id: 'fibonacci', name: 'Fibonacci', icon: '🌀' },
    { id: 'text', name: 'Text', icon: '📝' }
  ];

  useEffect(() => {
    initializeChart();
    loadRealSymbols(); // Load real symbols from backend
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    // Load quotes for current symbol
    if (selectedSymbol) {
      loadSymbolQuote(selectedSymbol);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    if (engineRef.current && dataServiceRef.current) {
      // Debounce chart data loading
      const timeoutId = setTimeout(() => {
        loadChartData();
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedSymbol, selectedTimeframe, adjustedData]);

  // Load real symbols from backend
  const loadRealSymbols = async () => {
    try {
      
      // Fetch both stocks and currencies
      const [stocksResponse, currenciesResponse] = await Promise.all([
        fetch('http://localhost:8000/api/v2/stocks?limit=20'),
        fetch('http://localhost:8000/api/v2/currencies?limit=10')
      ]);

      const realSymbolsList = [];

      if (stocksResponse.ok) {
        const stocks = await stocksResponse.json();
        stocks.forEach(stock => {
          realSymbolsList.push({
            symbol: stock.symbol,
            name: stock.company_name,
            type: 'stock',
            price: stock.last_price,
            change: stock.price_change,
            changePercent: stock.price_change_percent
          });
        });
      }

      if (currenciesResponse.ok) {
        const currencies = await currenciesResponse.json();
        currencies.forEach(currency => {
          realSymbolsList.push({
            symbol: currency.currency_code,
            name: currency.currency_name_fa || currency.currency_name,
            type: 'currency',
            price: currency.price_irr,
            change: currency.change_24h,
            changePercent: currency.change_percent_24h
          });
        });
      }

      setRealSymbols(realSymbolsList.map(s => s.symbol));
      
      // Store quotes for quick access
      const quotes = {};
      realSymbolsList.forEach(item => {
        quotes[item.symbol] = item;
      });
      setSymbolQuotes(quotes);
      
      // Set the first available symbol as selected if current symbol is not available
      if (realSymbolsList.length > 0 && !realSymbolsList.find(s => s.symbol === selectedSymbol)) {
        setSelectedSymbol(realSymbolsList[0].symbol);
      }
      
      
    } catch (error) {
    }
  };

  // Load quote data for a specific symbol
  const loadSymbolQuote = async (symbol) => {
    // Don't load individual quotes since we already have them from the bulk load
    // The quotes are loaded in loadRealSymbols() which provides all the data we need
    const existingQuote = symbolQuotes[symbol];
    if (existingQuote) {
    } else {
    }
  };

  const initializeChart = async () => {
    if (!chartContainerRef.current) return;
    
    benchmark.start('chart-initialization');
    
    try {
      // Cleanup existing engine if it exists
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      
      // Clear container to remove any leftover elements
      chartContainerRef.current.innerHTML = '';
      
      // Initialize data service
      dataServiceRef.current = EnhancedHistoricalDataService;
      
      // Initialize chart engine with minimal options for faster startup
      engineRef.current = new MultiPanelChartEngine(chartContainerRef.current, {
        theme: 'dark',
        layout: {
          backgroundColor: '#161B22',
          textColor: '#F0F6FC',
          fontSize: 12,
          fontFamily: 'Segoe UI, Roboto, sans-serif'
        },
        grid: {
          vertLines: { color: '#30363d' },
          horzLines: { color: '#30363d' }
        },
        crosshair: {
          mode: 1,
          vertLine: { color: '#8B949E', width: 1, style: 2 },
          horzLine: { color: '#8B949E', width: 1, style: 2 }
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#30363d'
        },
        rightPriceScale: {
          borderColor: '#30363d'
        }
      });

      // Initialize drawing tools lazily
      setTimeout(() => {
        drawingToolsRef.current = new DrawingTools(engineRef.current);
      }, 500);
      
      // Load initial data with delay for smoother UI
      setTimeout(() => {
        loadChartData();
        benchmark.end('chart-initialization', 2000);
        benchmark.getMemoryUsage();
      }, 100);
      
    } catch (error) {
      benchmark.end('chart-initialization');
    }
  };

  const loadChartData = async () => {
    if (!dataServiceRef.current || !engineRef.current) return;
    
    // Throttling: prevent too frequent loads
    const now = Date.now();
    if (now - lastLoadTime < 1000) { // Minimum 1 second between loads
      return;
    }
    
    // Prevent multiple concurrent loads
    if (isLoading) return;
    
    benchmark.start('data-loading');
    setIsLoading(true);
    setLastLoadTime(now);
    try {
      // Get historical data - limit to reasonable range based on timeframe
      const endTime = Date.now();
      let dataRange;
      
      // Set appropriate data range based on timeframe to prevent performance issues
      switch (selectedTimeframe) {
        case '1m':
        case '5m':
        case '15m':
          dataRange = 7 * 24 * 60 * 60 * 1000; // 1 week for minute data
          break;
        case '1h':
        case '4h':
          dataRange = 30 * 24 * 60 * 60 * 1000; // 1 month for hourly data
          break;
        case '1D':
          dataRange = 365 * 24 * 60 * 60 * 1000; // 1 year for daily data
          break;
        case '1W':
          dataRange = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years for weekly data
          break;
        case '1M':
          dataRange = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years for monthly data
          break;
        default:
          dataRange = 30 * 24 * 60 * 60 * 1000; // Default to 1 month
      }
      
      const startTime = endTime - dataRange;
      
      const data = await dataServiceRef.current.getHistoricalData(
        selectedSymbol,
        selectedTimeframe,
        startTime,
        endTime,
        { adjusted: adjustedData }
      );
      
      // Set chart data - use the updateMainData method we added
      if (data && data.length > 0) {
        // Ensure we have a main series, create if needed
        let mainSeries = engineRef.current.getMainSeries();
        if (!mainSeries) {
          // Create initial candlestick series for main panel
          const seriesResult = engineRef.current.createCandlestickSeries('main');
          mainSeries = { seriesId: seriesResult.seriesId };
        }
        
        // Update the main chart data
        engineRef.current.updateMainData(data);
        
        // Save last data point for Live Quote display
        if (data.length > 0) {
          const lastCandle = data[data.length - 1];
          setLastChartData(lastCandle);
        }
        
      } else {
      }
      
      // Apply active indicators
      for (const indicator of indicators) {
        await addIndicator(indicator);
      }
      
      benchmark.end('data-loading', 3000);
      benchmark.getMemoryUsage();
      
    } catch (error) {
      benchmark.end('data-loading');
    } finally {
      setIsLoading(false);
    }
  };

  const addIndicator = async (indicatorConfig) => {
    if (!dataServiceRef.current || !engineRef.current) {
      return;
    }
    
    try {
      // Skip calculation if indicator already exists
      const existingIndicator = indicators.find(ind => 
        ind.id === indicatorConfig.id && 
        JSON.stringify(ind.params) === JSON.stringify(indicatorConfig.params)
      );
      if (existingIndicator) return;
      
      const data = engineRef.current.getData();
      if (!data || data.length === 0) {
        return;
      }
      
      // Only calculate if data has reasonable amount of points
      if (data.length < 20) {
        return;
      }
      
      
      const indicatorData = await dataServiceRef.current.calculateAdvancedIndicators(
        data,
        [indicatorConfig]
      );
      
      if (!indicatorData || !indicatorData[indicatorConfig.id]) {
        return;
      }
      
      const indicatorSeries = engineRef.current.addIndicator(indicatorConfig.id, indicatorData[indicatorConfig.id], {
        ...indicatorConfig,
        overlay: ['sma', 'ema', 'bollinger', 'vwap'].includes(indicatorConfig.id),
        color: indicatorConfig.color
      });
      
      
    } catch (error) {
    }
  };

  const handleIndicatorAdd = async (indicator) => {
    const newIndicators = [...indicators, indicator];
    setIndicators(newIndicators);
    await addIndicator(indicator);
  };

  const handleIndicatorRemove = (indicatorId) => {
    const newIndicators = indicators.filter(ind => ind.id !== indicatorId);
    setIndicators(newIndicators);
    
    if (engineRef.current) {
      engineRef.current.removeIndicator(indicatorId);
    }
  };

  const handleChartTypeChange = (newType) => {
    setChartType(newType);
    if (engineRef.current) {
      engineRef.current.setChartType(newType);
    }
  };

  const handleDrawingModeChange = (mode) => {
    setDrawingMode(mode);
    if (drawingToolsRef.current) {
      drawingToolsRef.current.setActiveTool(mode);
    }
  };

  // New indicator configuration functions
  const handleIndicatorSelect = (indicatorGroup, indicatorType) => {
    const allIndicators = Object.values(availableIndicators).flat();
    const indicatorConfig = allIndicators.find(ind => ind.id === indicatorType);
    
    if (indicatorConfig) {
      setSelectedIndicatorConfig(indicatorConfig);
      setIndicatorParams({ ...indicatorConfig.params });
      setIndicatorDialogOpen(false);
      setIndicatorConfigDialogOpen(true);
    }
  };

  const handleIndicatorConfigConfirm = async () => {
    if (!selectedIndicatorConfig) return;
    
    const indicator = {
      ...selectedIndicatorConfig,
      params: indicatorParams,
      displayName: selectedIndicatorConfig.displayName(indicatorParams)
    };
    
    await handleIndicatorAdd(indicator);
    setIndicatorConfigDialogOpen(false);
    setSelectedIndicatorConfig(null);
    setIndicatorParams({});
  };

  const handleParamChange = (paramName, value) => {
    setIndicatorParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleZoom = (direction) => {
    if (engineRef.current) {
      const timeScale = engineRef.current.getMainChart().timeScale();
      const visibleRange = timeScale.getVisibleRange();
      const center = (visibleRange.from + visibleRange.to) / 2;
      const range = visibleRange.to - visibleRange.from;
      const newRange = direction === 'in' ? range * 0.8 : range * 1.2;
      
      timeScale.setVisibleRange({
        from: center - newRange / 2,
        to: center + newRange / 2
      });
    }
  };

  const handleSaveChart = () => {
    if (engineRef.current && drawingToolsRef.current) {
      const chartState = {
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        chartType,
        indicators,
        drawings: drawingToolsRef.current.exportDrawings()
      };
      
      localStorage.setItem(`chart_${selectedSymbol}_${selectedTimeframe}`, JSON.stringify(chartState));
    }
  };

  const handleExportChart = () => {
    if (engineRef.current) {
      const canvas = chartContainerRef.current.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `${selectedSymbol}_${selectedTimeframe}_chart.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    }
  };

  // Memory cleanup function
  const cleanupMemory = () => {
    // Clear indicators to free memory
    if (indicators.length > 5) {
      const newIndicators = indicators.slice(-3); // Keep only last 3 indicators
      setIndicators(newIndicators);
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  };

  // Run cleanup every 30 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupMemory, 30000);
    return () => clearInterval(cleanupInterval);
  }, [indicators]);

  return (
    <Box sx={{ 
      height: 'calc(100vh - 64px)', // Subtract header height 
      display: 'flex', 
      bgcolor: 'background.default'
    }}>
      {/* Main Chart Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Toolbar */}
        <Paper sx={{ p: 0.5, borderRadius: 0, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }} data-testid="chart-toolbar">
          <Grid container spacing={1} alignItems="center">
            <Grid item>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Symbol</InputLabel>
                <Select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  label="Symbol"
                  renderValue={(selected) => {
                    const quote = symbolQuotes[selected];
                    if (quote) {
                      const changeColor = (quote.change || 0) >= 0 ? '#4caf50' : '#f44336';
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold">{selected}</Typography>
                          <Typography variant="caption" sx={{ color: changeColor }}>
                            {quote.price?.toLocaleString()}
                            {quote.changePercent && ` (${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`}
                          </Typography>
                        </Box>
                      );
                    }
                    return selected;
                  }}
                >
                  {symbols.map(symbol => {
                    const quote = symbolQuotes[symbol];
                    const changeColor = (quote?.change || 0) >= 0 ? '#4caf50' : '#f44336';
                    return (
                      <MenuItem key={symbol} value={symbol}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <Typography variant="body2" fontWeight="bold">{symbol}</Typography>
                            {quote && (
                              <Typography variant="caption" sx={{ color: changeColor }}>
                                {quote.price?.toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                          {quote && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {quote.name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ color: changeColor }}>
                                  {quote.changePercent ? `${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : ''}
                                </Typography>
                                <Chip 
                                  size="small" 
                                  label={quote.type === 'stock' ? 'سهام' : 'ارز'} 
                                  sx={{ 
                                    height: 16, 
                                    fontSize: '0.6rem',
                                    bgcolor: quote.type === 'stock' ? '#1976d2' : '#ff9800',
                                    color: 'white'
                                  }} 
                                />
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Timeframe</InputLabel>
                <Select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  label="Timeframe"
                >
                  {timeframes.map(tf => (
                    <MenuItem key={tf.value} value={tf.value}>{tf.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {chartTypes.map(type => (
                  <Tooltip key={type.value} title={type.label}>
                    <IconButton
                      size="small"
                      onClick={() => handleChartTypeChange(type.value)}
                      color={chartType === type.value ? 'primary' : 'default'}
                    >
                      {type.icon}
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            </Grid>
            
            {/* Live Quote Display */}
            <Grid item>
              <Card sx={{ bgcolor: 'background.default', border: 1, borderColor: 'divider', minWidth: 200 }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Last Data</Typography>
                      <Chip 
                        size="small" 
                        label={symbolQuotes[selectedSymbol]?.type === 'stock' ? 'سهام' : 
                               symbolQuotes[selectedSymbol]?.type === 'currency' ? 'ارز' : 'داده'} 
                        sx={{ 
                          height: 16, 
                          fontSize: '0.6rem',
                          bgcolor: symbolQuotes[selectedSymbol]?.type === 'stock' ? '#1976d2' : 
                                  symbolQuotes[selectedSymbol]?.type === 'currency' ? '#ff9800' : '#666',
                          color: 'white'
                        }} 
                      />
                    </Box>
                    <Typography variant="h6" fontWeight="bold">
                      {lastChartData?.close?.toLocaleString() || symbolQuotes[selectedSymbol]?.price?.toLocaleString() || 'Loading...'} ریال
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {lastChartData && (
                        <>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: (lastChartData.close - lastChartData.open) >= 0 ? '#4caf50' : '#f44336',
                              fontWeight: 'bold'
                            }}
                          >
                            {((lastChartData.close - lastChartData.open) / lastChartData.open * 100).toFixed(2)}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {lastChartData.close - lastChartData.open > 0 ? '+' : ''}{(lastChartData.close - lastChartData.open).toLocaleString()}
                          </Typography>
                        </>
                      )}
                      {!lastChartData && symbolQuotes[selectedSymbol] && (
                        <>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: (symbolQuotes[selectedSymbol]?.change || 0) >= 0 ? '#4caf50' : '#f44336',
                              fontWeight: 'bold'
                            }}
                          >
                            {symbolQuotes[selectedSymbol]?.changePercent 
                              ? `${symbolQuotes[selectedSymbol].changePercent > 0 ? '+' : ''}${symbolQuotes[selectedSymbol].changePercent.toFixed(2)}%`
                              : 'N/A'
                            }
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {symbolQuotes[selectedSymbol]?.change 
                              ? `${symbolQuotes[selectedSymbol].change > 0 ? '+' : ''}${symbolQuotes[selectedSymbol].change.toLocaleString()}`
                              : ''
                            }
                          </Typography>
                        </>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {symbolQuotes[selectedSymbol]?.name || selectedSymbol}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item sx={{ flexGrow: 1 }} />
            
            {/* Data Adjustment Toggle - Only for Stocks */}
            {symbolQuotes[selectedSymbol]?.type === 'stock' && (
              <Grid item>
                <FormControlLabel
                  control={
                    <Switch
                      checked={adjustedData}
                      onChange={(e) => setAdjustedData(e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                      {adjustedData ? 'تعدیل شده' : 'تعدیل نشده'}
                    </Typography>
                  }
                  labelPlacement="start"
                />
              </Grid>
            )}
            
            <Grid item>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Zoom In">
                  <IconButton size="small" onClick={() => handleZoom('in')}>
                    <ZoomIn />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Zoom Out">
                  <IconButton size="small" onClick={() => handleZoom('out')}>
                    <ZoomOut />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Save Chart">
                  <IconButton size="small" onClick={handleSaveChart}>
                    <Save />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Export Chart">
                  <IconButton size="small" onClick={handleExportChart}>
                    <FileDownload />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Settings">
                  <IconButton size="small" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    <Settings />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
            
            {/* Drawing Tools - Moved inline */}
            <Grid item>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 400 }}>
                {drawingTools.slice(0, 4).map(tool => (
                  <Button
                    key={tool.id}
                    size="small"
                    variant={drawingMode === tool.id ? 'contained' : 'outlined'}
                    onClick={() => handleDrawingModeChange(tool.id)}
                    sx={{ minWidth: 'auto', px: 1 }}
                  >
                    <span style={{ fontSize: '12px' }}>{tool.icon}</span>
                  </Button>
                ))}
              </Box>
            </Grid>
          </Grid>
          
          {/* Active Indicators - Inline to save space */}
          {indicators.length > 0 && (
            <Grid item xs={12} sx={{ pt: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {indicators.map(indicator => (
                  <Chip
                    key={indicator.id}
                    label={indicator.name}
                    size="small"
                    onDelete={() => handleIndicatorRemove(indicator.id)}
                    color="primary"
                    variant="outlined"
                    sx={{ height: 24, fontSize: '0.75rem' }}
                  />
                ))}
              </Box>
            </Grid>
          )}
        </Paper>
        
        {/* Chart Container */}
        <Box 
          ref={chartContainerRef} 
          sx={{ 
            flexGrow: 1,
            minHeight: 0,
            position: 'relative',
            bgcolor: 'background.default',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            '& > div': {
              flex: '1',
              height: '100% !important',
              minHeight: 0
            }
          }}
        />
        
        {isLoading && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              bgcolor: 'background.paper',
              p: 2,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider'
            }}
          >
            <Typography>Loading chart data...</Typography>
          </Box>
        )}
      </Box>
      
      {/* Right Sidebar - Indicators Panel */}
      <Drawer
        variant="persistent"
        anchor="right"
        open={sidebarOpen}
        sx={{
          width: sidebarOpen ? 300 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 300,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderLeft: 1,
            borderColor: 'divider',
            position: 'relative',
            height: '100%'
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Technical Indicators
          </Typography>
          
          {Object.entries(availableIndicators).map(([category, categoryIndicators]) => (
            <Card key={category} sx={{ mb: 2, bgcolor: 'background.default' }}>
              <CardContent sx={{ p: 2 }}>
                <Button
                  fullWidth
                  onClick={() => setIndicatorPanelOpen(prev => ({
                    ...prev,
                    [category]: !prev[category]
                  }))}
                  endIcon={indicatorPanelOpen[category] ? <ExpandLess /> : <ExpandMore />}
                  sx={{ justifyContent: 'space-between', mb: 1 }}
                >
                  <Typography variant="subtitle2">{category}</Typography>
                </Button>
                
                <Collapse in={indicatorPanelOpen[category]}>
                  <List dense>
                    {categoryIndicators.map(indicator => (
                      <ListItem
                        key={indicator.id}
                        button
                        onClick={() => handleIndicatorSelect(category, indicator.id)}
                        data-testid={`indicator-${indicator.id}`}
                        disabled={indicators.some(ind => ind.id === indicator.id)}
                      >
                        <ListItemIcon>
                          <TrendingUp fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={indicator.name}
                          primaryTypographyProps={{ fontSize: '0.875rem' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Drawer>
      
      {/* Indicator Configuration Dialog - TradingView Style */}
      <Dialog 
        open={indicatorConfigDialogOpen} 
        onClose={() => setIndicatorConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            <Typography variant="h6">
              Configure {selectedIndicatorConfig?.name}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {selectedIndicatorConfig && Object.entries(selectedIndicatorConfig.params).map(([paramName, defaultValue]) => (
              <Box key={paramName} sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  {paramName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Typography>
                {typeof defaultValue === 'number' ? (
                  <TextField
                    fullWidth
                    type="number"
                    value={indicatorParams[paramName] || defaultValue}
                    onChange={(e) => handleParamChange(paramName, parseFloat(e.target.value))}
                    size="small"
                    inputProps={{ 
                      min: paramName === 'stdDev' ? 0.1 : 1,
                      step: paramName === 'stdDev' ? 0.1 : 1,
                      max: paramName === 'period' ? 200 : undefined
                    }}
                  />
                ) : typeof defaultValue === 'string' ? (
                  <TextField
                    fullWidth
                    value={indicatorParams[paramName] || defaultValue}
                    onChange={(e) => handleParamChange(paramName, e.target.value)}
                    size="small"
                  />
                ) : (
                  <TextField
                    fullWidth
                    value={indicatorParams[paramName] || defaultValue}
                    onChange={(e) => handleParamChange(paramName, e.target.value)}
                    size="small"
                  />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Default: {defaultValue}
                </Typography>
              </Box>
            ))}
            
            {/* Color Selection */}
            {selectedIndicatorConfig && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Line Color
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {['#FF6B35', '#4ECDC4', '#45B7D1', '#9B59B6', '#E74C3C', '#F39C12', '#2ECC71', '#34495E'].map(color => (
                    <Box
                      key={color}
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: color,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: selectedIndicatorConfig.color === color ? '3px solid #fff' : '2px solid #ddd',
                        boxShadow: selectedIndicatorConfig.color === color ? '0 0 0 2px #1976d2' : 'none'
                      }}
                      onClick={() => {
                        setSelectedIndicatorConfig(prev => ({ ...prev, color }));
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Preview */}
            {selectedIndicatorConfig && (
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview:
                </Typography>
                <Typography variant="body1" sx={{ color: selectedIndicatorConfig.color, fontWeight: 'bold' }}>
                  {selectedIndicatorConfig.displayName(indicatorParams)}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIndicatorConfigDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleIndicatorConfigConfirm}
            variant="contained"
            startIcon={<TrendingUp />}
          >
            Add Indicator
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvancedCharts;