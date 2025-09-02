import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Paper,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  BarChart,
  ShowChart,
  PieChart,
  Timeline
} from '@mui/icons-material';
import Plot from 'react-plotly.js';

const VOLUME_ANALYSIS_TYPES = {
  VOLUME_PROFILE: 'volume_profile',
  VOLUME_FOOTPRINT: 'volume_footprint', 
  SESSION_PROFILE: 'session_profile',
  VISIBLE_RANGE_PROFILE: 'visible_range_profile',
  VOLUME_DELTA: 'volume_delta'
};

const VolumeAnalysis = ({ 
  data = [], 
  symbol,
  height = 400,
  theme = 'dark',
  onVolumeAnalysisChange 
}) => {
  const [analysisType, setAnalysisType] = useState(VOLUME_ANALYSIS_TYPES.VOLUME_PROFILE);
  const [profileRows, setProfileRows] = useState(50);
  const [showValueArea, setShowValueArea] = useState(true);
  const [valueAreaPercentage, setValueAreaPercentage] = useState(70);
  const [timeFrame, setTimeFrame] = useState('session'); // session, visible, custom
  const [showPOC, setShowPOC] = useState(true); // Point of Control

  // Process volume profile data
  const volumeProfileData = useMemo(() => {
    if (!data || data.length === 0) return null;

    switch (analysisType) {
      case VOLUME_ANALYSIS_TYPES.VOLUME_PROFILE:
        return calculateVolumeProfile(data, profileRows);
      case VOLUME_ANALYSIS_TYPES.SESSION_PROFILE:
        return calculateSessionProfile(data, profileRows);
      case VOLUME_ANALYSIS_TYPES.VISIBLE_RANGE_PROFILE:
        return calculateVisibleRangeProfile(data, profileRows);
      case VOLUME_ANALYSIS_TYPES.VOLUME_FOOTPRINT:
        return calculateVolumeFootprint(data);
      case VOLUME_ANALYSIS_TYPES.VOLUME_DELTA:
        return calculateVolumeDelta(data);
      default:
        return null;
    }
  }, [data, analysisType, profileRows]);

  const calculateVolumeProfile = (data, rows) => {
    if (!data.length) return null;

    // Find price range
    const prices = data.flatMap(d => [d.high, d.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceStep = (maxPrice - minPrice) / rows;

    // Create price levels
    const priceLevels = Array.from({ length: rows }, (_, i) => {
      const price = minPrice + (i * priceStep);
      return {
        price: price,
        volume: 0,
        buyVolume: 0,
        sellVolume: 0,
        trades: 0
      };
    });

    // Distribute volume across price levels
    data.forEach(candle => {
      const candleRange = candle.high - candle.low;
      if (candleRange === 0) return;

      const volumePerPrice = candle.volume / candleRange;
      const isBullish = candle.close > candle.open;

      // Distribute volume across the candle's price range
      priceLevels.forEach(level => {
        if (level.price >= candle.low && level.price <= candle.high) {
          const volumeContribution = volumePerPrice * priceStep;
          level.volume += volumeContribution;
          
          // Estimate buy/sell volume based on candle color
          if (isBullish) {
            level.buyVolume += volumeContribution * 0.6;
            level.sellVolume += volumeContribution * 0.4;
          } else {
            level.buyVolume += volumeContribution * 0.4;
            level.sellVolume += volumeContribution * 0.6;
          }
          
          level.trades += 1;
        }
      });
    });

    // Calculate Point of Control (highest volume level)
    const poc = priceLevels.reduce((max, level) => 
      level.volume > max.volume ? level : max
    );

    // Calculate Value Area (area containing specified percentage of volume)
    const sortedLevels = [...priceLevels].sort((a, b) => b.volume - a.volume);
    const totalVolume = sortedLevels.reduce((sum, level) => sum + level.volume, 0);
    const targetVolume = totalVolume * (valueAreaPercentage / 100);

    let accumulatedVolume = 0;
    const valueAreaLevels = [];
    
    for (const level of sortedLevels) {
      if (accumulatedVolume < targetVolume) {
        valueAreaLevels.push(level);
        accumulatedVolume += level.volume;
      } else {
        break;
      }
    }

    const valueAreaHigh = Math.max(...valueAreaLevels.map(l => l.price));
    const valueAreaLow = Math.min(...valueAreaLevels.map(l => l.price));

    return {
      priceLevels,
      poc,
      valueArea: { high: valueAreaHigh, low: valueAreaLow },
      totalVolume,
      maxVolume: Math.max(...priceLevels.map(l => l.volume))
    };
  };

  const calculateSessionProfile = (data, rows) => {
    // Group data by trading sessions (assuming daily sessions)
    const sessions = {};
    
    data.forEach(candle => {
      const sessionKey = new Date(candle.timestamp).toDateString();
      if (!sessions[sessionKey]) {
        sessions[sessionKey] = [];
      }
      sessions[sessionKey].push(candle);
    });

    // Calculate profile for each session
    const sessionProfiles = Object.entries(sessions).map(([session, sessionData]) => ({
      session,
      profile: calculateVolumeProfile(sessionData, rows)
    }));

    return {
      sessions: sessionProfiles,
      currentSession: sessionProfiles[sessionProfiles.length - 1]
    };
  };

  const calculateVisibleRangeProfile = (data, rows) => {
    // For visible range, we use all available data
    // In a real implementation, this would use only visible chart data
    return calculateVolumeProfile(data, rows);
  };

  const calculateVolumeFootprint = (data) => {
    // Volume footprint shows buy/sell volume at each price level for each time period
    return data.map(candle => {
      const priceRange = candle.high - candle.low;
      const priceStep = priceRange / 10; // Divide into 10 price levels
      
      const footprint = Array.from({ length: 10 }, (_, i) => {
        const price = candle.low + (i * priceStep);
        const isBullish = candle.close > candle.open;
        const volumeAtLevel = candle.volume / 10; // Simplified distribution
        
        return {
          price: price,
          buyVolume: isBullish ? volumeAtLevel * 0.6 : volumeAtLevel * 0.4,
          sellVolume: isBullish ? volumeAtLevel * 0.4 : volumeAtLevel * 0.6,
          delta: (isBullish ? volumeAtLevel * 0.6 : volumeAtLevel * 0.4) - 
                (isBullish ? volumeAtLevel * 0.4 : volumeAtLevel * 0.6)
        };
      });

      return {
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        footprint
      };
    });
  };

  const calculateVolumeDelta = (data) => {
    return data.map(candle => {
      const isBullish = candle.close > candle.open;
      const buyVolume = isBullish ? candle.volume * 0.6 : candle.volume * 0.4;
      const sellVolume = candle.volume - buyVolume;
      const delta = buyVolume - sellVolume;
      
      return {
        timestamp: candle.timestamp,
        delta: delta,
        buyVolume: buyVolume,
        sellVolume: sellVolume,
        totalVolume: candle.volume,
        cumulativeDelta: 0 // This would be calculated cumulatively
      };
    });
  };

  const createVolumeProfileChart = () => {
    if (!volumeProfileData || analysisType !== VOLUME_ANALYSIS_TYPES.VOLUME_PROFILE) {
      return null;
    }

    const { priceLevels, poc, valueArea, maxVolume } = volumeProfileData;
    
    const traces = [];

    // Volume histogram
    traces.push({
      type: 'bar',
      orientation: 'h',
      x: priceLevels.map(level => level.volume),
      y: priceLevels.map(level => level.price.toFixed(2)),
      name: 'Volume',
      marker: {
        color: priceLevels.map(level => {
          if (showValueArea && level.price >= valueArea.low && level.price <= valueArea.high) {
            return level === poc ? '#ff9800' : '#2196f3';
          }
          return '#666';
        }),
        opacity: 0.7
      },
      text: priceLevels.map(level => `Volume: ${Math.round(level.volume)}`),
      textposition: 'auto',
      hovertemplate: 'Price: %{y}<br>Volume: %{x}<extra></extra>'
    });

    // Buy/Sell volume breakdown
    traces.push({
      type: 'bar',
      orientation: 'h',
      x: priceLevels.map(level => level.buyVolume),
      y: priceLevels.map(level => level.price.toFixed(2)),
      name: 'Buy Volume',
      marker: { color: '#26a69a', opacity: 0.6 },
      visible: 'legendonly'
    });

    traces.push({
      type: 'bar',
      orientation: 'h',
      x: priceLevels.map(level => -level.sellVolume), // Negative for left side
      y: priceLevels.map(level => level.price.toFixed(2)),
      name: 'Sell Volume',
      marker: { color: '#ef5350', opacity: 0.6 },
      visible: 'legendonly'
    });

    // Point of Control line
    if (showPOC && poc) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [0, maxVolume],
        y: [poc.price, poc.price],
        name: 'POC',
        line: { color: '#ff9800', width: 3, dash: 'dash' },
        showlegend: true
      });
    }

    // Value Area lines
    if (showValueArea && valueArea) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [0, maxVolume],
        y: [valueArea.high, valueArea.high],
        name: 'VAH',
        line: { color: '#4caf50', width: 2, dash: 'dot' },
        showlegend: true
      });

      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [0, maxVolume],
        y: [valueArea.low, valueArea.low],
        name: 'VAL',
        line: { color: '#f44336', width: 2, dash: 'dot' },
        showlegend: true
      });
    }

    return traces;
  };

  const createVolumeFootprintChart = () => {
    if (!volumeProfileData || analysisType !== VOLUME_ANALYSIS_TYPES.VOLUME_FOOTPRINT) {
      return null;
    }

    const traces = [];
    
    // Create heatmap for volume footprint
    const timestamps = volumeProfileData.map(d => new Date(d.timestamp).toLocaleTimeString());
    const prices = volumeProfileData[0]?.footprint.map(f => f.price.toFixed(2)) || [];
    
    const buyVolumeMatrix = volumeProfileData.map(d => 
      d.footprint.map(f => f.buyVolume)
    );
    
    const sellVolumeMatrix = volumeProfileData.map(d => 
      d.footprint.map(f => f.sellVolume)
    );

    traces.push({
      type: 'heatmap',
      z: buyVolumeMatrix,
      x: timestamps,
      y: prices,
      name: 'Buy Volume',
      colorscale: 'Greens',
      showscale: true
    });

    return traces;
  };

  const getLayout = () => {
    const baseLayout = {
      title: {
        text: `${symbol} - ${analysisType.replace('_', ' ').toUpperCase()}`,
        font: { color: theme === 'dark' ? '#F0F6FC' : '#000', size: 16 }
      },
      plot_bgcolor: theme === 'dark' ? '#0D1117' : '#fff',
      paper_bgcolor: theme === 'dark' ? '#161B22' : '#fff',
      font: { color: theme === 'dark' ? '#F0F6FC' : '#000' },
      margin: { l: 60, r: 60, t: 60, b: 60 },
      showlegend: true,
      legend: {
        orientation: 'h',
        y: -0.15
      }
    };

    if (analysisType === VOLUME_ANALYSIS_TYPES.VOLUME_PROFILE) {
      return {
        ...baseLayout,
        xaxis: {
          title: 'Volume',
          gridcolor: theme === 'dark' ? '#30363D' : '#e0e0e0'
        },
        yaxis: {
          title: 'Price',
          gridcolor: theme === 'dark' ? '#30363D' : '#e0e0e0'
        }
      };
    }

    if (analysisType === VOLUME_ANALYSIS_TYPES.VOLUME_FOOTPRINT) {
      return {
        ...baseLayout,
        xaxis: {
          title: 'Time',
          gridcolor: theme === 'dark' ? '#30363D' : '#e0e0e0'
        },
        yaxis: {
          title: 'Price',
          gridcolor: theme === 'dark' ? '#30363D' : '#e0e0e0'
        }
      };
    }

    return baseLayout;
  };

  const handleAnalysisTypeChange = (event, newType) => {
    if (newType !== null) {
      setAnalysisType(newType);
      onVolumeAnalysisChange && onVolumeAnalysisChange(newType);
    }
  };

  const renderVolumeStats = () => {
    if (!volumeProfileData) return null;

    if (analysisType === VOLUME_ANALYSIS_TYPES.VOLUME_PROFILE) {
      const { poc, valueArea, totalVolume } = volumeProfileData;
      
      return (
        <List dense>
          <ListItem>
            <ListItemText 
              primary="Point of Control"
              secondary={poc ? `${poc.price.toFixed(2)} (${Math.round(poc.volume).toLocaleString()})` : 'N/A'}
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Value Area High"
              secondary={valueArea ? valueArea.high.toFixed(2) : 'N/A'}
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Value Area Low"
              secondary={valueArea ? valueArea.low.toFixed(2) : 'N/A'}
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Total Volume"
              secondary={totalVolume ? Math.round(totalVolume).toLocaleString() : 'N/A'}
            />
          </ListItem>
        </List>
      );
    }

    return null;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Analysis Type */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Volume Analysis Type
            </Typography>
            <ToggleButtonGroup
              value={analysisType}
              exclusive
              onChange={handleAnalysisTypeChange}
              size="small"
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value={VOLUME_ANALYSIS_TYPES.VOLUME_PROFILE}>
                <Tooltip title="Volume Profile">
                  <BarChart />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value={VOLUME_ANALYSIS_TYPES.SESSION_PROFILE}>
                <Tooltip title="Session Profile">
                  <Timeline />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value={VOLUME_ANALYSIS_TYPES.VOLUME_FOOTPRINT}>
                <Tooltip title="Volume Footprint">
                  <PieChart />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value={VOLUME_ANALYSIS_TYPES.VOLUME_DELTA}>
                <Tooltip title="Volume Delta">
                  <ShowChart />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Settings */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Profile Rows */}
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="body2" gutterBottom>
                Profile Rows: {profileRows}
              </Typography>
              <Slider
                value={profileRows}
                onChange={(e, value) => setProfileRows(value)}
                min={20}
                max={100}
                step={10}
                marks
                size="small"
              />
            </Box>

            {/* Value Area Percentage */}
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="body2" gutterBottom>
                Value Area: {valueAreaPercentage}%
              </Typography>
              <Slider
                value={valueAreaPercentage}
                onChange={(e, value) => setValueAreaPercentage(value)}
                min={50}
                max={90}
                step={5}
                marks
                size="small"
              />
            </Box>

            {/* Toggles */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showPOC}
                    onChange={(e) => setShowPOC(e.target.checked)}
                    size="small"
                  />
                }
                label="Show POC"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showValueArea}
                    onChange={(e) => setShowValueArea(e.target.checked)}
                    size="small"
                  />
                }
                label="Show Value Area"
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Chart and Stats */}
      <Box sx={{ display: 'flex', flexGrow: 1, gap: 2 }}>
        {/* Chart */}
        <Card sx={{ flexGrow: 1 }}>
          <CardContent sx={{ height: '100%', p: 1 }}>
            {volumeProfileData ? (
              <Plot
                data={analysisType === VOLUME_ANALYSIS_TYPES.VOLUME_FOOTPRINT ? 
                  createVolumeFootprintChart() : createVolumeProfileChart()}
                layout={getLayout()}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  displaylogo: false,
                  modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
                }}
                style={{ width: '100%', height: height }}
              />
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography color="text.secondary">Loading volume analysis...</Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Stats Panel */}
        <Card sx={{ minWidth: 300 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Volume Statistics
            </Typography>
            {renderVolumeStats()}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default VolumeAnalysis;