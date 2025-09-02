import React from 'react';
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
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ChartIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../../services/websocket';
import { apiService } from '../../services/api';
import numeral from 'numeral';

const Dashboard = () => {
  const navigate = useNavigate();
  const { prices, connectionStatus } = useWebSocket();

  // Fetch market summary
  const { data: marketSummary, isLoading: summaryLoading, refetch } = useQuery(
    'marketSummary',
    apiService.getMarketSummary,
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      onError: (error) => {
        console.error('Failed to fetch market summary:', error);
      }
    }
  );

  const formatPrice = (price) => {
    return numeral(price).format('0,0');
  };

  const formatPercent = (percent) => {
    return numeral(percent / 100).format('+0.00%');
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

  const handleSymbolClick = (symbol) => {
    navigate(`/charts/${symbol}`);
  };

  if (summaryLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Loading market data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Market Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<div className={`status-indicator ${connectionStatus.isConnected ? 'connected' : 'disconnected'}`} />}
              label={connectionStatus.isConnected ? 'Live Data' : 'Disconnected'}
              color={connectionStatus.isConnected ? 'success' : 'error'}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              Last updated: {new Date().toLocaleTimeString()}
            </Typography>
          </Box>
        </Box>
        
        <Tooltip title="Refresh Data">
          <IconButton onClick={refetch} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3}>
        {/* Market Overview Cards */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Stocks
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {marketSummary?.total_stocks || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Currencies
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {marketSummary?.total_currencies || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Market Status
                  </Typography>
                  <Chip
                    label={marketSummary?.market_status === 'open' ? 'OPEN' : 'CLOSED'}
                    color={marketSummary?.market_status === 'open' ? 'success' : 'error'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Active Symbols
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {connectionStatus.subscriptions.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Real-time Prices */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Live Prices
              </Typography>
              {Object.entries(prices).slice(0, 5).map(([symbol, priceData]) => (
                <Box
                  key={symbol}
                  onClick={() => handleSymbolClick(symbol)}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    borderRadius: 1,
                    px: 1
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {symbol}
                  </Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography
                      variant="body2"
                      color={getChangeColor(priceData.change)}
                      fontWeight="bold"
                    >
                      {formatPrice(priceData.price)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: getChangeColor(priceData.change) }}>
                      {getChangeIcon(priceData.change)}
                      <Typography variant="caption">
                        {formatPercent(priceData.change_percent)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
              {Object.keys(prices).length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                  No real-time data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Gainers */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
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
                    {marketSummary?.top_gainers?.slice(0, 5).map((stock) => (
                      <TableRow
                        key={stock.symbol}
                        hover
                        onClick={() => handleSymbolClick(stock.symbol)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {stock.symbol}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {stock.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {formatPrice(stock.price)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ color: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <TrendingUpIcon fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="body2">
                              {formatPercent(stock.change_percent)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSymbolClick(stock.symbol);
                            }}
                          >
                            <ChartIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )) || []}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Losers */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
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
                    {marketSummary?.top_losers?.slice(0, 5).map((stock) => (
                      <TableRow
                        key={stock.symbol}
                        hover
                        onClick={() => handleSymbolClick(stock.symbol)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {stock.symbol}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {stock.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {formatPrice(stock.price)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ color: 'error.main', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <TrendingDownIcon fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="body2">
                              {formatPercent(stock.change_percent)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSymbolClick(stock.symbol);
                            }}
                          >
                            <ChartIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )) || []}
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