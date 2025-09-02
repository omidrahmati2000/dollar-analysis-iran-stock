import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ChartIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import stockRepository from '../../services/repositories/StockRepository';
import CurrencyWidget from '../../components/Dashboard/CurrencyWidget';
import LoadingSpinner, { LoadingCard } from '../../components/Loading/LoadingSpinner';

const Dashboard = () => {
  const navigate = useNavigate();
  const [marketSummary, setMarketSummary] = useState(null);
  const [topStocks, setTopStocks] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch market data
  const fetchMarketData = async () => {
    try {
      setSummaryLoading(true);
      
      // Fetch market summary, market stats, and top stocks
      const [summary, stats, stocks] = await Promise.all([
        fetch('http://localhost:8000/api/v2/market/summary').then(res => res.ok ? res.json() : null),
        fetch('http://localhost:8000/api/v2/market/stats').then(res => res.ok ? res.json() : null),
        stockRepository.getAllStocks(50) // Get top 50 stocks
      ]);
      
      // Merge summary and stats data
      const combinedSummary = {
        ...summary,
        ...stats,
        currencies: 0 // Will be updated when currency API is available
      };
      
      setMarketSummary(combinedSummary);
      setTopStocks(stocks || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    fetchMarketData();
    
    const interval = setInterval(fetchMarketData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return new Intl.NumberFormat('en-US').format(price);
  };

  const formatPercent = (percent) => {
    if (percent === null || percent === undefined) return '—';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'success.main';
    if (change < 0) return 'error.main';
    return 'text.primary';
  };

  const getChangeIcon = (change) => {
    if (change > 0) return <TrendingUpIcon fontSize="small" />;
    if (change < 0) return <TrendingDownIcon fontSize="small" />;
    return null;
  };

  if (summaryLoading && !marketSummary && !topStocks.length) {
    return (
      <Box sx={{ height: '100%', p: 3 }}>
        <LoadingSpinner 
          type="pulse" 
          message="در حال بارگذاری داده‌های بازار..." 
          size="large"
        />
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <LoadingCard height={120} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <LoadingCard height={120} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <LoadingCard height={120} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <LoadingCard height={120} />
          </Grid>
          <Grid item xs={12}>
            <LoadingCard height={200} />
          </Grid>
          <Grid item xs={12} md={6}>
            <LoadingCard height={300} />
          </Grid>
          <Grid item xs={12} md={6}>
            <LoadingCard height={300} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error && !topStocks.length) {
    return (
      <Box sx={{ height: '100%', p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <IconButton onClick={fetchMarketData} size="small">
              <RefreshIcon />
            </IconButton>
          }
        >
          Failed to load market data: {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Market Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={error ? 'Error' : 'Connected'}
            color={error ? 'error' : 'success'}
            size="small"
          />
          <Typography variant="body2" color="text.secondary">
            {lastUpdate ? `Last updated: ${lastUpdate.toLocaleTimeString()}` : 'Never'}
          </Typography>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchMarketData} disabled={summaryLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Market Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Stocks
              </Typography>
              <Typography variant="h4">
                {marketSummary?.total_stocks || topStocks.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Companies
              </Typography>
              <Typography variant="h4">
                {marketSummary?.companies || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Market Status
              </Typography>
              <Typography variant="h4">
                <Chip 
                  label={marketSummary?.market_status || 'CLOSED'}
                  color={marketSummary?.market_status === 'OPEN' ? 'success' : 'default'}
                />
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Active Symbols
              </Typography>
              <Typography variant="h4">
                {marketSummary?.active_symbols || topStocks.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Currency Widget */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <CurrencyWidget />
        </Grid>
      </Grid>

      {/* Top Gainers and Losers */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="success" />
                Top Gainers
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Change</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topStocks
                      .filter(stock => stock.price_change_percent >= 0)
                      .sort((a, b) => b.price_change_percent - a.price_change_percent)
                      .slice(0, 5)
                      .map((stock) => (
                        <TableRow key={stock.symbol} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {stock.symbol}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {formatPrice(stock.last_price)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="success.main" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                              {formatPercent(stock.price_change_percent)}
                              {getChangeIcon(stock.price_change_percent)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Chart">
                              <IconButton 
                                size="small" 
                                onClick={() => navigate(`/charts/${stock.symbol}`)}
                              >
                                <ChartIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingDownIcon color="error" />
                Top Losers
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Change</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topStocks
                      .filter(stock => stock.price_change_percent < 0)
                      .sort((a, b) => a.price_change_percent - b.price_change_percent)
                      .slice(0, 5)
                      .map((stock) => (
                        <TableRow key={stock.symbol} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {stock.symbol}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {formatPrice(stock.last_price)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="error.main" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                              {formatPercent(stock.price_change_percent)}
                              {getChangeIcon(stock.price_change_percent)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Chart">
                              <IconButton 
                                size="small" 
                                onClick={() => navigate(`/charts/${stock.symbol}`)}
                              >
                                <ChartIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;