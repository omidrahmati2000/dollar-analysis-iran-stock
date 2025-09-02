import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Tabs,
  Tab,
  TextField,
  Autocomplete,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Fullscreen,
  Add as AddIcon,
  Remove as RemoveIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  ShowChart,
  BarChart,
  TrendingUp,
  Save,
  Share,
  Refresh
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import stockRepository from '../../services/repositories/StockRepository';
import marketDataService from '../../services/MarketDataService';
import localStorageManager from '../../services/storage/LocalStorageManager';
// Temporarily disable complex components until npm install completes
// import { ChartTypes } from '../../components/Charts/ChartTypes';
// import TechnicalIndicators from '../../components/Charts/TechnicalIndicators';

const TIMEFRAMES = [
  { value: '1m', label: '1M' },
  { value: '5m', label: '5M' },
  { value: '15m', label: '15M' },
  { value: '30m', label: '30M' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' }
];

const INDICATORS = [
  { type: 'sma', name: 'SMA', category: 'Moving Averages' },
  { type: 'ema', name: 'EMA', category: 'Moving Averages' },
  { type: 'rsi', name: 'RSI', category: 'Oscillators' },
  { type: 'macd', name: 'MACD', category: 'Oscillators' },
  { type: 'bollinger_bands', name: 'Bollinger Bands', category: 'Volatility' }
];

const Charts = () => {
  const { symbol: urlSymbol } = useParams();
  
  const [selectedSymbol, setSelectedSymbol] = useState(urlSymbol || 'USD');
  const [timeframe, setTimeframe] = useState('1d');
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [showVolume, setShowVolume] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [priceData, setPriceData] = useState(null);
  const [indicatorData, setIndicatorData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [chartType, setChartType] = useState('candlestick');
  const [watchlist, setWatchlist] = useState([]);
  
  const chartRef = useRef(null);

  // Load saved preferences from LocalStorage
  useEffect(() => {
    const loadPreferences = () => {
      const savedChart = localStorageManager.getItem('chart_preferences', {
        timeframe: '1d',
        activeIndicators: [],
        showVolume: true,
        chartType: 'candlestick'
      });
      
      setTimeframe(savedChart.timeframe);
      setActiveIndicators(savedChart.activeIndicators);
      setShowVolume(savedChart.showVolume);
      setChartType(savedChart.chartType);
      
      // Load watchlist
      const savedWatchlist = localStorageManager.getItem('watchlist', []);
      setWatchlist(savedWatchlist);
    };
    
    loadPreferences();
  }, []);

  // Save preferences to LocalStorage
  useEffect(() => {
    const chartPreferences = {
      timeframe,
      activeIndicators,
      showVolume,
      chartType
    };
    localStorageManager.setItem('chart_preferences', chartPreferences);
  }, [timeframe, activeIndicators, showVolume, chartType]);

  // Load stocks list
  useEffect(() => {
    const loadStocks = async () => {
      try {
        setLoading(true);
        const stocksList = await stockRepository.getAllStocks();
        setStocks(stocksList);
        
        // If no symbol selected, pick the first one
        if (!selectedSymbol && stocksList.length > 0) {
          setSelectedSymbol(stocksList[0].symbol);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading stocks:', err);
        setError('Failed to load stocks list');
      } finally {
        setLoading(false);
      }
    };
    
    loadStocks();
  }, [selectedSymbol]);

  // Load price data and current price
  useEffect(() => {
    if (!selectedSymbol) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load historical data
        const historyData = await stockRepository.getOHLCVData(selectedSymbol, {
          timeframe: timeframe,
          limit: 500
        });
        setPriceData(historyData);
        
        // Get current price
        const currentData = await stockRepository.getStock(selectedSymbol);
        setCurrentPrice(currentData);
        
        setError(null);
      } catch (err) {
        console.error('Error loading price data:', err);
        setError('Failed to load price data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [selectedSymbol, timeframe]);

  // Calculate technical indicators - temporarily disabled
  useEffect(() => {
    if (!priceData || activeIndicators.length === 0) {
      setIndicatorData(null);
      return;
    }
    
    // Simple fallback indicators calculation
    const calculateIndicators = async () => {
      try {
        const results = {};
        
        // Simple SMA calculation as fallback
        if (activeIndicators.some(ind => ind.type === 'sma')) {
          const period = 20;
          const smaValues = [];
          for (let i = period - 1; i < priceData.length; i++) {
            const sum = priceData.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + curr.close, 0);
            smaValues.push({
              timestamp: priceData[i].timestamp,
              value: sum / period
            });
          }
          results.sma = { values: smaValues, period };
        }
        
        setIndicatorData(results);
      } catch (err) {
        console.error('Error calculating indicators:', err);
      }
    };
    
    calculateIndicators();
  }, [priceData, activeIndicators]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    if (!selectedSymbol) return;
    
    const interval = setInterval(async () => {
      try {
        const currentData = await stockRepository.getStock(selectedSymbol);
        setCurrentPrice(currentData);
        
        // Update price data for current timeframe
        const historyData = await stockRepository.getOHLCVData(selectedSymbol, {
          timeframe: timeframe,
          limit: 500
        });
        setPriceData(historyData);
      } catch (err) {
        console.error('Error refreshing data:', err);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [selectedSymbol, timeframe]);

  const addIndicator = (indicatorType) => {
    if (!activeIndicators.find(i => i.type === indicatorType)) {
      const indicator = INDICATORS.find(i => i.type === indicatorType);
      setActiveIndicators([...activeIndicators, {
        type: indicatorType,
        name: indicator.name,
        config: getDefaultConfig(indicatorType)
      }]);
    }
  };

  const removeIndicator = (indicatorType) => {
    setActiveIndicators(activeIndicators.filter(i => i.type !== indicatorType));
  };

  const getDefaultConfig = (indicatorType) => {
    switch (indicatorType) {
      case 'sma':
      case 'ema':
        return { period: 20 };
      case 'rsi':
        return { period: 14, overbought: 70, oversold: 30 };
      case 'macd':
        return { fast_period: 12, slow_period: 26, signal_period: 9 };
      case 'bollinger_bands':
        return { period: 20, std_dev: 2.0 };
      default:
        return {};
    }
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return new Intl.NumberFormat('en-US').format(price);
  };
  
  const formatPercent = (percent) => {
    if (percent === null || percent === undefined) return '—';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };
  
  const refreshData = async () => {
    if (!selectedSymbol) return;
    
    try {
      setLoading(true);
      
      // Load historical data
      const historyData = await stockRepository.getOHLCVData(selectedSymbol, {
        timeframe: timeframe,
        limit: 500
      });
      setPriceData(historyData);
      
      // Get current price
      const currentData = await stockRepository.getStock(selectedSymbol);
      setCurrentPrice(currentData);
      
      setError(null);
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = () => {
    if (selectedSymbol && !watchlist.includes(selectedSymbol)) {
      const newWatchlist = [...watchlist, selectedSymbol];
      setWatchlist(newWatchlist);
      localStorageManager.setItem('watchlist', newWatchlist);
    }
  };
  
  const removeFromWatchlist = () => {
    const newWatchlist = watchlist.filter(symbol => symbol !== selectedSymbol);
    setWatchlist(newWatchlist);
    localStorageManager.setItem('watchlist', newWatchlist);
  };
  
  const isInWatchlist = watchlist.includes(selectedSymbol);
  
  const saveChartLayout = () => {
    const layout = {
      symbol: selectedSymbol,
      timeframe,
      chartType,
      activeIndicators,
      showVolume,
      timestamp: Date.now()
    };
    
    const savedLayouts = localStorageManager.getItem('saved_chart_layouts', []);
    const newLayouts = [layout, ...savedLayouts.slice(0, 9)]; // Keep only 10 recent layouts
    localStorageManager.setItem('saved_chart_layouts', newLayouts);
    
    alert('Chart layout saved!');
  };
  
  const exportChartData = () => {
    if (!priceData) return;
    
    const exportData = {
      symbol: selectedSymbol,
      timeframe,
      priceData,
      indicatorData,
      timestamp: Date.now()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${selectedSymbol}_${timeframe}_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const chartData = useMemo(() => {
    if (!priceData || !priceData.length) return null;
    
    // Transform data for D3.js ChartTypes component
    const transformedData = priceData.map(item => ({
      date: new Date(item.timestamp),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume || 0
    }));
    
    return transformedData;
  }, [priceData]);
  
  const renderChart = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
          <CircularProgress />
          <Typography color="text.secondary">Loading chart data...</Typography>
        </Box>
      );
    }
    
    if (error) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button onClick={refreshData} startIcon={<Refresh />} variant="contained">
            Retry
          </Button>
        </Box>
      );
    }
    
    if (!chartData) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography color="text.secondary">No chart data available</Typography>
        </Box>
      );
    }
    
    // Temporary simple chart placeholder
    return (
      <Box sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: '#0D1117',
        color: '#F0F6FC',
        p: 2
      }}>
        <Typography variant="h6" gutterBottom>
          {selectedSymbol} - {timeframe.toUpperCase()} Chart ({chartType})
        </Typography>
        
        {/* Chart Data Summary */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Data Points: {chartData.length} | 
            Latest Price: {formatPrice(chartData[chartData.length - 1]?.close)} |
            High: {formatPrice(Math.max(...chartData.map(d => d.high)))} |
            Low: {formatPrice(Math.min(...chartData.map(d => d.low)))}
          </Typography>
        </Box>
        
        {/* Simple SVG Chart */}
        <Box sx={{ 
          flexGrow: 1, 
          bgcolor: '#161B22',
          borderRadius: 1,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="100%" height="400" viewBox="0 0 800 400" style={{ border: '1px solid #30363D' }}>
            {/* Price line */}
            <polyline
              points={chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 780 + 10;
                const minPrice = Math.min(...chartData.map(d => d.close));
                const maxPrice = Math.max(...chartData.map(d => d.close));
                const y = 380 - ((d.close - minPrice) / (maxPrice - minPrice)) * 360;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="#26a69a"
              strokeWidth="2"
            />
            
            {/* Axes */}
            <line x1="10" y1="10" x2="10" y2="390" stroke="#30363D" strokeWidth="1" />
            <line x1="10" y1="390" x2="790" y2="390" stroke="#30363D" strokeWidth="1" />
            
            {/* Chart Title */}
            <text x="400" y="30" textAnchor="middle" fill="#F0F6FC" fontSize="14">
              Price Chart - {selectedSymbol}
            </text>
          </svg>
        </Box>
        
        {/* Volume Chart */}
        {showVolume && (
          <Box sx={{ 
            height: 100,
            bgcolor: '#161B22',
            borderRadius: 1,
            mt: 1,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="100%" height="80" viewBox="0 0 800 80" style={{ border: '1px solid #30363D' }}>
              {/* Volume bars */}
              {chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 780 + 10;
                const maxVolume = Math.max(...chartData.map(d => d.volume));
                const barHeight = (d.volume / maxVolume) * 70;
                const color = d.close >= d.open ? '#26a69a' : '#ef5350';
                return (
                  <rect
                    key={i}
                    x={x - 1}
                    y={75 - barHeight}
                    width="2"
                    height={barHeight}
                    fill={color}
                    opacity="0.7"
                  />
                );
              })}
              
              {/* Volume Title */}
              <text x="400" y="15" textAnchor="middle" fill="#F0F6FC" fontSize="12">
                Volume
              </text>
            </svg>
          </Box>
        )}
      </Box>
    );
  };

  const tabs = [
    { label: 'Chart', icon: <ShowChart /> },
    { label: 'Analysis', icon: <BarChart /> },
    { label: 'Screener', icon: <TrendingUp /> },
    { label: 'Watchlist', icon: <TimelineIcon /> }
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Symbol selector */}
          <Autocomplete
            value={selectedSymbol}
            onChange={(event, newValue) => setSelectedSymbol(newValue)}
            options={stocks.map(stock => stock.symbol)}
            getOptionLabel={(option) => {
              const stock = stocks.find(s => s.symbol === option);
              return stock ? `${stock.symbol} - ${stock.company_name}` : option;
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Symbol"
                variant="outlined"
                size="small"
                sx={{ minWidth: 300 }}
              />
            )}
            sx={{ mr: 2 }}
          />
          
          {currentPrice && (
            <Box>
              <Typography 
                variant="h6" 
                color={currentPrice.price_change >= 0 ? 'success.main' : 'error.main'}
                fontWeight="bold"
              >
                {formatPrice(currentPrice.last_price)}
              </Typography>
              <Typography 
                variant="body2"
                color={currentPrice.price_change >= 0 ? 'success.main' : 'error.main'}
              >
                {formatPercent(currentPrice.price_change_percent)}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Chart type selector */}
          <FormControl size="small">
            <InputLabel>Chart Type</InputLabel>
            <Select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="candlestick">Candlestick</MenuItem>
              <MenuItem value="line">Line</MenuItem>
              <MenuItem value="area">Area</MenuItem>
              <MenuItem value="heikin_ashi">Heikin Ashi</MenuItem>
              <MenuItem value="renko">Renko</MenuItem>
            </Select>
          </FormControl>
          
          {/* Timeframe selector */}
          <FormControl size="small">
            <Select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              sx={{ minWidth: 80 }}
            >
              {TIMEFRAMES.map((tf) => (
                <MenuItem key={tf.value} value={tf.value}>
                  {tf.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Volume toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={showVolume}
                onChange={(e) => setShowVolume(e.target.checked)}
                size="small"
              />
            }
            label="Volume"
            sx={{ ml: 1 }}
          />
          
          {/* Watchlist toggle */}
          <Tooltip title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}>
            <IconButton
              onClick={isInWatchlist ? removeFromWatchlist : addToWatchlist}
              color={isInWatchlist ? "primary" : "default"}
            >
              {isInWatchlist ? <RemoveIcon /> : <AddIcon />}
            </IconButton>
          </Tooltip>
          
          {/* Save layout */}
          <Tooltip title="Save Chart Layout">
            <IconButton onClick={saveChartLayout}>
              <Save />
            </IconButton>
          </Tooltip>
          
          {/* Export data */}
          <Tooltip title="Export Chart Data">
            <IconButton onClick={exportChartData}>
              <Share />
            </IconButton>
          </Tooltip>
          
          {/* Refresh */}
          <Tooltip title="Refresh Data">
            <IconButton onClick={refreshData} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>

          {/* Fullscreen */}
          <Tooltip title="Fullscreen">
            <IconButton onClick={() => setIsFullscreen(!isFullscreen)}>
              <Fullscreen />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(event, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
        >
          {tabs.map((tab, index) => (
            <Tab key={index} icon={tab.icon} label={tab.label} />
          ))}
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flexGrow: 1 }}>
        {activeTab === 0 && (
          <Grid container spacing={2} sx={{ height: '100%' }}>
            {/* Chart */}
            <Grid item xs={12} lg={9}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ height: '100%', p: 1 }}>
                  {renderChart()}
                </CardContent>
              </Card>
            </Grid>

            {/* Indicators Panel */}
            <Grid item xs={12} lg={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimelineIcon />
                    Indicators
                  </Typography>

                  {/* Active Indicators */}
                  {activeIndicators.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Active
                      </Typography>
                      {activeIndicators.map((indicator) => (
                        <Chip
                          key={indicator.type}
                          label={indicator.name}
                          onDelete={() => removeIndicator(indicator.type)}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                          color="primary"
                        />
                      ))}
                    </Box>
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* Available Indicators */}
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Add Indicators
                  </Typography>
                  
                  <List dense>
                    {INDICATORS.map((indicator) => (
                      <ListItem key={indicator.type} disablePadding>
                        <ListItemButton
                          onClick={() => addIndicator(indicator.type)}
                          disabled={activeIndicators.some(i => i.type === indicator.type)}
                        >
                          <ListItemText 
                            primary={indicator.name}
                            secondary={indicator.category}
                          />
                          <IconButton size="small" edge="end">
                            <AddIcon />
                          </IconButton>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        
        {activeTab === 1 && (
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Technical Analysis - {selectedSymbol}</Typography>
              
              {currentPrice && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ p: 2, bgcolor: '#161B22' }}>
                      <Typography variant="subtitle1" gutterBottom>Price Analysis</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Current Price:</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {formatPrice(currentPrice.last_price)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">24h Change:</Typography>
                          <Typography 
                            variant="body2" 
                            color={currentPrice.price_change >= 0 ? 'success.main' : 'error.main'}
                            fontWeight="bold"
                          >
                            {formatPercent(currentPrice.price_change_percent)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Volume:</Typography>
                          <Typography variant="body2">
                            {formatPrice(currentPrice.volume)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Market Cap:</Typography>
                          <Typography variant="body2">
                            {formatPrice(currentPrice.market_cap)}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card sx={{ p: 2, bgcolor: '#161B22' }}>
                      <Typography variant="subtitle1" gutterBottom>Technical Indicators</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {indicatorData && Object.keys(indicatorData).length > 0 ? (
                          Object.entries(indicatorData).map(([key, data]) => (
                            <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">{key.toUpperCase()}:</Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {data.values ? 
                                  formatPrice(data.values[data.values.length - 1]?.value) : 
                                  'Calculating...'
                                }
                              </Typography>
                            </Box>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Add indicators from the Chart tab to see analysis
                          </Typography>
                        )}
                      </Box>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Card sx={{ p: 2, bgcolor: '#161B22' }}>
                      <Typography variant="subtitle1" gutterBottom>Advanced Features</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                          <Button 
                            variant="outlined" 
                            fullWidth 
                            onClick={() => alert('Pattern Recognition feature coming soon!')}
                          >
                            Pattern Recognition
                          </Button>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Button 
                            variant="outlined" 
                            fullWidth
                            onClick={() => alert('Support & Resistance feature coming soon!')}
                          >
                            Support & Resistance
                          </Button>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Button 
                            variant="outlined" 
                            fullWidth
                            onClick={() => alert('Trading Signals feature coming soon!')}
                          >
                            Trading Signals
                          </Button>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Button 
                            variant="outlined" 
                            fullWidth
                            onClick={() => alert('Risk Assessment feature coming soon!')}
                          >
                            Risk Assessment
                          </Button>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        )}
        
        {activeTab === 2 && (
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Stock Screener</Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card sx={{ p: 2, bgcolor: '#161B22' }}>
                    <Typography variant="subtitle1" gutterBottom>Price Filters</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Min Price"
                        type="number"
                        size="small"
                        variant="outlined"
                        placeholder="1000"
                      />
                      <TextField
                        label="Max Price"
                        type="number"
                        size="small"
                        variant="outlined"
                        placeholder="100000"
                      />
                      <FormControl size="small">
                        <InputLabel>Price Change</InputLabel>
                        <Select defaultValue="">
                          <MenuItem value="">Any</MenuItem>
                          <MenuItem value="positive">Positive Only</MenuItem>
                          <MenuItem value="negative">Negative Only</MenuItem>
                          <MenuItem value="strong_up">Strong Up (&gt;5%)</MenuItem>
                          <MenuItem value="strong_down">Strong Down (&lt;-5%)</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card sx={{ p: 2, bgcolor: '#161B22' }}>
                    <Typography variant="subtitle1" gutterBottom>Volume Filters</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Min Volume"
                        type="number"
                        size="small"
                        variant="outlined"
                        placeholder="1000000"
                      />
                      <FormControl size="small">
                        <InputLabel>Volume Trend</InputLabel>
                        <Select defaultValue="">
                          <MenuItem value="">Any</MenuItem>
                          <MenuItem value="above_avg">Above Average</MenuItem>
                          <MenuItem value="high">High Volume</MenuItem>
                          <MenuItem value="unusual">Unusual Activity</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        label="Market Cap Range"
                        size="small"
                        variant="outlined"
                        placeholder="Large, Mid, Small"
                      />
                    </Box>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card sx={{ p: 2, bgcolor: '#161B22' }}>
                    <Typography variant="subtitle1" gutterBottom>Technical Filters</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <FormControl size="small">
                        <InputLabel>RSI Condition</InputLabel>
                        <Select defaultValue="">
                          <MenuItem value="">Any</MenuItem>
                          <MenuItem value="oversold">Oversold (RSI &lt; 30)</MenuItem>
                          <MenuItem value="overbought">Overbought (RSI &gt; 70)</MenuItem>
                          <MenuItem value="neutral">Neutral (30-70)</MenuItem>
                        </Select>
                      </FormControl>
                      <FormControl size="small">
                        <InputLabel>Moving Average</InputLabel>
                        <Select defaultValue="">
                          <MenuItem value="">Any</MenuItem>
                          <MenuItem value="above_sma20">Above SMA(20)</MenuItem>
                          <MenuItem value="below_sma20">Below SMA(20)</MenuItem>
                          <MenuItem value="golden_cross">Golden Cross</MenuItem>
                          <MenuItem value="death_cross">Death Cross</MenuItem>
                        </Select>
                      </FormControl>
                      <FormControl size="small">
                        <InputLabel>MACD Signal</InputLabel>
                        <Select defaultValue="">
                          <MenuItem value="">Any</MenuItem>
                          <MenuItem value="bullish">Bullish Crossover</MenuItem>
                          <MenuItem value="bearish">Bearish Crossover</MenuItem>
                          <MenuItem value="divergence">Divergence</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Card>
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button 
                      variant="contained" 
                      color="primary"
                      startIcon={<ShowChart />}
                      onClick={() => alert('Screening functionality coming soon! This will filter stocks based on your criteria.')}
                    >
                      Run Screen
                    </Button>
                    <Button 
                      variant="outlined"
                      onClick={() => alert('Save Screen functionality coming soon!')}
                    >
                      Save Screen
                    </Button>
                    <Button 
                      variant="outlined"
                      onClick={() => alert('Load Preset functionality coming soon!')}
                    >
                      Load Preset
                    </Button>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Card sx={{ p: 2, bgcolor: '#161B22' }}>
                    <Typography variant="subtitle1" gutterBottom>Sample Results</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Screening results will appear here. Currently showing all available stocks:
                    </Typography>
                    <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                      {stocks.slice(0, 10).map((stock, index) => (
                        <Box 
                          key={stock.symbol} 
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            p: 1,
                            borderBottom: index < 9 ? '1px solid #30363D' : 'none',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#21262D' }
                          }}
                          onClick={() => {
                            setSelectedSymbol(stock.symbol);
                            setActiveTab(0); // Switch to Chart tab
                          }}
                        >
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {stock.symbol}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {stock.company_name}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2">
                              {formatPrice(stock.last_price)}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              color={stock.price_change >= 0 ? 'success.main' : 'error.main'}
                            >
                              {formatPercent(stock.price_change_percent)}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
        
        {activeTab === 3 && (
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">My Watchlist ({watchlist.length})</Typography>
                <Box>
                  <Tooltip title="Import Watchlist">
                    <IconButton onClick={() => alert('Import watchlist feature coming soon!')}>
                      <Share sx={{ transform: 'rotate(180deg)' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Export Watchlist">
                    <IconButton onClick={() => alert('Export watchlist feature coming soon!')}>
                      <Share />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {watchlist.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary" gutterBottom>
                    No symbols in watchlist yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Add symbols using the + button in the header or search for stocks below
                  </Typography>
                  <Autocomplete
                    options={stocks.map(stock => stock.symbol)}
                    getOptionLabel={(option) => {
                      const stock = stocks.find(s => s.symbol === option);
                      return stock ? `${stock.symbol} - ${stock.company_name}` : option;
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Search and add to watchlist"
                        variant="outlined"
                        size="small"
                      />
                    )}
                    onChange={(event, value) => {
                      if (value && !watchlist.includes(value)) {
                        const newWatchlist = [...watchlist, value];
                        setWatchlist(newWatchlist);
                        localStorageManager.setItem('watchlist', newWatchlist);
                      }
                    }}
                    sx={{ maxWidth: 400, mx: 'auto' }}
                  />
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {watchlist.map((symbol) => {
                    const stock = stocks.find(s => s.symbol === symbol);
                    return (
                      <Grid item xs={12} md={6} lg={4} key={symbol}>
                        <Card 
                          sx={{ 
                            p: 2, 
                            bgcolor: '#161B22',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#21262D' },
                            border: selectedSymbol === symbol ? '2px solid #2196f3' : '1px solid #30363D'
                          }}
                          onClick={() => {
                            setSelectedSymbol(symbol);
                            setActiveTab(0); // Switch to Chart tab
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="h6" fontWeight="bold">
                              {symbol}
                            </Typography>
                            <IconButton 
                              onClick={(e) => {
                                e.stopPropagation();
                                const newWatchlist = watchlist.filter(s => s !== symbol);
                                setWatchlist(newWatchlist);
                                localStorageManager.setItem('watchlist', newWatchlist);
                              }}
                              size="small"
                              sx={{ color: 'error.main' }}
                            >
                              <RemoveIcon />
                            </IconButton>
                          </Box>
                          
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ mb: 2, height: 40, overflow: 'hidden' }}
                          >
                            {stock?.company_name || 'Loading...'}
                          </Typography>
                          
                          {stock && (
                            <Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2">Price:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {formatPrice(stock.last_price)}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2">Change:</Typography>
                                <Typography 
                                  variant="body2" 
                                  fontWeight="bold"
                                  color={stock.price_change >= 0 ? 'success.main' : 'error.main'}
                                >
                                  {formatPercent(stock.price_change_percent)}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Volume:</Typography>
                                <Typography variant="body2">
                                  {formatPrice(stock.volume)}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </Card>
                      </Grid>
                    );
                  })}
                  
                  {/* Add new symbol card */}
                  <Grid item xs={12} md={6} lg={4}>
                    <Card 
                      sx={{ 
                        p: 2, 
                        bgcolor: '#161B22',
                        border: '2px dashed #30363D',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 150,
                        cursor: 'pointer',
                        '&:hover': { 
                          bgcolor: '#21262D',
                          borderColor: '#2196f3'
                        }
                      }}
                    >
                      <AddIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        Add New Symbol
                      </Typography>
                      <Autocomplete
                        options={stocks.filter(s => !watchlist.includes(s.symbol)).map(stock => stock.symbol)}
                        getOptionLabel={(option) => {
                          const stock = stocks.find(s => s.symbol === option);
                          return stock ? `${stock.symbol} - ${stock.company_name}` : option;
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Search symbol"
                            variant="outlined"
                            size="small"
                            sx={{ mt: 1, width: '100%' }}
                          />
                        )}
                        onChange={(event, value) => {
                          if (value && !watchlist.includes(value)) {
                            const newWatchlist = [...watchlist, value];
                            setWatchlist(newWatchlist);
                            localStorageManager.setItem('watchlist', newWatchlist);
                          }
                        }}
                      />
                    </Card>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default Charts;