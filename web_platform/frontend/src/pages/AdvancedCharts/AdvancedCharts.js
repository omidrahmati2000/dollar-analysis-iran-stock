import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  TextField,
  Tabs,
  Tab,
  Slider,
  FormGroup,
  FormLabel
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
  ScatterPlot,
  Delete
} from '@mui/icons-material';
import MultiPanelChartEngine from '../../components/AdvancedChart/MultiPanelChartEngine';
import DrawingTools from '../../components/AdvancedChart/DrawingTools';
import EnhancedHistoricalDataService from '../../services/EnhancedHistoricalDataService';
import benchmark from '../../utils/PerformanceBenchmark';
import AdvancedSymbolSearch from '../../components/AdvancedSymbolSearch/AdvancedSymbolSearch';

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
  const [drawingPanelOpen, setDrawingPanelOpen] = useState(false);
  const [hoverData, setHoverData] = useState(null);
  const [candleTooltip, setCandleTooltip] = useState({ visible: false, x: 0, y: 0, data: null });
  const [infiniteScrollState, setInfiniteScrollState] = useState({
    isLoadingOlder: false,
    isLoadingNewer: false,
    hasMoreOlder: true,
    hasMoreNewer: true,
    oldestCursor: null,
    newestCursor: null
  });

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
    { id: 'none', name: 'Select', icon: '🖱️', category: 'cursor' },
    { id: 'crosshair', name: 'Crosshair', icon: '✚', category: 'cursor' },
    { id: 'trendline', name: 'Trend Line', icon: '📈', category: 'lines' },
    { id: 'horizontal', name: 'Horizontal Line', icon: '➖', category: 'lines' },
    { id: 'vertical', name: 'Vertical Line', icon: '|', category: 'lines' },
    { id: 'ray', name: 'Ray', icon: '→', category: 'lines' },
    { id: 'parallel', name: 'Parallel Channel', icon: '‖', category: 'channels' },
    { id: 'rectangle', name: 'Rectangle', icon: '⬛', category: 'shapes' },
    { id: 'ellipse', name: 'Ellipse', icon: '⭕', category: 'shapes' },
    { id: 'triangle', name: 'Triangle', icon: '🔺', category: 'shapes' },
    { id: 'fibonacci-retracement', name: 'Fib Retracement', icon: '🌀', category: 'fibonacci' },
    { id: 'fibonacci-extension', name: 'Fib Extension', icon: '🌊', category: 'fibonacci' },
    { id: 'fibonacci-fan', name: 'Fib Fan', icon: '📐', category: 'fibonacci' },
    { id: 'fibonacci-arcs', name: 'Fib Arcs', icon: '🌈', category: 'fibonacci' },
    { id: 'fibonacci-timezones', name: 'Fib Time Zones', icon: '⏰', category: 'fibonacci' },
    { id: 'gann', name: 'Gann Fan', icon: '📐', category: 'gann' },
    { id: 'pitchfork', name: 'Pitchfork', icon: '🔱', category: 'pitchfork' }
  ];

  const drawingCategories = {
    cursor: 'Cursor Tools',
    lines: 'Lines',
    channels: 'Channels', 
    shapes: 'Shapes',
    fibonacci: 'Fibonacci',
    gann: 'Gann',
    pitchfork: 'Pitchfork',
    annotations: 'Annotations'
  };

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
      
      // Update drawing tools with new symbol
      if (drawingToolsRef.current) {
        drawingToolsRef.current.setSymbol(selectedSymbol);
      }
    }
  }, [selectedSymbol]);

  useEffect(() => {
    if (engineRef.current && dataServiceRef.current) {
      // Update DrawingTools context
      if (drawingToolsRef.current) {
        drawingToolsRef.current.setTimeframe(selectedTimeframe);
        drawingToolsRef.current.setDataType(adjustedData ? 'adjusted' : 'unadjusted');
      }
      
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
        
        // Make DrawingTools available globally for testing
        window.drawingToolsInstance = drawingToolsRef.current;
        
        // Set initial symbol
        if (drawingToolsRef.current && selectedSymbol) {
          drawingToolsRef.current.setSymbol(selectedSymbol);
        }
        setupChartHoverHandlers();
        console.log('✅ Drawing Tools initialized successfully');
      }, 500);
      
      // Setup infinite scroll callbacks
      if (engineRef.current) {
        console.log('🔧 Setting up infinite scroll callbacks');
        engineRef.current.onLoadOlderData = handleLoadOlderData;
        engineRef.current.onLoadNewerData = handleLoadNewerData;
        console.log('✅ Infinite scroll callbacks set successfully');
        console.log('🔗 onLoadOlderData callback:', typeof handleLoadOlderData);
      } else {
        console.error('❌ engineRef.current is null when trying to set callbacks');
      }
      
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
    
    // Reset infinite scroll state when loading new chart data
    setInfiniteScrollState({
      isLoadingOlder: false,
      isLoadingNewer: false,
      hasMoreOlder: true,
      hasMoreNewer: true,
      oldestCursor: null,
      newestCursor: null
    });
    
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
      
      // Set chart data - use the updateMainChartData method
      if (data && data.length > 0) {
        // Ensure we have a main series, create if needed
        let mainSeries = engineRef.current.getMainSeries();
        if (!mainSeries) {
          const seriesResult = engineRef.current.createCandlestickSeries('main');
          mainSeries = { seriesId: seriesResult.seriesId };
        }
        
        // Update the main chart data using correct method
        engineRef.current.updateMainChartData(data);
        
        // Re-setup infinite scroll callbacks after data update
        if (engineRef.current) {
          console.log('🔧 Re-setting infinite scroll callbacks after data load');
          engineRef.current.onLoadOlderData = handleLoadOlderData;
          engineRef.current.onLoadNewerData = handleLoadNewerData;
        }
        
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

  // Handle loading older data (scrolling left/backward)
  const handleLoadOlderData = useCallback(async (currentOldestTime) => {
    console.log('🟦 handleLoadOlderData called with time:', currentOldestTime);
    
    if (!dataServiceRef.current) {
      console.log('❌ dataServiceRef.current is null');
      return;
    }
    
    // Check loading state and start loading if possible
    let shouldProceed = false;
    setInfiniteScrollState(prev => {
      console.log('🟦 Current infinite scroll state:', prev);
      
      if (prev.isLoadingOlder) {
        console.log('⚠️ Already loading older data, skipping');
        return prev;
      }
      
      if (!prev.hasMoreOlder) {
        console.log('⚠️ No more older data available');
        return prev;
      }
      
      // Start loading
      console.log('🔄 Starting to load older data...');
      shouldProceed = true;
      return { ...prev, isLoadingOlder: true };
    });

    if (!shouldProceed) return;

    try {
      // Convert timestamp to ISO string for API
      const beforeDate = new Date(currentOldestTime * 1000).toISOString();
      
      const result = await dataServiceRef.current.getHistoricalDataPaginated(
        selectedSymbol,
        selectedTimeframe,
        {
          beforeDate: beforeDate,
          limit: 200,
          useCache: true
        }
      );

      if (result && result.data && result.data.length > 0) {
        // Prepend older data to existing chart data
        const existingData = engineRef.current.getMainChartData() || [];
        const newData = [...result.data, ...existingData];
        
        // Update chart with merged data
        engineRef.current.updateMainChartData(newData);
        
        // Update infinite scroll state
        setInfiniteScrollState(prev => ({
          ...prev,
          isLoadingOlder: false,
          hasMoreOlder: result.pagination?.has_more || false,
          oldestCursor: result.pagination?.next_cursor || null
        }));
        
        console.log('✅ Loaded', result.data.length, 'older data points');
      } else {
        setInfiniteScrollState(prev => ({
          ...prev,
          isLoadingOlder: false,
          hasMoreOlder: false
        }));
      }
    } catch (error) {
      console.error('❌ Error loading older data:', error);
      setInfiniteScrollState(prev => ({
        ...prev,
        isLoadingOlder: false
      }));
    }
  }, [selectedSymbol, selectedTimeframe]);

  // Handle loading newer data (scrolling right/forward)
  const handleLoadNewerData = useCallback(async (currentNewestTime) => {
    console.log('🟩 handleLoadNewerData called with time:', currentNewestTime);
    
    if (!dataServiceRef.current) {
      console.log('❌ dataServiceRef.current is null');
      return;
    }
    
    // Check loading state and start loading if possible
    let shouldProceed = false;
    setInfiniteScrollState(prev => {
      console.log('🟩 Current infinite scroll state:', prev);
      
      if (prev.isLoadingNewer) {
        console.log('⚠️ Already loading newer data, skipping');
        return prev;
      }
      
      if (!prev.hasMoreNewer) {
        console.log('⚠️ No more newer data available');
        return prev;
      }
      
      // Start loading
      console.log('🔄 Starting to load newer data...');
      shouldProceed = true;
      return { ...prev, isLoadingNewer: true };
    });

    if (!shouldProceed) return;

    try {
      // Convert timestamp to ISO string for API
      const afterDate = new Date(currentNewestTime * 1000).toISOString();
      
      const result = await dataServiceRef.current.getHistoricalDataPaginated(
        selectedSymbol,
        selectedTimeframe,
        {
          afterDate: afterDate,
          limit: 200,
          useCache: true
        }
      );

      if (result && result.data && result.data.length > 0) {
        // Append newer data to existing chart data
        const existingData = engineRef.current.getMainChartData() || [];
        const newData = [...existingData, ...result.data];
        
        // Update chart with merged data
        engineRef.current.updateMainChartData(newData);
        
        // Update infinite scroll state
        setInfiniteScrollState(prev => ({
          ...prev,
          isLoadingNewer: false,
          hasMoreNewer: result.pagination?.has_more || false,
          newestCursor: result.pagination?.next_cursor || null
        }));
        
        console.log('✅ Loaded', result.data.length, 'newer data points');
      } else {
        setInfiniteScrollState(prev => ({
          ...prev,
          isLoadingNewer: false,
          hasMoreNewer: false
        }));
      }
    } catch (error) {
      console.error('❌ Error loading newer data:', error);
      setInfiniteScrollState(prev => ({
        ...prev,
        isLoadingNewer: false
      }));
    }
  }, [selectedSymbol, selectedTimeframe]);

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
    
    // Auto-close the drawing panel when a tool is selected (except for 'none')
    if (mode !== 'none' && drawingPanelOpen) {
      setTimeout(() => {
        setDrawingPanelOpen(false);
      }, 300); // Small delay for better UX - user sees the selection
    }
    
    // Show visual feedback
    const tool = drawingTools.find(t => t.id === mode);
    if (tool && tool.id !== 'none') {
      console.log(`✏️ Drawing tool activated: ${tool.name}`);
      // Could add a toast notification here
    } else {
      console.log('🖱️ Selection mode activated');
    }
  };

  const handleClearAllDrawings = () => {
    if (drawingToolsRef.current) {
      drawingToolsRef.current.clearAll();
      console.log('🗑️ Cleared all drawings');
    }
  };

  const handleDeleteSelectedDrawing = () => {
    if (drawingToolsRef.current) {
      drawingToolsRef.current.deleteSelected();
      console.log('🗑️ Deleted selected drawing');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' && drawingToolsRef.current) {
        handleDeleteSelectedDrawing();
      }
      if (event.key === 'Escape' && drawingMode !== 'none') {
        handleDrawingModeChange('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingMode]);

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
  // Setup chart hover handlers for candlestick data
  const setupChartHoverHandlers = () => {
    if (!engineRef.current) return;
    
    const mainChart = engineRef.current.getMainChart();
    if (!mainChart) return;
    
    // Subscribe to crosshair move events
    mainChart.subscribeCrosshairMove((param) => {
      if (param.point && param.time) {
        const data = param.seriesData;
        const mainSeriesData = data.get(engineRef.current.getMainSeries()?.series);
        
        if (mainSeriesData && mainSeriesData.open !== undefined) {
          const tooltipData = {
            time: param.time,
            open: mainSeriesData.open,
            high: mainSeriesData.high,
            low: mainSeriesData.low,
            close: mainSeriesData.close,
            volume: mainSeriesData.volume || 0
          };
          
          setHoverData(tooltipData);
          setCandleTooltip({
            visible: true,
            x: param.point.x,
            y: param.point.y,
            data: tooltipData
          });
        }
      } else {
        setCandleTooltip(prev => ({ ...prev, visible: false }));
        setHoverData(null);
      }
    });
  };

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
            <Grid item xs={12} sm={6} md={4}>
              <AdvancedSymbolSearch
                placeholder="جستجوی سهام و ارز..."
                selectedSymbol={selectedSymbol}
                onSelect={(item, type) => {
                  const symbol = type === 'stock' ? item.symbol : item.currency_code;
                  setSelectedSymbol(symbol);
                }}
                sx={{ minWidth: 300 }}
              />
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
            
            {/* Enhanced Drawing Tools */}
            <Grid item>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Tooltip title="Drawing Tools Panel">
                  <IconButton 
                    size="small" 
                    onClick={() => setDrawingPanelOpen(!drawingPanelOpen)}
                    color={drawingPanelOpen ? 'primary' : 'default'}
                    sx={{ 
                      border: drawingPanelOpen ? '1px solid #1976d2' : 'none',
                      bgcolor: drawingPanelOpen ? 'rgba(25,118,210,0.1)' : 'transparent'
                    }}
                  >
                    <Brush />
                  </IconButton>
                </Tooltip>
                
                {/* Current Drawing Tool Status */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  px: 1,
                  py: 0.5,
                  bgcolor: drawingMode !== 'none' ? 'primary.main' : 'background.default',
                  color: drawingMode !== 'none' ? 'white' : 'text.primary',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: drawingMode !== 'none' ? 'primary.main' : 'divider'
                }}>
                  <span style={{ fontSize: '14px' }}>
                    {drawingTools.find(t => t.id === drawingMode)?.icon || '🖱️'}
                  </span>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                    {drawingTools.find(t => t.id === drawingMode)?.name || 'Select'}
                  </Typography>
                </Box>
                
                {/* Quick Access Cursor Tools */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {drawingTools.filter(t => t.category === 'cursor').map(tool => (
                    <Tooltip key={tool.id} title={tool.name}>
                      <Button
                        size="small"
                        variant={drawingMode === tool.id ? 'contained' : 'outlined'}
                        onClick={() => handleDrawingModeChange(tool.id)}
                        sx={{ 
                          minWidth: 'auto', 
                          px: 1,
                          border: drawingMode === tool.id ? '2px solid #1976d2' : '1px solid #ccc'
                        }}
                      >
                        <span style={{ fontSize: '12px' }}>{tool.icon}</span>
                      </Button>
                    </Tooltip>
                  ))}
                </Box>
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
        
        {/* Candlestick Hover Tooltip */}
        {candleTooltip.visible && candleTooltip.data && (
          <Box 
            sx={{ 
              position: 'absolute',
              left: candleTooltip.x + 15,
              top: candleTooltip.y - 10,
              bgcolor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              p: 1.5,
              borderRadius: 1,
              fontSize: '12px',
              zIndex: 1000,
              minWidth: 180,
              border: '1px solid #333',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
            }}
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Typography variant="caption" sx={{ color: '#888', gridColumn: '1 / -1' }}>
                {new Date(candleTooltip.data.time * 1000).toLocaleDateString('fa-IR')}
              </Typography>
              <Typography variant="caption">باز: <strong style={{ color: '#4ECDC4' }}>{new Intl.NumberFormat('en-US').format(candleTooltip.data.open)}</strong></Typography>
              <Typography variant="caption">بسته: <strong style={{ color: candleTooltip.data.close >= candleTooltip.data.open ? '#4CAF50' : '#F44336' }}>{new Intl.NumberFormat('en-US').format(candleTooltip.data.close)}</strong></Typography>
              <Typography variant="caption">بالا: <strong style={{ color: '#FFD700' }}>{new Intl.NumberFormat('en-US').format(candleTooltip.data.high)}</strong></Typography>
              <Typography variant="caption">پایین: <strong style={{ color: '#FF6B35' }}>{new Intl.NumberFormat('en-US').format(candleTooltip.data.low)}</strong></Typography>
              {candleTooltip.data.volume > 0 && (
                <Typography variant="caption" sx={{ gridColumn: '1 / -1' }}>حجم: <strong style={{ color: '#9C27B0' }}>{new Intl.NumberFormat('en-US').format(candleTooltip.data.volume)}</strong></Typography>
              )}
            </Box>
          </Box>
        )}

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
        
        {/* Infinite scroll loading indicators */}
        {infiniteScrollState.isLoadingOlder && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 10, 
              left: 10,
              zIndex: 1000,
              bgcolor: 'rgba(0,0,0,0.7)',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              color: 'white'
            }}
          >
            <Typography variant="caption">Loading older data...</Typography>
          </Box>
        )}
        
        {infiniteScrollState.isLoadingNewer && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 10, 
              right: 10,
              zIndex: 1000,
              bgcolor: 'rgba(0,0,0,0.7)',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              color: 'white'
            }}
          >
            <Typography variant="caption">Loading newer data...</Typography>
          </Box>
        )}
      </Box>
      
      {/* Enhanced Drawing Tools Panel - Floating Overlay */}
      <Drawer
        variant="temporary"
        anchor="right"
        open={drawingPanelOpen}
        onClose={() => setDrawingPanelOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderLeft: 1,
            borderColor: 'divider',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            backdropFilter: 'blur(10px)',
            '& .MuiBackdrop-root': {
              backgroundColor: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(4px)'
            }
          },
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)'
          }
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Modern Header */}
          <Box sx={{ 
            p: 3, 
            bgcolor: 'primary.main', 
            color: 'white',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                p: 1, 
                borderRadius: '50%', 
                bgcolor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Brush />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight="bold">Drawing Tools</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Professional Chart Analysis</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Clear All Drawings">
                <IconButton 
                  size="small" 
                  onClick={handleClearAllDrawings}
                  sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
              <IconButton 
                size="small" 
                onClick={() => setDrawingPanelOpen(false)}
                sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
              >
                ×
              </IconButton>
            </Box>
          </Box>
          
          {/* Scrollable Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          
            {/* Instructions */}
            <Card sx={{ mb: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                  🎯 راهنمای کلیدها
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem' }}>
                  • Delete: حذف رسم انتخاب شده<br/>
                  • Escape: لغو حالت رسم<br/>
                  • Click: رسم Fibonacci (2 کلیک برای Retracement، 3 کلیک برای Extension)
                </Typography>
              </CardContent>
            </Card>
          
          {Object.entries(drawingCategories).map(([categoryId, categoryName]) => {
            const categoryTools = drawingTools.filter(tool => tool.category === categoryId);
            if (categoryTools.length === 0) return null;
            
            return (
              <Card key={categoryId} sx={{ mb: 2, bgcolor: 'background.default' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main', fontWeight: 'bold' }}>
                    {categoryName}
                  </Typography>
                  
                  {/* Quick selection tip */}
                  {categoryId === 'cursor' && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', mb: 1, display: 'block' }}>
                      💡 انتخاب ابزار پنل را می‌بندد
                    </Typography>
                  )}
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    {categoryTools.map(tool => (
                      <Tooltip key={tool.id} title={`${tool.name} - کلیک کنید (پنل بسته می‌شود)`}>
                        <Button
                          size="small"
                          variant={drawingMode === tool.id ? 'contained' : 'outlined'}
                          onClick={() => handleDrawingModeChange(tool.id)}
                          sx={{ 
                            minWidth: 'auto', 
                            px: 1, 
                            py: 0.5,
                            flexDirection: 'column',
                            height: 60,
                            fontSize: '10px',
                            position: 'relative',
                            border: drawingMode === tool.id ? '2px solid #1976d2' : '1px solid #ccc',
                            bgcolor: drawingMode === tool.id ? 'primary.main' : 'background.paper',
                            color: drawingMode === tool.id ? 'white' : 'text.primary',
                            boxShadow: drawingMode === tool.id ? '0 4px 8px rgba(25,118,210,0.3)' : 'none',
                            transform: drawingMode === tool.id ? 'scale(1.05)' : 'scale(1)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'scale(1.08)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            },
                            '&:active': {
                              transform: 'scale(0.95)',
                              transition: 'all 0.1s ease'
                            }
                          }}
                        >
                          <span style={{ fontSize: '16px', marginBottom: '2px' }}>{tool.icon}</span>
                          <span style={{ fontSize: '9px' }}>{tool.name.split(' ')[0]}</span>
                          {drawingMode === tool.id && (
                            <Box sx={{
                              position: 'absolute',
                              top: -2,
                              right: -2,
                              width: 8,
                              height: 8,
                              bgcolor: 'success.main',
                              borderRadius: '50%',
                              border: '1px solid white'
                            }} />
                          )}
                        </Button>
                      </Tooltip>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Drawing Controls */}
          <Card sx={{ bgcolor: 'background.default' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'secondary.main', fontWeight: 'bold' }}>
                Controls
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" onClick={() => drawingToolsRef.current?.clearAll()}>
                  Clear All
                </Button>
                <Button size="small" variant="outlined" disabled>
                  Undo (Coming Soon)
                </Button>
                <Button size="small" variant="outlined" disabled>
                  Redo (Coming Soon)
                </Button>
              </Box>
            </CardContent>
          </Card>
          </Box>
        </Box>
      </Drawer>
      
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
      
      {/* Enhanced Indicator Configuration Dialog - TradingView Style */}
      <Dialog 
        open={indicatorConfigDialogOpen} 
        onClose={() => setIndicatorConfigDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: 'background.paper',
            minHeight: '500px'
          }
        }}
      >
        <DialogTitle sx={{ pb: 2, bgcolor: 'primary.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '50%', 
              bgcolor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {selectedIndicatorConfig?.name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Technical Analysis Indicator
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedIndicatorConfig && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3, minHeight: '400px' }}>
              {/* Parameters Section */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <Settings color="primary" />
                  Parameters
                </Typography>
                
                <Box sx={{ display: 'grid', gap: 3 }}>
                  {Object.entries(selectedIndicatorConfig.params).map(([paramName, defaultValue]) => (
                    <Card key={paramName} sx={{ p: 2, bgcolor: 'background.default' }}>
                      <FormLabel sx={{ fontWeight: 'bold', mb: 1, display: 'block', textTransform: 'capitalize' }}>
                        {paramName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </FormLabel>
                      
                      {typeof defaultValue === 'number' ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, alignItems: 'center' }}>
                          <Slider
                            value={indicatorParams[paramName] || defaultValue}
                            onChange={(e, value) => handleParamChange(paramName, value)}
                            min={paramName === 'stdDev' ? 0.1 : 1}
                            max={paramName === 'period' ? 200 : paramName === 'stdDev' ? 5 : 50}
                            step={paramName === 'stdDev' ? 0.1 : 1}
                            sx={{ minWidth: 200 }}
                          />
                          <TextField
                            type="number"
                            value={indicatorParams[paramName] || defaultValue}
                            onChange={(e) => handleParamChange(paramName, parseFloat(e.target.value))}
                            size="small"
                            sx={{ width: 80 }}
                            inputProps={{ 
                              min: paramName === 'stdDev' ? 0.1 : 1,
                              step: paramName === 'stdDev' ? 0.1 : 1,
                              max: paramName === 'period' ? 200 : undefined
                            }}
                          />
                        </Box>
                      ) : (
                        <TextField
                          fullWidth
                          value={indicatorParams[paramName] || defaultValue}
                          onChange={(e) => handleParamChange(paramName, e.target.value)}
                          size="small"
                        />
                      )}
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Default: {defaultValue} | Current: {indicatorParams[paramName] || defaultValue}
                      </Typography>
                    </Card>
                  ))}
                </Box>
              </Box>
              
              {/* Style & Preview Section */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <Brush color="secondary" />
                  Style
                </Typography>
                
                {/* Color Selection */}
                <Card sx={{ p: 2, bgcolor: 'background.default', mb: 3 }}>
                  <FormLabel sx={{ fontWeight: 'bold', mb: 2, display: 'block' }}>
                    Line Color
                  </FormLabel>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                    {['#FF6B35', '#4ECDC4', '#45B7D1', '#9B59B6', '#E74C3C', '#F39C12', '#2ECC71', '#34495E', '#FF9800', '#795548', '#9E9E9E', '#607D8B'].map(color => (
                      <Tooltip key={color} title={color}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: color,
                            borderRadius: 2,
                            cursor: 'pointer',
                            border: selectedIndicatorConfig.color === color ? '3px solid #fff' : '1px solid #ddd',
                            boxShadow: selectedIndicatorConfig.color === color ? '0 0 0 2px #1976d2' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => {
                            setSelectedIndicatorConfig(prev => ({ ...prev, color }));
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Card>
                
                {/* Preview */}
                <Card sx={{ p: 3, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Preview
                  </Typography>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#0d1421', 
                    borderRadius: 2, 
                    color: 'white',
                    textAlign: 'center',
                    minHeight: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <Typography variant="h6" sx={{ color: selectedIndicatorConfig.color, fontWeight: 'bold' }}>
                      {selectedIndicatorConfig.displayName(indicatorParams)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', mt: 1 }}>
                      Will be added to chart
                    </Typography>
                  </Box>
                </Card>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, bgcolor: 'background.default' }}>
          <Button onClick={() => setIndicatorConfigDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleIndicatorConfigConfirm}
            variant="contained"
            size="large"
            startIcon={<TrendingUp />}
            sx={{ px: 4 }}
          >
            Add Indicator
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvancedCharts;