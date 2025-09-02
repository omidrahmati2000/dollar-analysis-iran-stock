/**
 * Chart Comparison - مقایسه چند نماد در یک نمودار
 * Multiple symbol comparison with different visualization modes
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Autocomplete,
  Tooltip,
  Alert,
  CircularProgress,
  Grid
} from '@mui/material';
import {
  Add,
  Remove,
  Palette,
  Timeline,
  ShowChart,
  CompareArrows,
  Normalize,
  Settings,
  Save,
  Share
} from '@mui/icons-material';
import stockRepository from '../../services/repositories/StockRepository';
import localStorageManager from '../../services/storage/LocalStorageManager';

const COMPARISON_MODES = {
  ABSOLUTE: 'absolute',
  NORMALIZED: 'normalized',
  PERCENTAGE: 'percentage',
  RATIO: 'ratio'
};

const CHART_TYPES = {
  LINE: 'line',
  CANDLESTICK: 'candlestick',
  AREA: 'area',
  BASELINE: 'baseline'
};

const DEFAULT_COLORS = [
  '#2196f3', '#f44336', '#4caf50', '#ff9800', 
  '#9c27b0', '#00bcd4', '#ffeb3b', '#795548',
  '#607d8b', '#e91e63', '#3f51b5', '#009688'
];

const ChartComparison = ({ 
  primarySymbol, 
  onDataUpdate,
  theme = 'dark',
  timeframe = '1D'
}) => {
  const [comparisonSymbols, setComparisonSymbols] = useState([]);
  const [symbolInput, setSymbolInput] = useState('');
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [comparisonMode, setComparisonMode] = useState(COMPARISON_MODES.NORMALIZED);
  const [chartType, setChartType] = useState(CHART_TYPES.LINE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [symbolsData, setSymbolsData] = useState({});
  const [baseDate, setBaseDate] = useState(null);
  const [showVolume, setShowVolume] = useState(false);
  const [syncTimeframes, setSyncTimeframes] = useState(true);
  
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [comparisonName, setComparisonName] = useState('');

  // Load available symbols and saved comparisons
  useEffect(() => {
    loadAvailableSymbols();
    loadSavedComparisons();
  }, []);

  // Load data when symbols change
  useEffect(() => {
    if (comparisonSymbols.length > 0) {
      loadComparisonData();
    }
  }, [comparisonSymbols, timeframe, primarySymbol]);

  // Update chart when data or mode changes
  useEffect(() => {
    if (Object.keys(symbolsData).length > 0) {
      updateComparisonChart();
    }
  }, [symbolsData, comparisonMode, chartType, showVolume]);

  const loadAvailableSymbols = async () => {
    try {
      const symbols = await stockRepository.getSymbolsList();
      setAvailableSymbols(symbols || []);
    } catch (error) {
      console.warn('⚠️ Failed to load symbols list:', error);
      setAvailableSymbols([]);
    }
  };

  const loadSavedComparisons = () => {
    const saved = localStorageManager.getNestedData('charts', 'comparisons', []);
    setSavedComparisons(saved);
  };

  const loadComparisonData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const allSymbols = [primarySymbol, ...comparisonSymbols];
      const dataPromises = allSymbols.map(async (symbol) => {
        try {
          const data = await stockRepository.getHistoricalData(symbol, timeframe, 100);
          return { symbol, data: data || [] };
        } catch (error) {
          console.warn(`⚠️ Failed to load data for ${symbol}:`, error);
          return { symbol, data: [] };
        }
      });

      const results = await Promise.allSettled(dataPromises);
      const newSymbolsData = {};

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.data.length > 0) {
          newSymbolsData[result.value.symbol] = result.value.data;
        }
      });

      setSymbolsData(newSymbolsData);

      // Set base date to the earliest common date
      const dates = Object.values(newSymbolsData)
        .map(data => data.map(item => item.time))
        .reduce((acc, times) => {
          return acc.filter(time => times.includes(time));
        });

      if (dates.length > 0) {
        setBaseDate(Math.min(...dates));
      }

    } catch (error) {
      setError('Failed to load comparison data');
      console.error('❌ Comparison data loading error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateComparisonChart = () => {
    if (!onDataUpdate) return;

    const processedData = processDataForComparison();
    onDataUpdate(processedData);
  };

  const processDataForComparison = () => {
    const symbols = Object.keys(symbolsData);
    const processedSeries = [];

    symbols.forEach((symbol, index) => {
      const data = symbolsData[symbol];
      const color = DEFAULT_COLORS[index % DEFAULT_COLORS.length];
      
      let processedData = [...data];

      // Apply comparison mode transformation
      if (comparisonMode !== COMPARISON_MODES.ABSOLUTE && baseDate) {
        const baseValue = getBaseValue(data, baseDate);
        if (baseValue > 0) {
          processedData = transformDataByMode(data, baseValue, comparisonMode);
        }
      }

      // Create series configuration
      const seriesConfig = {
        symbol,
        data: processedData,
        color,
        type: chartType,
        priceLineVisible: index === 0, // Only show price line for primary symbol
        lastValueVisible: true,
        title: symbol
      };

      // Add volume series if enabled
      if (showVolume) {
        const volumeData = data.map(item => ({
          time: item.time,
          value: item.volume || 0,
          color: item.close > item.open ? '#4caf50' : '#f44336'
        }));

        processedSeries.push({
          ...seriesConfig,
          volumeData,
          showVolume: true
        });
      } else {
        processedSeries.push(seriesConfig);
      }
    });

    return {
      series: processedSeries,
      mode: comparisonMode,
      baseDate,
      symbols: symbols.length,
      type: 'comparison'
    };
  };

  const getBaseValue = (data, baseDate) => {
    const baseItem = data.find(item => item.time === baseDate);
    return baseItem ? baseItem.close : data[0]?.close || 0;
  };

  const transformDataByMode = (data, baseValue, mode) => {
    switch (mode) {
      case COMPARISON_MODES.NORMALIZED:
        // Normalize to 100 at base date
        return data.map(item => ({
          ...item,
          open: (item.open / baseValue) * 100,
          high: (item.high / baseValue) * 100,
          low: (item.low / baseValue) * 100,
          close: (item.close / baseValue) * 100
        }));

      case COMPARISON_MODES.PERCENTAGE:
        // Show percentage change from base
        return data.map(item => ({
          ...item,
          open: ((item.open - baseValue) / baseValue) * 100,
          high: ((item.high - baseValue) / baseValue) * 100,
          low: ((item.low - baseValue) / baseValue) * 100,
          close: ((item.close - baseValue) / baseValue) * 100
        }));

      case COMPARISON_MODES.RATIO:
        // Show ratio to base value
        return data.map(item => ({
          ...item,
          open: item.open / baseValue,
          high: item.high / baseValue,
          low: item.low / baseValue,
          close: item.close / baseValue
        }));

      default:
        return data;
    }
  };

  const addSymbolToComparison = () => {
    if (!symbolInput.trim()) return;

    const symbol = symbolInput.toUpperCase().trim();
    
    if (symbol === primarySymbol) {
      setError('Cannot compare symbol with itself');
      return;
    }

    if (comparisonSymbols.includes(symbol)) {
      setError('Symbol already in comparison');
      return;
    }

    if (comparisonSymbols.length >= 10) {
      setError('Maximum 10 symbols allowed for comparison');
      return;
    }

    setComparisonSymbols([...comparisonSymbols, symbol]);
    setSymbolInput('');
    setError(null);
  };

  const removeSymbolFromComparison = (symbolToRemove) => {
    setComparisonSymbols(comparisonSymbols.filter(s => s !== symbolToRemove));
    
    // Remove from data
    const newSymbolsData = { ...symbolsData };
    delete newSymbolsData[symbolToRemove];
    setSymbolsData(newSymbolsData);
  };

  const saveComparison = () => {
    if (!comparisonName.trim()) {
      setError('Please enter a name for the comparison');
      return;
    }

    const comparison = {
      id: Date.now().toString(),
      name: comparisonName.trim(),
      primarySymbol,
      symbols: comparisonSymbols,
      mode: comparisonMode,
      chartType,
      showVolume,
      timeframe,
      createdAt: Date.now()
    };

    const updatedComparisons = [...savedComparisons, comparison];
    setSavedComparisons(updatedComparisons);
    localStorageManager.updateData('charts', 'comparisons', updatedComparisons);
    
    setComparisonName('');
    console.log('💾 Comparison saved:', comparison.name);
  };

  const loadComparison = (comparison) => {
    setComparisonSymbols(comparison.symbols);
    setComparisonMode(comparison.mode);
    setChartType(comparison.chartType);
    setShowVolume(comparison.showVolume);
    console.log('📂 Comparison loaded:', comparison.name);
  };

  const deleteComparison = (comparisonId) => {
    const updatedComparisons = savedComparisons.filter(c => c.id !== comparisonId);
    setSavedComparisons(updatedComparisons);
    localStorageManager.updateData('charts', 'comparisons', updatedComparisons);
  };

  const shareComparison = () => {
    const shareData = {
      primarySymbol,
      symbols: comparisonSymbols,
      mode: comparisonMode,
      chartType,
      timeframe
    };

    const shareUrl = `${window.location.origin}/compare?data=${btoa(JSON.stringify(shareData))}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Chart Comparison',
        text: `Compare ${primarySymbol} with ${comparisonSymbols.join(', ')}`,
        url: shareUrl
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      console.log('🔗 Comparison URL copied to clipboard');
    }
  };

  const resetComparison = () => {
    setComparisonSymbols([]);
    setSymbolsData({});
    setBaseDate(null);
    setError(null);
  };

  const symbolOptions = useMemo(() => {
    return availableSymbols.filter(symbol => 
      symbol !== primarySymbol && 
      !comparisonSymbols.includes(symbol)
    );
  }, [availableSymbols, primarySymbol, comparisonSymbols]);

  return (
    <Box>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Chart Comparison - {primarySymbol}
        </Typography>

        {/* Add Symbol */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
          <Autocomplete
            options={symbolOptions}
            value={symbolInput}
            onInputChange={(event, newInputValue) => setSymbolInput(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Add Symbol"
                size="small"
                sx={{ minWidth: 200 }}
              />
            )}
            freeSolo
          />
          
          <Button 
            onClick={addSymbolToComparison}
            variant="contained"
            startIcon={<Add />}
            size="small"
          >
            Add
          </Button>

          <Button
            onClick={resetComparison}
            size="small"
            startIcon={<Remove />}
          >
            Clear All
          </Button>
        </Box>

        {/* Current Symbols */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Symbols in Comparison:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`${primarySymbol} (Primary)`}
              color="primary"
              variant="filled"
            />
            {comparisonSymbols.map((symbol, index) => (
              <Chip
                key={symbol}
                label={symbol}
                onDelete={() => removeSymbolFromComparison(symbol)}
                sx={{ backgroundColor: DEFAULT_COLORS[index + 1] }}
              />
            ))}
          </Box>
        </Box>

        {/* Comparison Settings */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Comparison Mode</InputLabel>
              <Select
                value={comparisonMode}
                onChange={(e) => setComparisonMode(e.target.value)}
              >
                <MenuItem value={COMPARISON_MODES.ABSOLUTE}>Absolute Prices</MenuItem>
                <MenuItem value={COMPARISON_MODES.NORMALIZED}>Normalized (100)</MenuItem>
                <MenuItem value={COMPARISON_MODES.PERCENTAGE}>Percentage Change</MenuItem>
                <MenuItem value={COMPARISON_MODES.RATIO}>Price Ratio</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Chart Type</InputLabel>
              <Select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
              >
                <MenuItem value={CHART_TYPES.LINE}>Line</MenuItem>
                <MenuItem value={CHART_TYPES.AREA}>Area</MenuItem>
                <MenuItem value={CHART_TYPES.CANDLESTICK}>Candlestick</MenuItem>
                <MenuItem value={CHART_TYPES.BASELINE}>Baseline</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={showVolume}
                  onChange={(e) => setShowVolume(e.target.checked)}
                />
              }
              label="Show Volume"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={syncTimeframes}
                  onChange={(e) => setSyncTimeframes(e.target.checked)}
                />
              }
              label="Sync Timeframes"
            />
          </Grid>
        </Grid>

        {/* Save/Load Comparisons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
          <TextField
            label="Comparison Name"
            value={comparisonName}
            onChange={(e) => setComparisonName(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          
          <Button
            onClick={saveComparison}
            startIcon={<Save />}
            size="small"
            disabled={!comparisonName.trim() || comparisonSymbols.length === 0}
          >
            Save
          </Button>

          <Button
            onClick={shareComparison}
            startIcon={<Share />}
            size="small"
            disabled={comparisonSymbols.length === 0}
          >
            Share
          </Button>
        </Box>

        {/* Saved Comparisons */}
        {savedComparisons.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Saved Comparisons:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {savedComparisons.map((comparison) => (
                <Chip
                  key={comparison.id}
                  label={comparison.name}
                  onClick={() => loadComparison(comparison)}
                  onDelete={() => deleteComparison(comparison.id)}
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Status */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">
              Loading comparison data...
            </Typography>
          </Box>
        )}

        {/* Statistics */}
        {Object.keys(symbolsData).length > 1 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Comparison Statistics:
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(symbolsData).map(([symbol, data]) => {
                const latestData = data[data.length - 1];
                const firstData = data[0];
                const change = latestData && firstData ? 
                  ((latestData.close - firstData.close) / firstData.close) * 100 : 0;

                return (
                  <Grid item xs={6} sm={4} md={3} key={symbol}>
                    <Box sx={{ textAlign: 'center', p: 1, border: 1, borderRadius: 1, borderColor: 'divider' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {symbol}
                      </Typography>
                      <Typography variant="caption" color={change >= 0 ? 'success.main' : 'error.main'}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ChartComparison;