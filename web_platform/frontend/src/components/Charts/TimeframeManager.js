import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider
} from '@mui/material';
import {
  AccessTime,
  Add,
  Edit,
  Delete,
  Schedule,
  TrendingUp
} from '@mui/icons-material';

// Standard timeframes
const STANDARD_TIMEFRAMES = {
  // Seconds-based
  '1s': { label: '1S', seconds: 1, type: 'seconds', display: '1 Second' },
  '5s': { label: '5S', seconds: 5, type: 'seconds', display: '5 Seconds' },
  '15s': { label: '15S', seconds: 15, type: 'seconds', display: '15 Seconds' },
  '30s': { label: '30S', seconds: 30, type: 'seconds', display: '30 Seconds' },
  
  // Minutes-based
  '1m': { label: '1M', seconds: 60, type: 'minutes', display: '1 Minute' },
  '3m': { label: '3M', seconds: 180, type: 'minutes', display: '3 Minutes' },
  '5m': { label: '5M', seconds: 300, type: 'minutes', display: '5 Minutes' },
  '15m': { label: '15M', seconds: 900, type: 'minutes', display: '15 Minutes' },
  '30m': { label: '30M', seconds: 1800, type: 'minutes', display: '30 Minutes' },
  
  // Hours-based
  '1h': { label: '1H', seconds: 3600, type: 'hours', display: '1 Hour' },
  '2h': { label: '2H', seconds: 7200, type: 'hours', display: '2 Hours' },
  '4h': { label: '4H', seconds: 14400, type: 'hours', display: '4 Hours' },
  '6h': { label: '6H', seconds: 21600, type: 'hours', display: '6 Hours' },
  '12h': { label: '12H', seconds: 43200, type: 'hours', display: '12 Hours' },
  
  // Days-based
  '1d': { label: '1D', seconds: 86400, type: 'days', display: '1 Day' },
  '3d': { label: '3D', seconds: 259200, type: 'days', display: '3 Days' },
  
  // Weeks-based
  '1w': { label: '1W', seconds: 604800, type: 'weeks', display: '1 Week' },
  '2w': { label: '2W', seconds: 1209600, type: 'weeks', display: '2 Weeks' },
  
  // Months-based (approximate)
  '1M': { label: '1M', seconds: 2592000, type: 'months', display: '1 Month' },
  '3M': { label: '3M', seconds: 7776000, type: 'months', display: '3 Months' },
  '6M': { label: '6M', seconds: 15552000, type: 'months', display: '6 Months' },
  '1Y': { label: '1Y', seconds: 31104000, type: 'years', display: '1 Year' }
};

// Special interval types
const SPECIAL_INTERVALS = {
  TICK: 'tick',
  VOLUME: 'volume', 
  RANGE: 'range',
  RENKO: 'renko',
  KAGI: 'kagi',
  LINE_BREAK: 'line_break',
  POINT_FIGURE: 'point_figure'
};

