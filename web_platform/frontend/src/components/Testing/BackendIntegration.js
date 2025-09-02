/**
 * Backend Integration Test - تست ادغام بک‌اند
 * Test component to verify backend API integration
 * Shows real data from http://localhost:8000 API
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  Tabs,
  Tab,
  TextField
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Refresh,
  Api,
  DataUsage,
  Search
} from '@mui/icons-material';
import stockRepository from '../../services/repositories/StockRepository';
import marketDataService from '../../services/MarketDataService';
import apiService from '../../services/api/base';

const BackendIntegration = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const [testData, setTestData] = useState({
    healthCheck: null,
    stocks: null,
    marketSummary: null,
    stockDetails: null,
    ohlcv: null,
    searchResults: null,
    indicators: null
  });

  // Health check on component mount
  useEffect(() => {
    performHealthCheck();
  }, []);

  const performHealthCheck = async () => {
    try {
      console.log('🔍 Checking backend health...');
      const health = await apiService.healthCheck();
      setTestData(prev => ({ ...prev, healthCheck: health }));
      console.log('✅ Backend health check completed');
    } catch (error) {
      console.error('❌ Health check failed:', error);
      setErrors(prev => ({ ...prev, healthCheck: error.message }));
    }
  };

  const testStocksList = async () => {
    setLoading(true);
    try {
      console.log('📡 Testing stocks list endpoint...');
      const stocks = await stockRepository.getStockList({ limit: 20 });
      setTestData(prev => ({ ...prev, stocks }));
      setResults(prev => ({ ...prev, stocksList: `✅ Retrieved ${stocks.length} stocks` }));
      console.log('✅ Stocks list test completed');
    } catch (error) {
      console.error('❌ Stocks list test failed:', error);
      setErrors(prev => ({ ...prev, stocksList: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const testMarketSummary = async () => {
    setLoading(true);
    try {
      console.log('📡 Testing market summary endpoint...');
      const summary = await stockRepository.getMarketSummary();
      setTestData(prev => ({ ...prev, marketSummary: summary }));
      setResults(prev => ({ ...prev, marketSummary: '✅ Market summary retrieved' }));
      console.log('✅ Market summary test completed');
    } catch (error) {
      console.error('❌ Market summary test failed:', error);
      setErrors(prev => ({ ...prev, marketSummary: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const testStockDetails = async (symbol = 'TEPIX') => {
    setLoading(true);
    try {
      console.log(`📡 Testing stock details for ${symbol}...`);
      const details = await stockRepository.getRealTimeData(symbol);
      setTestData(prev => ({ ...prev, stockDetails: { ...details, symbol } }));
      setResults(prev => ({ ...prev, stockDetails: `✅ ${symbol} details retrieved` }));
      console.log(`✅ Stock details test for ${symbol} completed`);
    } catch (error) {
      console.error(`❌ Stock details test for ${symbol} failed:`, error);
      setErrors(prev => ({ ...prev, stockDetails: `${symbol}: ${error.message}` }));
    } finally {
      setLoading(false);
    }
  };

  const testOHLCVData = async (symbol = 'TEPIX') => {
    setLoading(true);
    try {
      console.log(`📡 Testing OHLCV data for ${symbol}...`);
      const ohlcv = await stockRepository.getHistoricalData(symbol, { days: 7 });
      setTestData(prev => ({ ...prev, ohlcv: { symbol, data: ohlcv } }));
      setResults(prev => ({ ...prev, ohlcv: `✅ ${ohlcv.length} OHLCV records for ${symbol}` }));
      console.log(`✅ OHLCV test for ${symbol} completed`);
    } catch (error) {
      console.error(`❌ OHLCV test for ${symbol} failed:`, error);
      setErrors(prev => ({ ...prev, ohlcv: `${symbol}: ${error.message}` }));
    } finally {
      setLoading(false);
    }
  };

  const testSearch = async (query = searchQuery || 'تپیکس') => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      console.log(`📡 Testing search for "${query}"...`);
      const searchResults = await stockRepository.searchStocks(query);
      setTestData(prev => ({ ...prev, searchResults: { query, results: searchResults } }));
      setResults(prev => ({ ...prev, search: `✅ ${searchResults.length} results for "${query}"` }));
      console.log(`✅ Search test for "${query}" completed`);
    } catch (error) {
      console.error(`❌ Search test for "${query}" failed:`, error);
      setErrors(prev => ({ ...prev, search: `"${query}": ${error.message}` }));
    } finally {
      setLoading(false);
    }
  };

  const testTechnicalIndicators = async (symbol = 'TEPIX') => {
    setLoading(true);
    try {
      console.log(`📡 Testing technical indicators for ${symbol}...`);
      const indicators = await stockRepository.getTechnicalIndicators(symbol);
      setTestData(prev => ({ ...prev, indicators: { symbol, data: indicators } }));
      setResults(prev => ({ ...prev, indicators: `✅ ${indicators.length} indicators for ${symbol}` }));
      console.log(`✅ Technical indicators test for ${symbol} completed`);
    } catch (error) {
      console.error(`❌ Technical indicators test for ${symbol} failed:`, error);
      setErrors(prev => ({ ...prev, indicators: `${symbol}: ${error.message}` }));
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    console.log('🚀 Running all backend integration tests...');
    await performHealthCheck();
    await testMarketSummary();
    await testStocksList();
    await testStockDetails();
    await testOHLCVData();
    await testTechnicalIndicators();
    await testSearch();
    console.log('✅ All tests completed');
  };

  const formatJson = (data) => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Backend Integration Test
      </Typography>
      
      <Typography variant="body1" paragraph>
        Testing REST API integration with backend at <strong>http://localhost:8000</strong>
      </Typography>

      {/* Health Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Typography variant="h6">Backend Status</Typography>
            <Button onClick={performHealthCheck} size="small" startIcon={<Refresh />}>
              Check Health
            </Button>
          </Box>
          
          <Box display="flex" gap={2}>
            <Chip
              icon={testData.healthCheck?.status === 'error' ? <Error /> : <CheckCircle />}
              label={testData.healthCheck ? 
                (testData.healthCheck.status === 'error' ? 'Offline' : 'Online') : 
                'Unknown'
              }
              color={testData.healthCheck?.status === 'error' ? 'error' : 'success'}
            />
            
            <Chip
              icon={<Api />}
              label="REST API"
              variant="outlined"
            />
            
            <Chip
              icon={<DataUsage />}
              label="No WebSocket"
              color="info"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <Button 
          onClick={runAllTests} 
          variant="contained" 
          startIcon={<Refresh />}
          disabled={loading}
        >
          Run All Tests
        </Button>
        
        <Button onClick={testStocksList} disabled={loading}>
          Test Stocks List
        </Button>
        
        <Button onClick={testMarketSummary} disabled={loading}>
          Test Market Summary
        </Button>
        
        <Button onClick={() => testStockDetails('TEPIX')} disabled={loading}>
          Test Stock Details
        </Button>
        
        <Button onClick={() => testOHLCVData('TEPIX')} disabled={loading}>
          Test OHLCV Data
        </Button>
        
        <Button onClick={() => testTechnicalIndicators('TEPIX')} disabled={loading}>
          Test Indicators
        </Button>
      </Box>

      {/* Search Test */}
      <Box display="flex" gap={2} mb={3} alignItems="center">
        <TextField
          label="Search Query"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          placeholder="e.g., تپیکس"
        />
        <Button 
          onClick={() => testSearch()} 
          startIcon={<Search />}
          disabled={loading || !searchQuery.trim()}
        >
          Test Search
        </Button>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      )}

      {/* Results */}
      <Grid container spacing={2} mb={3}>
        {Object.entries(results).map(([test, result]) => (
          <Grid item xs={12} sm={6} md={4} key={test}>
            <Alert severity="success" variant="outlined">
              <Typography variant="body2">
                <strong>{test}:</strong> {result}
              </Typography>
            </Alert>
          </Grid>
        ))}
      </Grid>

      {/* Errors */}
      <Grid container spacing={2} mb={3}>
        {Object.entries(errors).map(([test, error]) => (
          <Grid item xs={12} sm={6} md={4} key={test}>
            <Alert severity="error" variant="outlined">
              <Typography variant="body2">
                <strong>{test}:</strong> {error}
              </Typography>
            </Alert>
          </Grid>
        ))}
      </Grid>

      {/* Data Display */}
      <Paper sx={{ width: '100%' }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Health Check" />
          <Tab label="Stocks List" />
          <Tab label="Market Summary" />
          <Tab label="Stock Details" />
          <Tab label="OHLCV Data" />
          <Tab label="Search Results" />
          <Tab label="Technical Indicators" />
        </Tabs>

        <Box p={3}>
          {/* Health Check Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>Health Check Response</Typography>
              {testData.healthCheck ? (
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                  <pre style={{ margin: 0, fontSize: '14px' }}>
                    {formatJson(testData.healthCheck)}
                  </pre>
                </Paper>
              ) : (
                <Typography color="text.secondary">No health check data</Typography>
              )}
            </Box>
          )}

          {/* Stocks List Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>Stocks List</Typography>
              {testData.stocks ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Symbol</TableCell>
                        <TableCell>Company</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Change %</TableCell>
                        <TableCell align="right">Volume</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {testData.stocks.slice(0, 10).map((stock) => (
                        <TableRow key={stock.symbol}>
                          <TableCell>{stock.symbol}</TableCell>
                          <TableCell>{stock.companyName}</TableCell>
                          <TableCell align="right">
                            {stock.lastPrice?.toLocaleString() || '—'}
                          </TableCell>
                          <TableCell align="right">
                            <Typography color={stock.changePercent >= 0 ? 'success.main' : 'error.main'}>
                              {stock.changePercent?.toFixed(2)}%
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {stock.volume?.toLocaleString() || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary">No stocks data</Typography>
              )}
            </Box>
          )}

          {/* Market Summary Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>Market Summary</Typography>
              {testData.marketSummary ? (
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                  <pre style={{ margin: 0, fontSize: '14px' }}>
                    {formatJson(testData.marketSummary)}
                  </pre>
                </Paper>
              ) : (
                <Typography color="text.secondary">No market summary data</Typography>
              )}
            </Box>
          )}

          {/* Stock Details Tab */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Stock Details {testData.stockDetails?.symbol && `(${testData.stockDetails.symbol})`}
              </Typography>
              {testData.stockDetails ? (
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                  <pre style={{ margin: 0, fontSize: '14px' }}>
                    {formatJson(testData.stockDetails)}
                  </pre>
                </Paper>
              ) : (
                <Typography color="text.secondary">No stock details data</Typography>
              )}
            </Box>
          )}

          {/* OHLCV Tab */}
          {activeTab === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                OHLCV Data {testData.ohlcv?.symbol && `(${testData.ohlcv.symbol})`}
              </Typography>
              {testData.ohlcv ? (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    {testData.ohlcv.data.length} records
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: 400, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {formatJson(testData.ohlcv.data.slice(0, 5))} 
                      {testData.ohlcv.data.length > 5 && '\n... (truncated)'}
                    </pre>
                  </Paper>
                </Box>
              ) : (
                <Typography color="text.secondary">No OHLCV data</Typography>
              )}
            </Box>
          )}

          {/* Search Results Tab */}
          {activeTab === 5 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Search Results {testData.searchResults?.query && `for "${testData.searchResults.query}"`}
              </Typography>
              {testData.searchResults ? (
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                  <pre style={{ margin: 0, fontSize: '14px' }}>
                    {formatJson(testData.searchResults)}
                  </pre>
                </Paper>
              ) : (
                <Typography color="text.secondary">No search results</Typography>
              )}
            </Box>
          )}

          {/* Technical Indicators Tab */}
          {activeTab === 6 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Technical Indicators {testData.indicators?.symbol && `(${testData.indicators.symbol})`}
              </Typography>
              {testData.indicators ? (
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                  <pre style={{ margin: 0, fontSize: '14px' }}>
                    {formatJson(testData.indicators)}
                  </pre>
                </Paper>
              ) : (
                <Typography color="text.secondary">No indicators data</Typography>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default BackendIntegration;