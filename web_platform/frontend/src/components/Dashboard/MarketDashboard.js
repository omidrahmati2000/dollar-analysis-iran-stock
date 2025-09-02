/**
 * Market Dashboard - داشبورد بازار
 * Main dashboard component integrated with backend API
 * NO WebSocket - uses REST API polling from http://localhost:8000
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Refresh,
  ShowChart,
  Assessment,
  Timer
} from '@mui/icons-material';
import marketDataService from '../../services/MarketDataService';

const MarketDashboard = ({ theme = 'dark' }) => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);

  // Subscribe to market data updates
  useEffect(() => {
    const unsubscribe = marketDataService.subscribe((data) => {
      setMarketData(data);
      setLastUpdate(new Date());
      setLoading(false);
      setError(null);
    });

    // Get initial status
    setServiceStatus(marketDataService.getStatus());

    // Update status periodically
    const statusInterval = setInterval(() => {
      setServiceStatus(marketDataService.getStatus());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, []);

  // Handle manual refresh
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await marketDataService.refresh();
      console.log('✅ Dashboard refreshed');
    } catch (error) {
      setError('Failed to refresh data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Format number with Persian locale
  const formatNumber = (num) => {
    if (!num) return '—';
    return new Intl.NumberFormat('fa-IR').format(num);
  };

  // Format currency
  const formatCurrency = (num) => {
    if (!num) return '—';
    return new Intl.NumberFormat('fa-IR').format(num) + ' ریال';
  };

  // Format percentage
  const formatPercent = (num) => {
    if (num === undefined || num === null) return '—';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  // Get color for change percentage
  const getChangeColor = (change) => {
    if (!change) return 'text.secondary';
    return change >= 0 ? 'success.main' : 'error.main';
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleTimeString('fa-IR');
  };

  if (loading && !marketData) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="400px"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          در حال بارگذاری داده‌های بازار از سرور...
        </Typography>
      </Box>
    );
  }

  if (error && !marketData) {
    return (
      <Box p={3}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" onClick={handleRefresh}>
              تلاش مجدد
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  const summary = marketData?.summary || {};

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          داشبورد بازار
        </Typography>
        
        <Box display="flex" alignItems="center" gap={2}>
          {serviceStatus && (
            <Chip
              icon={<Timer />}
              label={`REST API - ${serviceStatus.dataSource?.split('//')[1] || 'localhost:8000'}`}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
          
          <Chip
            label={`آخرین بروزرسانی: ${formatTime(lastUpdate)}`}
            size="small"
            variant="outlined"
          />
          
          <Tooltip title="بروزرسانی">
            <IconButton onClick={handleRefresh} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <Refresh />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Market Statistics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <ShowChart color="primary" />
                <Typography variant="h6">کل حجم معاملات</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {formatNumber(summary.totalVolume)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                میلیون ریال
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <Assessment color="primary" />
                <Typography variant="h6">تعداد معاملات</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {formatNumber(summary.totalTrades)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                معامله
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingUp color="success" />
                <Typography variant="h6">ارزش بازار</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {formatNumber(summary.totalMarketCap)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                میلیارد ریال
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <ShowChart color="info" />
                <Typography variant="h6">نمادهای فعال</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {formatNumber(summary.activeSymbols)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                نماد
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Market Status */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                وضعیت بازار
              </Typography>
              <Box display="flex" gap={2}>
                <Chip
                  label={summary.marketStatus || 'نامشخص'}
                  color={summary.marketStatus === 'OPEN' ? 'success' : 'default'}
                  variant="filled"
                />
                <Chip
                  label={summary.marketTrend || 'خنثی'}
                  color={
                    summary.marketTrend === 'BULLISH' ? 'success' :
                    summary.marketTrend === 'BEARISH' ? 'error' : 'default'
                  }
                  icon={
                    summary.marketTrend === 'BULLISH' ? <TrendingUp /> :
                    summary.marketTrend === 'BEARISH' ? <TrendingDown /> : null
                  }
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                اتصال به سرور
              </Typography>
              <Box display="flex" gap={2}>
                <Chip
                  label={serviceStatus?.initialized ? 'متصل' : 'قطع'}
                  color={serviceStatus?.initialized ? 'success' : 'error'}
                  variant="filled"
                />
                <Chip
                  label={serviceStatus?.polling ? 'فعال' : 'غیرفعال'}
                  color={serviceStatus?.polling ? 'info' : 'warning'}
                />
                <Chip
                  label={`${serviceStatus?.subscribers || 0} مشترک`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Gainers and Losers */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="success.main">
                <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                برترین سهام صعودی
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>نماد</TableCell>
                      <TableCell align="right">قیمت</TableCell>
                      <TableCell align="right">تغییر</TableCell>
                      <TableCell align="right">درصد</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {marketData?.topGainers?.slice(0, 10).map((stock) => (
                      <TableRow key={stock.symbol} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {stock.symbol}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {stock.companyName}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(stock.price)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography color={getChangeColor(stock.change)}>
                            {formatNumber(stock.change)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            color={getChangeColor(stock.changePercent)}
                            fontWeight="bold"
                          >
                            {formatPercent(stock.changePercent)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {(!marketData?.topGainers || marketData.topGainers.length === 0) && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  داده‌ای موجود نیست
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="error.main">
                <TrendingDown sx={{ mr: 1, verticalAlign: 'middle' }} />
                برترین سهام نزولی
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>نماد</TableCell>
                      <TableCell align="right">قیمت</TableCell>
                      <TableCell align="right">تغییر</TableCell>
                      <TableCell align="right">درصد</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {marketData?.topLosers?.slice(0, 10).map((stock) => (
                      <TableRow key={stock.symbol} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {stock.symbol}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {stock.companyName}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(stock.price)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography color={getChangeColor(stock.change)}>
                            {formatNumber(stock.change)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            color={getChangeColor(stock.changePercent)}
                            fontWeight="bold"
                          >
                            {formatPercent(stock.changePercent)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {(!marketData?.topLosers || marketData.topLosers.length === 0) && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  داده‌ای موجود نیست
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && serviceStatus && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              اطلاعات توسعه‌دهنده
            </Typography>
            <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem' }}>
              {JSON.stringify(serviceStatus, null, 2)}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default MarketDashboard;