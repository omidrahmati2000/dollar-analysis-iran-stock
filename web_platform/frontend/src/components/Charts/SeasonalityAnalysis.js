import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemText,
  Switch,
  FormControlLabel,
  Slider
} from '@mui/material';
import {
  CalendarToday,
  TrendingUp,
  TrendingDown,
  Analytics,
  ShowChart,
  BarChart,
  PieChart
} from '@mui/icons-material';
import Plot from 'react-plotly.js';

const SEASONALITY_TYPES = {
  MONTHLY: 'monthly',
  WEEKLY: 'weekly',
  DAILY: 'daily',
  HOURLY: 'hourly',
  YEARLY: 'yearly',
  QUARTERLY: 'quarterly'
};

const PATTERN_TYPES = {
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  NEUTRAL: 'neutral',
  VOLATILE: 'volatile'
};

// Persian calendar months for Iran market
const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const WEEKDAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
];

const SeasonalityAnalysis = ({
  data = [],
  symbol,
  height = 400,
  theme = 'dark',
  usePersianCalendar = true,
  onPatternDetected
}) => {
  const [analysisType, setAnalysisType] = useState(SEASONALITY_TYPES.MONTHLY);
  const [lookbackYears, setLookbackYears] = useState(5);
  const [showPerformance, setShowPerformance] = useState(true);
  const [showVolatility, setShowVolatility] = useState(true);
  const [minSignificance, setMinSignificance] = useState(0.6);
  const [selectedYear, setSelectedYear] = useState('all');

  // Process seasonality data
  const seasonalityData = useMemo(() => {
    if (!data || data.length === 0) return null;

    switch (analysisType) {
      case SEASONALITY_TYPES.MONTHLY:
        return calculateMonthlySeasonality(data, lookbackYears);
      case SEASONALITY_TYPES.WEEKLY:
        return calculateWeeklySeasonality(data, lookbackYears);
      case SEASONALITY_TYPES.DAILY:
        return calculateDailySeasonality(data, lookbackYears);
      case SEASONALITY_TYPES.YEARLY:
        return calculateYearlySeasonality(data);
      case SEASONALITY_TYPES.QUARTERLY:
        return calculateQuarterlySeasonality(data, lookbackYears);
      case SEASONALITY_TYPES.HOURLY:
        return calculateHourlySeasonality(data, lookbackYears);
      default:
        return null;
    }
  }, [data, analysisType, lookbackYears]);

  // Detect patterns
  const detectedPatterns = useMemo(() => {
    if (!seasonalityData) return [];
    return detectSeasonalPatterns(seasonalityData, minSignificance);
  }, [seasonalityData, minSignificance]);

  const calculateMonthlySeasonality = (data, years) => {
    const monthlyData = {};
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years;

    // Initialize months
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = {
        month: i,
        name: usePersianCalendar ? PERSIAN_MONTHS[i] : new Date(2000, i).toLocaleString('default', { month: 'long' }),
        returns: [],
        volatility: [],
        winRate: 0,
        avgReturn: 0,
        avgVolatility: 0,
        count: 0
      };
    }

    data.forEach((candle, index) => {
      const date = new Date(candle.timestamp);
      const year = date.getFullYear();
      
      if (year >= startYear) {
        const month = date.getMonth();
        
        if (index > 0) {
          const prevCandle = data[index - 1];
          const returnPct = ((candle.close - prevCandle.close) / prevCandle.close) * 100;
          const volatility = Math.abs(returnPct);
          
          monthlyData[month].returns.push(returnPct);
          monthlyData[month].volatility.push(volatility);
          monthlyData[month].count++;
        }
      }
    });

    // Calculate statistics
    Object.values(monthlyData).forEach(monthData => {
      if (monthData.returns.length > 0) {
        monthData.avgReturn = monthData.returns.reduce((sum, r) => sum + r, 0) / monthData.returns.length;
        monthData.avgVolatility = monthData.volatility.reduce((sum, v) => sum + v, 0) / monthData.volatility.length;
        monthData.winRate = monthData.returns.filter(r => r > 0).length / monthData.returns.length;
      }
    });

    return Object.values(monthlyData);
  };

  const calculateWeeklySeasonality = (data, years) => {
    const weeklyData = {};
    
    // Initialize weekdays
    for (let i = 0; i < 7; i++) {
      weeklyData[i] = {
        day: i,
        name: WEEKDAYS[i],
        returns: [],
        volatility: [],
        winRate: 0,
        avgReturn: 0,
        avgVolatility: 0,
        count: 0
      };
    }

    data.forEach((candle, index) => {
      if (index > 0) {
        const date = new Date(candle.timestamp);
        // Convert to Persian weekday (Saturday = 0)
        const dayOfWeek = (date.getDay() + 1) % 7;
        
        const prevCandle = data[index - 1];
        const returnPct = ((candle.close - prevCandle.close) / prevCandle.close) * 100;
        const volatility = Math.abs(returnPct);
        
        weeklyData[dayOfWeek].returns.push(returnPct);
        weeklyData[dayOfWeek].volatility.push(volatility);
        weeklyData[dayOfWeek].count++;
      }
    });

    // Calculate statistics
    Object.values(weeklyData).forEach(dayData => {
      if (dayData.returns.length > 0) {
        dayData.avgReturn = dayData.returns.reduce((sum, r) => sum + r, 0) / dayData.returns.length;
        dayData.avgVolatility = dayData.volatility.reduce((sum, v) => sum + v, 0) / dayData.volatility.length;
        dayData.winRate = dayData.returns.filter(r => r > 0).length / dayData.returns.length;
      }
    });

    return Object.values(weeklyData);
  };

  const calculateDailySeasonality = (data, years) => {
    const dailyData = {};
    
    // Initialize days of month
    for (let i = 1; i <= 31; i++) {
      dailyData[i] = {
        day: i,
        name: `Day ${i}`,
        returns: [],
        volatility: [],
        winRate: 0,
        avgReturn: 0,
        avgVolatility: 0,
        count: 0
      };
    }

    data.forEach((candle, index) => {
      if (index > 0) {
        const date = new Date(candle.timestamp);
        const dayOfMonth = date.getDate();
        
        const prevCandle = data[index - 1];
        const returnPct = ((candle.close - prevCandle.close) / prevCandle.close) * 100;
        const volatility = Math.abs(returnPct);
        
        if (dailyData[dayOfMonth]) {
          dailyData[dayOfMonth].returns.push(returnPct);
          dailyData[dayOfMonth].volatility.push(volatility);
          dailyData[dayOfMonth].count++;
        }
      }
    });

    // Calculate statistics
    Object.values(dailyData).forEach(dayData => {
      if (dayData.returns.length > 0) {
        dayData.avgReturn = dayData.returns.reduce((sum, r) => sum + r, 0) / dayData.returns.length;
        dayData.avgVolatility = dayData.volatility.reduce((sum, v) => sum + v, 0) / dayData.volatility.length;
        dayData.winRate = dayData.returns.filter(r => r > 0).length / dayData.returns.length;
      }
    });

    return Object.values(dailyData).filter(day => day.count > 0);
  };

  const calculateYearlySeasonality = (data) => {
    const yearlyData = {};
    
    data.forEach((candle, index) => {
      const year = new Date(candle.timestamp).getFullYear();
      
      if (!yearlyData[year]) {
        yearlyData[year] = {
          year: year,
          name: year.toString(),
          returns: [],
          volatility: [],
          winRate: 0,
          avgReturn: 0,
          avgVolatility: 0,
          count: 0,
          startPrice: candle.open,
          endPrice: candle.close,
          high: candle.high,
          low: candle.low
        };
      }
      
      if (index > 0) {
        const prevCandle = data[index - 1];
        const returnPct = ((candle.close - prevCandle.close) / prevCandle.close) * 100;
        const volatility = Math.abs(returnPct);
        
        yearlyData[year].returns.push(returnPct);
        yearlyData[year].volatility.push(volatility);
        yearlyData[year].count++;
      }
      
      // Update end price and extremes
      yearlyData[year].endPrice = candle.close;
      yearlyData[year].high = Math.max(yearlyData[year].high, candle.high);
      yearlyData[year].low = Math.min(yearlyData[year].low, candle.low);
    });

    // Calculate annual returns and statistics
    Object.values(yearlyData).forEach(yearData => {
      if (yearData.returns.length > 0) {
        yearData.avgReturn = yearData.returns.reduce((sum, r) => sum + r, 0) / yearData.returns.length;
        yearData.avgVolatility = yearData.volatility.reduce((sum, v) => sum + v, 0) / yearData.volatility.length;
        yearData.winRate = yearData.returns.filter(r => r > 0).length / yearData.returns.length;
        yearData.annualReturn = ((yearData.endPrice - yearData.startPrice) / yearData.startPrice) * 100;
      }
    });

    return Object.values(yearlyData);
  };

  const calculateQuarterlySeasonality = (data, years) => {
    const quarterlyData = {};
    
    // Initialize quarters
    for (let i = 1; i <= 4; i++) {
      quarterlyData[i] = {
        quarter: i,
        name: `Q${i}`,
        returns: [],
        volatility: [],
        winRate: 0,
        avgReturn: 0,
        avgVolatility: 0,
        count: 0
      };
    }

    data.forEach((candle, index) => {
      const date = new Date(candle.timestamp);
      const month = date.getMonth();
      const quarter = Math.floor(month / 3) + 1;
      
      if (index > 0) {
        const prevCandle = data[index - 1];
        const returnPct = ((candle.close - prevCandle.close) / prevCandle.close) * 100;
        const volatility = Math.abs(returnPct);
        
        quarterlyData[quarter].returns.push(returnPct);
        quarterlyData[quarter].volatility.push(volatility);
        quarterlyData[quarter].count++;
      }
    });

    // Calculate statistics
    Object.values(quarterlyData).forEach(quarterData => {
      if (quarterData.returns.length > 0) {
        quarterData.avgReturn = quarterData.returns.reduce((sum, r) => sum + r, 0) / quarterData.returns.length;
        quarterData.avgVolatility = quarterData.volatility.reduce((sum, v) => sum + v, 0) / quarterData.volatility.length;
        quarterData.winRate = quarterData.returns.filter(r => r > 0).length / quarterData.returns.length;
      }
    });

    return Object.values(quarterlyData);
  };

  const calculateHourlySeasonality = (data, years) => {
    const hourlyData = {};
    
    // Initialize hours (market hours typically 9-15 in Iran)
    for (let i = 9; i <= 15; i++) {
      hourlyData[i] = {
        hour: i,
        name: `${i}:00`,
        returns: [],
        volatility: [],
        winRate: 0,
        avgReturn: 0,
        avgVolatility: 0,
        count: 0
      };
    }

    data.forEach((candle, index) => {
      const date = new Date(candle.timestamp);
      const hour = date.getHours();
      
      if (hourlyData[hour] && index > 0) {
        const prevCandle = data[index - 1];
        const returnPct = ((candle.close - prevCandle.close) / prevCandle.close) * 100;
        const volatility = Math.abs(returnPct);
        
        hourlyData[hour].returns.push(returnPct);
        hourlyData[hour].volatility.push(volatility);
        hourlyData[hour].count++;
      }
    });

    // Calculate statistics
    Object.values(hourlyData).forEach(hourData => {
      if (hourData.returns.length > 0) {
        hourData.avgReturn = hourData.returns.reduce((sum, r) => sum + r, 0) / hourData.returns.length;
        hourData.avgVolatility = hourData.volatility.reduce((sum, v) => sum + v, 0) / hourData.volatility.length;
        hourData.winRate = hourData.returns.filter(r => r > 0).length / hourData.returns.length;
      }
    });

    return Object.values(hourlyData).filter(hour => hour.count > 0);
  };

  const detectSeasonalPatterns = (data, significance) => {
    if (!data || data.length === 0) return [];
    
    const patterns = [];
    
    data.forEach(period => {
      if (period.count >= 10) { // Minimum sample size
        let patternType = PATTERN_TYPES.NEUTRAL;
        let confidence = 0;
        let description = '';
        
        // Determine pattern based on win rate and average return
        if (period.winRate > 0.6 && period.avgReturn > 0.5) {
          patternType = PATTERN_TYPES.BULLISH;
          confidence = Math.min(period.winRate + (period.avgReturn / 10), 1);
          description = `Strong bullish tendency with ${(period.winRate * 100).toFixed(1)}% win rate`;
        } else if (period.winRate < 0.4 && period.avgReturn < -0.5) {
          patternType = PATTERN_TYPES.BEARISH;
          confidence = Math.min((1 - period.winRate) + Math.abs(period.avgReturn) / 10, 1);
          description = `Strong bearish tendency with ${((1 - period.winRate) * 100).toFixed(1)}% down rate`;
        } else if (period.avgVolatility > 2) {
          patternType = PATTERN_TYPES.VOLATILE;
          confidence = Math.min(period.avgVolatility / 5, 1);
          description = `High volatility period with ${period.avgVolatility.toFixed(2)}% average volatility`;
        }
        
        if (confidence >= significance) {
          patterns.push({
            period: period.name,
            type: patternType,
            confidence: confidence,
            description: description,
            avgReturn: period.avgReturn,
            winRate: period.winRate,
            volatility: period.avgVolatility,
            sampleSize: period.count
          });
        }
      }
    });
    
    // Notify parent component of detected patterns
    if (onPatternDetected && patterns.length > 0) {
      onPatternDetected(patterns);
    }
    
    return patterns.sort((a, b) => b.confidence - a.confidence);
  };

  const createSeasonalityChart = () => {
    if (!seasonalityData) return null;

    const traces = [];
    
    if (showPerformance) {
      traces.push({
        type: 'bar',
        x: seasonalityData.map(d => d.name),
        y: seasonalityData.map(d => d.avgReturn),
        name: 'Average Return (%)',
        marker: {
          color: seasonalityData.map(d => d.avgReturn > 0 ? '#26a69a' : '#ef5350'),
          opacity: 0.8
        },
        text: seasonalityData.map(d => 
          `Return: ${d.avgReturn.toFixed(2)}%<br>Win Rate: ${(d.winRate * 100).toFixed(1)}%`
        ),
        textposition: 'auto',
        hovertemplate: '%{text}<extra></extra>'
      });
    }

    if (showVolatility) {
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: seasonalityData.map(d => d.name),
        y: seasonalityData.map(d => d.avgVolatility),
        name: 'Average Volatility (%)',
        yaxis: 'y2',
        line: { color: '#ff9800', width: 2 },
        marker: { color: '#ff9800', size: 6 }
      });
    }

    return traces;
  };

  const getLayout = () => {
    return {
      title: {
        text: `${symbol} - ${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Seasonality`,
        font: { color: theme === 'dark' ? '#F0F6FC' : '#000', size: 16 }
      },
      plot_bgcolor: theme === 'dark' ? '#0D1117' : '#fff',
      paper_bgcolor: theme === 'dark' ? '#161B22' : '#fff',
      font: { color: theme === 'dark' ? '#F0F6FC' : '#000' },
      xaxis: {
        title: getPeriodLabel(),
        gridcolor: theme === 'dark' ? '#30363D' : '#e0e0e0',
        tickangle: -45
      },
      yaxis: {
        title: 'Average Return (%)',
        gridcolor: theme === 'dark' ? '#30363D' : '#e0e0e0',
        zeroline: true,
        zerolinecolor: theme === 'dark' ? '#666' : '#ccc'
      },
      yaxis2: showVolatility ? {
        title: 'Average Volatility (%)',
        overlaying: 'y',
        side: 'right',
        gridcolor: 'transparent'
      } : undefined,
      showlegend: true,
      legend: {
        orientation: 'h',
        y: -0.2
      },
      margin: { l: 60, r: 60, t: 60, b: 100 },
      hovermode: 'x unified'
    };
  };

  const getPeriodLabel = () => {
    switch (analysisType) {
      case SEASONALITY_TYPES.MONTHLY:
        return 'Month';
      case SEASONALITY_TYPES.WEEKLY:
        return 'Day of Week';
      case SEASONALITY_TYPES.DAILY:
        return 'Day of Month';
      case SEASONALITY_TYPES.YEARLY:
        return 'Year';
      case SEASONALITY_TYPES.QUARTERLY:
        return 'Quarter';
      case SEASONALITY_TYPES.HOURLY:
        return 'Hour';
      default:
        return 'Period';
    }
  };

  const getPatternColor = (type) => {
    switch (type) {
      case PATTERN_TYPES.BULLISH:
        return 'success';
      case PATTERN_TYPES.BEARISH:
        return 'error';
      case PATTERN_TYPES.VOLATILE:
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPatternIcon = (type) => {
    switch (type) {
      case PATTERN_TYPES.BULLISH:
        return <TrendingUp />;
      case PATTERN_TYPES.BEARISH:
        return <TrendingDown />;
      case PATTERN_TYPES.VOLATILE:
        return <Analytics />;
      default:
        return <ShowChart />;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Analysis Type */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Seasonality Analysis
            </Typography>
            <ToggleButtonGroup
              value={analysisType}
              exclusive
              onChange={(e, value) => value && setAnalysisType(value)}
              size="small"
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value={SEASONALITY_TYPES.MONTHLY}>
                <Tooltip title="Monthly">
                  <CalendarToday />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value={SEASONALITY_TYPES.WEEKLY}>
                <Tooltip title="Weekly">
                  <BarChart />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value={SEASONALITY_TYPES.DAILY}>
                <Tooltip title="Daily">
                  <ShowChart />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value={SEASONALITY_TYPES.QUARTERLY}>
                <Tooltip title="Quarterly">
                  <PieChart />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value={SEASONALITY_TYPES.YEARLY}>
                <Tooltip title="Yearly">
                  <TrendingUp />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Settings */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Lookback Years */}
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="body2" gutterBottom>
                Lookback Years: {lookbackYears}
              </Typography>
              <Slider
                value={lookbackYears}
                onChange={(e, value) => setLookbackYears(value)}
                min={1}
                max={10}
                step={1}
                marks
                size="small"
              />
            </Box>

            {/* Pattern Significance */}
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="body2" gutterBottom>
                Min Pattern Significance: {(minSignificance * 100).toFixed(0)}%
              </Typography>
              <Slider
                value={minSignificance}
                onChange={(e, value) => setMinSignificance(value)}
                min={0.5}
                max={1}
                step={0.05}
                size="small"
              />
            </Box>

            {/* Toggles */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showPerformance}
                    onChange={(e) => setShowPerformance(e.target.checked)}
                    size="small"
                  />
                }
                label="Show Performance"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showVolatility}
                    onChange={(e) => setShowVolatility(e.target.checked)}
                    size="small"
                  />
                }
                label="Show Volatility"
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Chart and Patterns */}
      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        {/* Chart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', p: 1 }}>
              {seasonalityData ? (
                <Plot
                  data={createSeasonalityChart()}
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
                  <Typography color="text.secondary">Loading seasonality analysis...</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Detected Patterns */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Analytics />
                Detected Patterns
              </Typography>
              
              {detectedPatterns.length > 0 ? (
                <List dense>
                  {detectedPatterns.map((pattern, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            icon={getPatternIcon(pattern.type)}
                            label={pattern.period}
                            color={getPatternColor(pattern.type)}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {(pattern.confidence * 100).toFixed(0)}% confidence
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {pattern.description}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Avg Return: {pattern.avgReturn.toFixed(2)}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Win Rate: {(pattern.winRate * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                  No significant patterns detected with current criteria
                </Typography>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Patterns are detected based on historical data and should be used as guidance only.
                Past performance does not guarantee future results.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SeasonalityAnalysis;