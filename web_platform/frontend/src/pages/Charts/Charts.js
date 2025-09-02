import React, { useState, useEffect, useRef } from 'react';
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
  ListItemButton
} from '@mui/material';
import {
  Fullscreen,
  Add as AddIcon,
  Remove as RemoveIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import Plot from 'react-plotly.js';
import { useWebSocket } from '../../services/websocket';
import { apiService } from '../../services/api';
import numeral from 'numeral';

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
  const { subscribeToSymbols, prices } = useWebSocket();
  
  const [selectedSymbol, setSelectedSymbol] = useState(urlSymbol || 'USD');
  const [timeframe, setTimeframe] = useState('1d');
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [showVolume, setShowVolume] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const plotRef = useRef(null);

  // Subscribe to real-time data
  useEffect(() => {
    if (selectedSymbol) {
      subscribeToSymbols([selectedSymbol]);
    }
  }, [selectedSymbol, subscribeToSymbols]);

  // Fetch price data
  const { data: priceData, isLoading: priceLoading } = useQuery(
    ['priceData', selectedSymbol, timeframe],
    () => apiService.getPriceData(selectedSymbol, {
      timeframe,
      limit: 500
    }),
    {
      enabled: !!selectedSymbol,
      refetchInterval: 30000
    }
  );

  // Fetch indicator data
  const { data: indicatorData, isLoading: indicatorLoading } = useQuery(
    ['indicators', selectedSymbol, activeIndicators],
    () => {
      if (activeIndicators.length === 0) return null;
      
      const indicatorConfigs = activeIndicators.map(indicator => ({
        type: indicator.type,
        config: indicator.config || {}
      }));

      return apiService.calculateMultipleIndicators(
        selectedSymbol,
        indicatorConfigs,
        { timeframe }
      );
    },
    {
      enabled: !!selectedSymbol && activeIndicators.length > 0,
      refetchInterval: 30000
    }
  );

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

  const createCandlestickChart = () => {
    if (!priceData || !priceData.data || priceData.data.length === 0) {
      return null;
    }

    const data = priceData.data;
    const traces = [];

    // Main candlestick trace
    traces.push({
      type: 'candlestick',
      x: data.map(d => d.timestamp),
      open: data.map(d => d.open),
      high: data.map(d => d.high),
      low: data.map(d => d.low),
      close: data.map(d => d.close),
      name: selectedSymbol,
      increasing: { line: { color: '#26a69a' } },
      decreasing: { line: { color: '#ef5350' } },
      yaxis: 'y',
      xaxis: 'x'
    });

    // Volume trace
    if (showVolume) {
      traces.push({
        type: 'bar',
        x: data.map(d => d.timestamp),
        y: data.map(d => d.volume),
        name: 'Volume',
        marker: {
          color: data.map(d => d.close > d.open ? '#26a69a' : '#ef5350'),
          opacity: 0.7
        },
        yaxis: 'y2',
        xaxis: 'x'
      });
    }

    // Add indicators
    if (indicatorData) {
      Object.entries(indicatorData).forEach(([indicatorType, indicatorValues]) => {
        if (indicatorValues && !indicatorValues.error) {
          addIndicatorTraces(traces, indicatorType, indicatorValues, data);
        }
      });
    }

    return traces;
  };

  const addIndicatorTraces = (traces, indicatorType, indicatorValues, priceData) => {
    const timestamps = indicatorValues.values?.map(v => v.timestamp) || [];

    switch (indicatorType) {
      case 'sma':
      case 'ema':
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: timestamps,
          y: indicatorValues.values?.map(v => v.value) || [],
          name: `${indicatorType.toUpperCase()}(${indicatorValues.period})`,
          line: { color: indicatorType === 'sma' ? '#2196f3' : '#ff9800', width: 2 },
          yaxis: 'y'
        });
        break;
      
      case 'bollinger_bands':
        if (indicatorValues.values) {
          ['upper', 'middle', 'lower'].forEach((band, index) => {
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: timestamps,
              y: indicatorValues.values.map(v => v[band]).filter(v => v !== null),
              name: `BB ${band.toUpperCase()}`,
              line: { 
                color: ['#f44336', '#2196f3', '#f44336'][index],
                width: index === 1 ? 2 : 1,
                dash: index !== 1 ? 'dot' : 'solid'
              },
              yaxis: 'y'
            });
          });
        }
        break;
      
      case 'rsi':
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: timestamps,
          y: indicatorValues.values?.map(v => v.value) || [],
          name: `RSI(${indicatorValues.period})`,
          line: { color: '#9c27b0', width: 2 },
          yaxis: 'y3'
        });
        
        // Add overbought/oversold lines
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: [timestamps[0], timestamps[timestamps.length - 1]],
          y: [70, 70],
          name: 'Overbought',
          line: { color: '#f44336', width: 1, dash: 'dash' },
          yaxis: 'y3',
          showlegend: false
        });
        
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: [timestamps[0], timestamps[timestamps.length - 1]],
          y: [30, 30],
          name: 'Oversold',
          line: { color: '#4caf50', width: 1, dash: 'dash' },
          yaxis: 'y3',
          showlegend: false
        });
        break;
      
      case 'macd':
        if (indicatorValues.values) {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: timestamps,
            y: indicatorValues.values.map(v => v.macd).filter(v => v !== null),
            name: 'MACD',
            line: { color: '#2196f3', width: 2 },
            yaxis: 'y4'
          });
          
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: timestamps,
            y: indicatorValues.values.map(v => v.signal).filter(v => v !== null),
            name: 'Signal',
            line: { color: '#ff9800', width: 2 },
            yaxis: 'y4'
          });
          
          traces.push({
            type: 'bar',
            x: timestamps,
            y: indicatorValues.values.map(v => v.histogram).filter(v => v !== null),
            name: 'Histogram',
            marker: { color: '#9e9e9e', opacity: 0.7 },
            yaxis: 'y4'
          });
        }
        break;
    }
  };

  const getLayout = () => {
    const hasRSI = activeIndicators.some(i => i.type === 'rsi');
    const hasMACD = activeIndicators.some(i => i.type === 'macd');
    
    let yAxisCount = 1;
    if (showVolume) yAxisCount = 2;
    if (hasRSI) yAxisCount = 3;
    if (hasMACD) yAxisCount = 4;

    const layout = {
      title: {
        text: `${selectedSymbol} - ${timeframe.toUpperCase()}`,
        font: { color: '#F0F6FC', size: 20 }
      },
      plot_bgcolor: '#0D1117',
      paper_bgcolor: '#161B22',
      font: { color: '#F0F6FC' },
      xaxis: {
        type: 'date',
        gridcolor: '#30363D',
        showgrid: true,
        domain: [0, 1]
      },
      yaxis: {
        title: 'Price',
        gridcolor: '#30363D',
        showgrid: true,
        domain: yAxisCount === 1 ? [0, 1] : yAxisCount === 2 ? [0.3, 1] : yAxisCount === 3 ? [0.5, 1] : [0.6, 1],
        fixedrange: false
      },
      showlegend: true,
      legend: {
        orientation: 'h',
        y: -0.1,
        font: { color: '#F0F6FC' }
      },
      margin: { l: 60, r: 60, t: 60, b: 100 },
      hovermode: 'x unified'
    };

    // Volume axis
    if (showVolume) {
      layout.yaxis2 = {
        title: 'Volume',
        gridcolor: '#30363D',
        showgrid: false,
        domain: yAxisCount === 2 ? [0, 0.25] : yAxisCount === 3 ? [0.3, 0.45] : [0.4, 0.55],
        fixedrange: false
      };
    }

    // RSI axis
    if (hasRSI) {
      layout.yaxis3 = {
        title: 'RSI',
        gridcolor: '#30363D',
        showgrid: true,
        domain: yAxisCount === 3 ? [0, 0.25] : [0.2, 0.35],
        range: [0, 100],
        fixedrange: false
      };
    }

    // MACD axis
    if (hasMACD) {
      layout.yaxis4 = {
        title: 'MACD',
        gridcolor: '#30363D',
        showgrid: true,
        domain: [0, 0.15],
        fixedrange: false
      };
    }

    return layout;
  };

  const currentPrice = prices[selectedSymbol];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" fontWeight="bold">
            {selectedSymbol}
          </Typography>
          {currentPrice && (
            <Box>
              <Typography 
                variant="h6" 
                color={currentPrice.change >= 0 ? 'success.main' : 'error.main'}
                fontWeight="bold"
              >
                {numeral(currentPrice.price).format('0,0')}
              </Typography>
              <Typography 
                variant="body2"
                color={currentPrice.change >= 0 ? 'success.main' : 'error.main'}
              >
                {currentPrice.change >= 0 ? '+' : ''}{numeral(currentPrice.change_percent / 100).format('0.00%')}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

          {/* Fullscreen */}
          <Tooltip title="Fullscreen">
            <IconButton onClick={() => setIsFullscreen(!isFullscreen)}>
              <Fullscreen />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        {/* Chart */}
        <Grid item xs={12} lg={9}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', p: 1 }}>
              {priceLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">Loading chart...</Typography>
                </Box>
              ) : (
                <Plot
                  ref={plotRef}
                  data={createCandlestickChart() || []}
                  layout={getLayout()}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
                  }}
                  style={{ width: '100%', height: '100%' }}
                />
              )}
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
    </Box>
  );
};

export default Charts;