/**
 * REST API Example - نمونه استفاده از REST API
 * Example component showing how to use REST API for real-time data
 * NO WebSocket connections - only REST API polling
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Refresh,
  PlayArrow,
  Pause,
  Stop
} from '@mui/icons-material';
import stockRepository from '../../services/repositories/StockRepository';
import restApiManager from '../../services/api/RestApiManager';

const RestApiExample = () => {
  const [symbols] = useState(['TEPIX', 'SHBANKE', 'SHEPNA', 'FEMELI', 'KHODRO']);
  const [realTimeData, setRealTimeData] = useState({});
  const [isPolling, setIsPolling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [useBatchApi, setUseBatchApi] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(5000);
  
  const unsubscribeRef = React.useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  /**
   * Fetch data once using REST API
   */
  const fetchDataOnce = async () => {
    setLoading(true);
    setError(null);

    try {
      if (useBatchApi) {
        console.log('📡 Fetching data using batch REST API...');
        const batchData = await stockRepository.getBatchRealTimeData(symbols);
        setRealTimeData(batchData);
      } else {
        console.log('📡 Fetching data using individual REST API calls...');
        const data = {};
        
        for (const symbol of symbols) {
          try {
            const symbolData = await stockRepository.getRealTimeData(symbol);
            data[symbol] = symbolData;
          } catch (error) {
            console.warn(`Failed to fetch data for ${symbol}:`, error.message);
          }
        }
        
        setRealTimeData(data);
      }
      
      setLastUpdate(Date.now());
      console.log('✅ Data fetched successfully via REST API');
    } catch (error) {
      console.error('❌ Failed to fetch data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start polling using REST API Manager
   */
  const startPolling = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    console.log(`🚀 Starting REST API polling (${pollingInterval}ms interval)`);
    
    const unsubscribe = restApiManager.subscribeToSymbols(
      symbols,
      (data, error) => {
        if (error) {
          console.error('❌ Polling error:', error);
          setError(error.message);
        } else if (data) {
          console.log('📡 Received polling data:', Object.keys(data).length, 'symbols');
          setRealTimeData(data);
          setLastUpdate(Date.now());
          setError(null);
        }
      },
      {
        interval: pollingInterval,
        type: 'realtime'
      }
    );

    unsubscribeRef.current = unsubscribe;
    setIsPolling(true);
  };

  /**
   * Stop polling
   */
  const stopPolling = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    setIsPolling(false);
    console.log('⏹️ Stopped REST API polling');
  };

  /**
   * Toggle polling
   */
  const togglePolling = () => {
    if (isPolling) {
      stopPolling();
    } else {
      startPolling();
    }
  };

  /**
   * Format price change
   */
  const formatChange = (change) => {
    if (!change) return '0';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  };

  /**
   * Get change color
   */
  const getChangeColor = (change) => {
    if (!change) return 'text.secondary';
    return change >= 0 ? 'success.main' : 'error.main';
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          REST API Example - No WebSocket
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          This example demonstrates real-time data fetching using only REST API calls.
          No WebSocket connections are used - all data is retrieved via HTTP requests.
        </Typography>

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            onClick={fetchDataOnce}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
            variant="outlined"
          >
            Fetch Once
          </Button>

          <Button
            onClick={togglePolling}
            startIcon={isPolling ? <Pause /> : <PlayArrow />}
            variant="contained"
            color={isPolling ? 'warning' : 'primary'}
          >
            {isPolling ? 'Stop Polling' : 'Start Polling'}
          </Button>

          <FormControlLabel
            control={
              <Switch
                checked={useBatchApi}
                onChange={(e) => setUseBatchApi(e.target.checked)}
                disabled={isPolling}
              />
            }
            label="Use Batch API"
          />

          <Chip
            label={`Interval: ${pollingInterval}ms`}
            color={isPolling ? 'primary' : 'default'}
            size="small"
          />

          <Chip
            label={`Last Update: ${formatTimestamp(lastUpdate)}`}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Status */}
        <Box sx={{ mb: 3 }}>
          {isPolling && (
            <Alert severity="info" sx={{ mb: 2 }}>
              🔄 REST API polling is active. Data updates every {pollingInterval}ms.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>

        {/* Data Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Symbol</strong></TableCell>
                <TableCell align="right"><strong>Price</strong></TableCell>
                <TableCell align="right"><strong>Change</strong></TableCell>
                <TableCell align="right"><strong>Change %</strong></TableCell>
                <TableCell align="right"><strong>Volume</strong></TableCell>
                <TableCell align="right"><strong>Last Update</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {symbols.map((symbol) => {
                const data = realTimeData[symbol];
                return (
                  <TableRow key={symbol}>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {symbol}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {data ? data.close?.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Typography color={getChangeColor(data?.change)}>
                        {data ? formatChange(data.change) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography color={getChangeColor(data?.changePercent)}>
                        {data ? `${formatChange(data.changePercent)}%` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {data?.volume ? data.volume.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption">
                        {data ? formatTimestamp(data.timestamp) : '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* API Manager Status */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            REST API Manager Status
          </Typography>
          
          <Grid container spacing={2}>
            {(() => {
              const status = restApiManager.getStatus();
              return (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          Polling Status
                        </Typography>
                        <Typography variant="h6">
                          {status.isPolling ? '🟢 Active' : '🔴 Inactive'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          Subscribers
                        </Typography>
                        <Typography variant="h6">
                          {status.subscriberCount}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          Active Intervals
                        </Typography>
                        <Typography variant="h6">
                          {status.activeIntervals}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          Data Source
                        </Typography>
                        <Typography variant="h6">
                          📡 REST API
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </>
              );
            })()}
          </Grid>
        </Box>

        {/* Code Example */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Usage Example
          </Typography>
          
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{`// Single symbol REST API call
const data = await stockRepository.getRealTimeData('TEPIX');

// Batch REST API call (recommended for multiple symbols)
const batchData = await stockRepository.getBatchRealTimeData(['TEPIX', 'SHBANKE']);

// Subscribe to polling updates
const unsubscribe = restApiManager.subscribeToSymbols(
  ['TEPIX', 'SHBANKE'],
  (data, error) => {
    if (data) {
      console.log('New data received:', data);
      // Update UI with new data
    }
  },
  { interval: 5000 } // 5 second intervals
);

// Stop polling
unsubscribe();`}
            </Typography>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
};

export default RestApiExample;