import React, { useState, useEffect } from 'react';
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
  Tabs,
  Tab,
  TextField,
  Autocomplete,
  CircularProgress,
  Alert,
  Skeleton,
  Menu,
  MenuItem as MenuItemComponent,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Fullscreen,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  ShowChart,
  BarChart,
  TrendingUp,
  Save,
  Refresh,
  Add as AddIcon,
  Remove as RemoveIcon,
  MoreVert as MoreVertIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import SimpleChart from '../../components/Charts/SimpleChart';
import LoadingSpinner, { LoadingCard } from '../../components/Loading/LoadingSpinner';
import WatchlistStorage from '../../services/storage/WatchlistStorage';
import GlobalSearch from '../../components/Search/GlobalSearch';

const TIMEFRAMES = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '1y', label: '1Y' }
];

const CHART_TYPES = [
  { value: 'candlestick', label: 'Candlestick', icon: <ShowChart /> },
  { value: 'line', label: 'Line', icon: <TimelineIcon /> },
  { value: 'area', label: 'Area', icon: <BarChart /> }
];

const ChartsNew = () => {
  const { symbol: urlSymbol } = useParams();
  const navigate = useNavigate();
  
  const [selectedSymbol, setSelectedSymbol] = useState(urlSymbol || 'TAPICO');
  const [timeframe, setTimeframe] = useState('1d');
  const [chartType, setChartType] = useState('candlestick');
  const [showVolume, setShowVolume] = useState(true);
  const [stocks, setStocks] = useState([]);
  const [priceData, setPriceData] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [watchlist, setWatchlist] = useState([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // Mock stock list
  const mockStocks = [
    { symbol: 'TAPICO', company_name: 'تاپیکو', last_price: 3500, change: 2.5 },
    { symbol: 'SHEPASAND', company_name: 'شپاسند', last_price: 2800, change: -1.2 },
    { symbol: 'FOOLAD', company_name: 'فولاد', last_price: 4200, change: 1.8 },
    { symbol: 'SAIPA', company_name: 'سایپا', last_price: 1500, change: -0.5 },
    { symbol: 'IKCO', company_name: 'ایران خودرو', last_price: 2200, change: 3.1 }
  ];

  // Generate mock OHLCV data
  const generateMockData = (symbol, timeframe, days = 30) => {
    const data = [];
    const basePrice = 3500;
    let currentPrice = basePrice;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const volatility = 0.02;
      const change = (Math.random() - 0.5) * volatility;
      const open = currentPrice;
      const close = currentPrice * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.floor(Math.random() * 10000000) + 1000000;
      
      data.push({
        date: date.toISOString().split('T')[0],
        timestamp: date.getTime(),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume
      });
      
      currentPrice = close;
    }
    
    return data;
  };

  useEffect(() => {
    fetchStocks();
    loadWatchlist();
  }, []);

  const loadWatchlist = () => {
    const savedWatchlist = WatchlistStorage.getWatchlist();
    setWatchlist(savedWatchlist);
  };

  const fetchStocks = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v2/stocks?limit=100');
      if (response.ok) {
        const data = await response.json();
        setStocks(data);
      } else {
        // Fallback to mock data if API fails
        setStocks(mockStocks);
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
      setStocks(mockStocks);
    }
  };

  useEffect(() => {
    if (!selectedSymbol) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate mock data
        const days = timeframe === '1d' ? 30 : timeframe === '1w' ? 52 : timeframe === '1m' ? 12 : 365;
        const mockData = generateMockData(selectedSymbol, timeframe, days);
        
        setPriceData(mockData);
        
        // Set current price
        const stockInfo = mockStocks.find(s => s.symbol === selectedSymbol) || mockStocks[0];
        setCurrentPrice(stockInfo);
        
      } catch (err) {
        console.error('Error loading price data:', err);
        setError('Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [selectedSymbol, timeframe]);

  const formatPrice = (price) => {
    if (!price) return '—';
    return new Intl.NumberFormat('en-US').format(price);
  };

  const formatPercent = (percent) => {
    if (!percent && percent !== 0) return '—';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  const handleAddToWatchlist = (symbol) => {
    if (WatchlistStorage.addToWatchlist(symbol)) {
      loadWatchlist();
    }
  };

  const handleRemoveFromWatchlist = (symbol) => {
    if (WatchlistStorage.removeFromWatchlist(symbol)) {
      loadWatchlist();
    }
  };

  const getWatchlistStocks = () => {
    return stocks.filter(stock => watchlist.includes(stock.symbol));
  };

  const handleMenuClick = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const resetWatchlist = () => {
    WatchlistStorage.resetToDefault();
    loadWatchlist();
    handleMenuClose();
  };

  const handleSearchSelect = (item, type) => {
    if (type === 'stock') {
      setSelectedSymbol(item.symbol);
    } else if (type === 'currency') {
      // Navigate to currencies page or show currency info
      navigate('/currencies');
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2, gap: 2 }}>
      {/* Header */}
      <Card sx={{ p: 2, position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Global Search */}
            <Box sx={{ minWidth: 300, position: 'relative', zIndex: 10 }}>
              <GlobalSearch 
                onSelect={handleSearchSelect}
                placeholder="جستجوی سهام..."
              />
            </Box>

            {/* Current Price Info */}
            {currentPrice && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" fontWeight="bold">
                  {formatPrice(currentPrice.last_price)}
                </Typography>
                <Chip
                  label={formatPercent(currentPrice.change)}
                  color={getChangeColor(currentPrice.change)}
                  size="small"
                />
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Timeframe Selector */}
            <FormControl size="small">
              <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map((tf) => (
                  <MenuItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Chart Type Selector */}
            <FormControl size="small">
              <Select value={chartType} onChange={(e) => setChartType(e.target.value)}>
                {CHART_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {type.icon}
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Volume Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={showVolume}
                  onChange={(e) => setShowVolume(e.target.checked)}
                  size="small"
                />
              }
              label="Volume"
            />

            <Tooltip title="Refresh Data">
              <IconButton onClick={() => window.location.reload()} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Card>

      {/* Main Content */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* Chart Panel */}
        <Box sx={{ flex: 3, minWidth: 0 }}>
          <Card sx={{ height: '550px' }}>
            <CardContent sx={{ height: '100%', p: 1, '&:last-child': { paddingBottom: 1 } }}>
              {loading ? (
                <Box sx={{ height: '100%', p: 2 }}>
                  <LoadingSpinner 
                    type="dots" 
                    message="در حال بارگذاری نمودار..." 
                    size="medium"
                  />
                  <LoadingCard height={400} animated />
                </Box>
              ) : error ? (
                <Box sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 2 
                }}>
                  <Alert severity="error">{error}</Alert>
                  <Button onClick={() => window.location.reload()} startIcon={<Refresh />}>
                    Try Again
                  </Button>
                </Box>
              ) : (
                <SimpleChart 
                  data={priceData}
                  type={chartType}
                  showVolume={showVolume}
                  height={480}
                />
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Side Panel */}
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Card sx={{ height: '550px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                  <Tab label="Watchlist" />
                  <Tab label="Info" />
                </Tabs>
                {activeTab === 0 && (
                  <IconButton size="small" onClick={handleMenuClick}>
                    <MoreVertIcon />
                  </IconButton>
                )}
              </Box>

              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItemComponent onClick={resetWatchlist}>
                  <ListItemIcon>
                    <Refresh fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Reset to Default" />
                </MenuItemComponent>
              </Menu>

              <Box sx={{ mt: 2, height: '450px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {activeTab === 0 ? (
                  // Watchlist
                  <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6">My Watchlist</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {watchlist.length} stocks
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                      {getWatchlistStocks().map((stock) => (
                        <Card 
                          key={stock.symbol}
                          sx={{ 
                            mb: 1,
                            p: 1,
                            cursor: 'pointer',
                            bgcolor: stock.symbol === selectedSymbol ? 'action.selected' : 'background.paper',
                            '&:hover': { bgcolor: 'action.hover' },
                            border: watchlist.includes(stock.symbol) ? '1px solid #2196f3' : '1px solid transparent'
                          }}
                          onClick={() => setSelectedSymbol(stock.symbol)}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  {stock.symbol}
                                </Typography>
                                <StarIcon sx={{ fontSize: 12, color: '#2196f3' }} />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {stock.company_name}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2">
                                  {formatPrice(stock.last_price)}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  color={stock.change >= 0 ? 'success.main' : 'error.main'}
                                >
                                  {formatPercent(stock.change)}
                                </Typography>
                              </Box>
                              <IconButton 
                                size="small" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromWatchlist(stock.symbol);
                                }}
                                sx={{ color: 'error.main' }}
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </Card>
                      ))}
                      
                      {/* Add to watchlist section */}
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Add stocks to watchlist:
                        </Typography>
                        {stocks.filter(stock => !watchlist.includes(stock.symbol)).slice(0, 5).map((stock) => (
                          <Card 
                            key={stock.symbol}
                            sx={{ 
                              mb: 1,
                              p: 1,
                              cursor: 'pointer',
                              bgcolor: 'background.paper',
                              '&:hover': { bgcolor: 'action.hover' },
                              opacity: 0.7
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box sx={{ flex: 1 }} onClick={() => setSelectedSymbol(stock.symbol)}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" fontWeight="bold">
                                    {stock.symbol}
                                  </Typography>
                                  <StarBorderIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                  {stock.company_name}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ textAlign: 'right' }}>
                                  <Typography variant="body2">
                                    {formatPrice(stock.last_price)}
                                  </Typography>
                                  <Typography 
                                    variant="caption" 
                                    color={stock.change >= 0 ? 'success.main' : 'error.main'}
                                  >
                                    {formatPercent(stock.change)}
                                  </Typography>
                                </Box>
                                <IconButton 
                                  size="small" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToWatchlist(stock.symbol);
                                  }}
                                  sx={{ color: 'success.main' }}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          </Card>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  // Stock Info
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>Stock Information</Typography>
                    {currentPrice ? (
                      <Box sx={{ '& > *': { mb: 1 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Symbol:</Typography>
                          <Typography variant="body2" fontWeight="bold">{currentPrice.symbol}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Company:</Typography>
                          <Typography variant="body2">{currentPrice.company_name}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Last Price:</Typography>
                          <Typography variant="body2" fontWeight="bold">{formatPrice(currentPrice.last_price)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Change:</Typography>
                          <Typography 
                            variant="body2" 
                            color={currentPrice.change >= 0 ? 'success.main' : 'error.main'}
                          >
                            {formatPercent(currentPrice.change)}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography color="text.secondary">Select a stock to view information</Typography>
                    )}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default ChartsNew;