const TimeframeManager = ({
  selectedTimeframe = '1d',
  onTimeframeChange,
  availableTimeframes = Object.keys(STANDARD_TIMEFRAMES),
  showCustomIntervals = true,
  showSpecialIntervals = false,
  compactMode = false
}) => {
  const [customTimeframes, setCustomTimeframes] = useState({});
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [customInterval, setCustomInterval] = useState({
    name: '',
    value: 1,
    unit: 'minutes',
    type: 'time_based'
  });
  const [specialInterval, setSpecialInterval] = useState({
    type: SPECIAL_INTERVALS.TICK,
    value: 1000,
    name: ''
  });

  // Load custom timeframes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('custom_timeframes');
    if (saved) {
      try {
        setCustomTimeframes(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading custom timeframes:', error);
      }
    }
  }, []);

  // Save custom timeframes to localStorage
  useEffect(() => {
    if (Object.keys(customTimeframes).length > 0) {
      localStorage.setItem('custom_timeframes', JSON.stringify(customTimeframes));
    }
  }, [customTimeframes]);

  // Combine standard and custom timeframes
  const allTimeframes = useMemo(() => {
    const combined = { ...STANDARD_TIMEFRAMES };
    
    // Add custom timeframes
    Object.entries(customTimeframes).forEach(([key, timeframe]) => {
      combined[key] = timeframe;
    });
    
    return combined;
  }, [customTimeframes]);

  // Group timeframes by type
  const groupedTimeframes = useMemo(() => {
    const groups = {
      seconds: [],
      minutes: [],
      hours: [],
      days: [],
      weeks: [],
      months: [],
      years: [],
      custom: []
    };

    Object.entries(allTimeframes).forEach(([key, timeframe]) => {
      if (availableTimeframes.includes(key)) {
        const group = timeframe.type || 'custom';
        if (groups[group]) {
          groups[group].push({ key, ...timeframe });
        }
      }
    });

    return groups;
  }, [allTimeframes, availableTimeframes]);

  const handleTimeframeChange = (event, newTimeframe) => {
    if (newTimeframe !== null) {
      onTimeframeChange && onTimeframeChange(newTimeframe);
    }
  };

  const handleCustomIntervalSave = () => {
    const { name, value, unit } = customInterval;
    if (!name.trim() || !value) return;

    const seconds = calculateSeconds(value, unit);
    const key = `custom_${Date.now()}`;
    
    const newTimeframe = {
      label: name.toUpperCase(),
      seconds: seconds,
      type: 'custom',
      display: `${value} ${unit}`,
      isCustom: true
    };

    setCustomTimeframes({
      ...customTimeframes,
      [key]: newTimeframe
    });

    setCustomInterval({
      name: '',
      value: 1,
      unit: 'minutes',
      type: 'time_based'
    });
    setShowCustomDialog(false);
  };

  const handleSpecialIntervalSave = () => {
    const { type, value, name } = specialInterval;
    if (!name.trim() || !value) return;

    const key = `special_${Date.now()}`;
    const newInterval = {
      label: name.toUpperCase(),
      type: 'special',
      specialType: type,
      value: value,
      display: getSpecialIntervalDisplay(type, value),
      isSpecial: true
    };

    setCustomTimeframes({
      ...customTimeframes,
      [key]: newInterval
    });

    setSpecialInterval({
      type: SPECIAL_INTERVALS.TICK,
      value: 1000,
      name: ''
    });
    setShowSpecialDialog(false);
  };

  const calculateSeconds = (value, unit) => {
    const multipliers = {
      seconds: 1,
      minutes: 60,
      hours: 3600,
      days: 86400,
      weeks: 604800,
      months: 2592000, // 30 days
      years: 31536000 // 365 days
    };
    return value * (multipliers[unit] || 60);
  };

  const getSpecialIntervalDisplay = (type, value) => {
    switch (type) {
      case SPECIAL_INTERVALS.TICK:
        return `${value} Ticks`;
      case SPECIAL_INTERVALS.VOLUME:
        return `${value} Volume`;
      case SPECIAL_INTERVALS.RANGE:
        return `${value} Range`;
      case SPECIAL_INTERVALS.RENKO:
        return `${value} Renko`;
      case SPECIAL_INTERVALS.KAGI:
        return `Kagi ${value}%`;
      case SPECIAL_INTERVALS.LINE_BREAK:
        return `${value} Line Break`;
      case SPECIAL_INTERVALS.POINT_FIGURE:
        return `P&F ${value}`;
      default:
        return `${value}`;
    }
  };

  const deleteCustomTimeframe = (key) => {
    const updated = { ...customTimeframes };
    delete updated[key];
    setCustomTimeframes(updated);
  };

  const renderTimeframeButtons = () => {
    if (compactMode) {
      return (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Timeframe</InputLabel>
          <Select
            value={selectedTimeframe}
            onChange={(e) => onTimeframeChange && onTimeframeChange(e.target.value)}
            label="Timeframe"
          >
            {Object.entries(allTimeframes)
              .filter(([key]) => availableTimeframes.includes(key))
              .map(([key, timeframe]) => (
                <MenuItem key={key} value={key}>
                  {timeframe.label} - {timeframe.display}
                </MenuItem>
              ))
            }
          </Select>
        </FormControl>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(groupedTimeframes).map(([groupName, timeframes]) => {
          if (timeframes.length === 0) return null;
          
          return (
            <Box key={groupName}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                {groupName.charAt(0).toUpperCase() + groupName.slice(1)}
              </Typography>
              <ToggleButtonGroup
                value={selectedTimeframe}
                exclusive
                onChange={handleTimeframeChange}
                size="small"
                sx={{ flexWrap: 'wrap', gap: 0.5 }}
              >
                {timeframes.map(({ key, label, display, isCustom, isSpecial }) => (
                  <ToggleButton 
                    key={key} 
                    value={key}
                    sx={{ 
                      minWidth: 50,
                      position: 'relative'
                    }}
                  >
                    {label}
                    {(isCustom || isSpecial) && (
                      <IconButton
                        size="small"
                        sx={{ 
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: 'error.main',
                          color: 'white',
                          width: 16,
                          height: 16,
                          '&:hover': {
                            bgcolor: 'error.dark'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomTimeframe(key);
                        }}
                      >
                        <Delete sx={{ fontSize: 10 }} />
                      </IconButton>
                    )}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime />
          Timeframes
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {showCustomIntervals && (
            <Tooltip title="Add Custom Interval">
              <IconButton onClick={() => setShowCustomDialog(true)} size="small">
                <Add />
              </IconButton>
            </Tooltip>
          )}
          
          {showSpecialIntervals && (
            <Tooltip title="Add Special Interval">
              <IconButton onClick={() => setShowSpecialDialog(true)} size="small">
                <Schedule />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {renderTimeframeButtons()}

      {/* Current Selection Info */}
      <Box sx={{ mt: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Current: {allTimeframes[selectedTimeframe]?.display || selectedTimeframe}
        </Typography>
      </Box>

      {/* Custom Interval Dialog */}
      <Dialog open={showCustomDialog} onClose={() => setShowCustomDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Custom Interval</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <TextField
              label="Interval Name"
              value={customInterval.name}
              onChange={(e) => setCustomInterval({ ...customInterval, name: e.target.value })}
              placeholder="e.g., 2M, 45m, Custom"
              fullWidth
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Value"
                type="number"
                value={customInterval.value}
                onChange={(e) => setCustomInterval({ ...customInterval, value: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1 }}
                sx={{ flex: 1 }}
              />

              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={customInterval.unit}
                  onChange={(e) => setCustomInterval({ ...customInterval, unit: e.target.value })}
                  label="Unit"
                >
                  <MenuItem value="seconds">Seconds</MenuItem>
                  <MenuItem value="minutes">Minutes</MenuItem>
                  <MenuItem value="hours">Hours</MenuItem>
                  <MenuItem value="days">Days</MenuItem>
                  <MenuItem value="weeks">Weeks</MenuItem>
                  <MenuItem value="months">Months</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Preview: {customInterval.value} {customInterval.unit} 
              ({calculateSeconds(customInterval.value, customInterval.unit)} seconds)
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button onClick={() => setShowCustomDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCustomIntervalSave} 
                variant="contained"
                disabled={!customInterval.name.trim() || !customInterval.value}
              >
                Create
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Special Interval Dialog */}
      <Dialog open={showSpecialDialog} onClose={() => setShowSpecialDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Special Interval</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <TextField
              label="Interval Name"
              value={specialInterval.name}
              onChange={(e) => setSpecialInterval({ ...specialInterval, name: e.target.value })}
              placeholder="e.g., 1000T, 500V, 10R"
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Interval Type</InputLabel>
              <Select
                value={specialInterval.type}
                onChange={(e) => setSpecialInterval({ ...specialInterval, type: e.target.value })}
                label="Interval Type"
              >
                <MenuItem value={SPECIAL_INTERVALS.TICK}>Tick-based</MenuItem>
                <MenuItem value={SPECIAL_INTERVALS.VOLUME}>Volume-based</MenuItem>
                <MenuItem value={SPECIAL_INTERVALS.RANGE}>Range-based</MenuItem>
                <MenuItem value={SPECIAL_INTERVALS.RENKO}>Renko</MenuItem>
                <MenuItem value={SPECIAL_INTERVALS.KAGI}>Kagi</MenuItem>
                <MenuItem value={SPECIAL_INTERVALS.LINE_BREAK}>Line Break</MenuItem>
                <MenuItem value={SPECIAL_INTERVALS.POINT_FIGURE}>Point & Figure</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={getSpecialValueLabel(specialInterval.type)}
              type="number"
              value={specialInterval.value}
              onChange={(e) => setSpecialInterval({ ...specialInterval, value: parseFloat(e.target.value) || 1 })}
              inputProps={{ min: 1, step: specialInterval.type === SPECIAL_INTERVALS.KAGI ? 0.1 : 1 }}
              fullWidth
            />

            <Typography variant="body2" color="text.secondary">
              Preview: {getSpecialIntervalDisplay(specialInterval.type, specialInterval.value)}
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button onClick={() => setShowSpecialDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSpecialIntervalSave} 
                variant="contained"
                disabled={!specialInterval.name.trim() || !specialInterval.value}
              >
                Create
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );
};

const getSpecialValueLabel = (type) => {
  switch (type) {
    case SPECIAL_INTERVALS.TICK:
      return 'Number of Ticks';
    case SPECIAL_INTERVALS.VOLUME:
      return 'Volume Amount';
    case SPECIAL_INTERVALS.RANGE:
      return 'Price Range';
    case SPECIAL_INTERVALS.RENKO:
      return 'Brick Size';
    case SPECIAL_INTERVALS.KAGI:
      return 'Reversal Percentage';
    case SPECIAL_INTERVALS.LINE_BREAK:
      return 'Number of Lines';
    case SPECIAL_INTERVALS.POINT_FIGURE:
      return 'Box Size';
    default:
      return 'Value';
  }
};

export default TimeframeManager;