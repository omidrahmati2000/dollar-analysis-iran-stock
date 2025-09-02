import React, { useState, useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import {
  Box,
  FormControl,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  Paper,
  Typography
} from '@mui/material';
import {
  CandlestickChart,
  ShowChart,
  AreaChart,
  BarChart,
  Timeline,
  Straighten,
  TrendingUp,
  Palette,
  GridOn
} from '@mui/icons-material';

const CHART_TYPES = {
  CANDLESTICK: 'candlestick',
  HOLLOW_CANDLESTICK: 'hollow_candlestick', 
  HEIKIN_ASHI: 'heikin_ashi',
  LINE: 'line',
  AREA: 'area',
  BASELINE: 'baseline',
  BARS: 'bars',
  VOLUME: 'volume'
};

const DRAWING_TOOLS = {
  NONE: 'none',
  TREND_LINE: 'trend_line',
  HORIZONTAL_LINE: 'horizontal_line',
  VERTICAL_LINE: 'vertical_line',
  FIBONACCI: 'fibonacci',
  CHANNEL: 'channel',
  TEXT: 'text',
  PRICE_LABEL: 'price_label'
};

const TIMEFRAMES = [
  { value: '1m', label: '1M', seconds: 60 },
  { value: '5m', label: '5M', seconds: 300 },
  { value: '15m', label: '15M', seconds: 900 },
  { value: '30m', label: '30M', seconds: 1800 },
  { value: '1h', label: '1H', seconds: 3600 },
  { value: '4h', label: '4H', seconds: 14400 },
  { value: '1d', label: '1D', seconds: 86400 },
  { value: '1w', label: '1W', seconds: 604800 }
];

const ChartEngine = ({
  symbol,
  data,
  indicators = [],
  onTimeframeChange,
  onChartTypeChange,
  height = 600,
  theme = 'dark'
}) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();
  
  const [chartType, setChartType] = useState(CHART_TYPES.CANDLESTICK);
  const [timeframe, setTimeframe] = useState('1d');
  const [drawingTool, setDrawingTool] = useState(DRAWING_TOOLS.NONE);
  const [showVolume, setShowVolume] = useState(true);
  const [scaleType, setScaleType] = useState('normal'); // normal, logarithmic, percentage
  const [drawings, setDrawings] = useState([]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions = {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: 'solid', color: theme === 'dark' ? '#1a1a1a' : '#ffffff' },
        textColor: theme === 'dark' ? '#d1d4dc' : '#191919',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#2B2B43' : '#f0f0f0' },
        horzLines: { color: theme === 'dark' ? '#2B2B43' : '#f0f0f0' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        mode: scaleType === 'logarithmic' ? 1 : 0, // 0 = normal, 1 = logarithmic
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
    };

    chartRef.current = createChart(chartContainerRef.current, chartOptions);

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [height, theme, scaleType]);

  // Update chart data
  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Remove existing series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
    }

    const processedData = processDataForChartType(data, chartType);
    seriesRef.current = createSeriesForChartType(chartRef.current, chartType, processedData);

    // Add volume series if enabled
    if (showVolume && data.some(d => d.volume)) {
      const volumeData = data.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close > d.open ? '#26a69a80' : '#ef535080'
      }));

      const volumeSeries = chartRef.current.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });
      
      volumeSeries.setData(volumeData);
      
      // Scale volume to 1/4 of main chart
      chartRef.current.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.7,
          bottom: 0,
        },
      });
    }

    chartRef.current.timeScale().fitContent();
  }, [data, chartType, showVolume]);

  // Add indicators
  useEffect(() => {
    if (!chartRef.current || !indicators.length) return;

    indicators.forEach(indicator => {
      if (indicator.data && indicator.data.length > 0) {
        addIndicatorToChart(chartRef.current, indicator);
      }
    });
  }, [indicators]);

  const processDataForChartType = (data, type) => {
    switch (type) {
      case CHART_TYPES.HEIKIN_ASHI:
        return calculateHeikinAshi(data);
      case CHART_TYPES.LINE:
        return data.map(d => ({ time: d.time, value: d.close }));
      case CHART_TYPES.AREA:
        return data.map(d => ({ time: d.time, value: d.close }));
      case CHART_TYPES.BASELINE:
        return data.map(d => ({ time: d.time, value: d.close }));
      default:
        return data;
    }
  };

  const createSeriesForChartType = (chart, type, data) => {
    const commonOptions = {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    };

    switch (type) {
      case CHART_TYPES.CANDLESTICK:
        const candlestickSeries = chart.addCandlestickSeries(commonOptions);
        candlestickSeries.setData(data);
        return candlestickSeries;

      case CHART_TYPES.HOLLOW_CANDLESTICK:
        const hollowSeries = chart.addCandlestickSeries({
          ...commonOptions,
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
        // Convert to hollow candlesticks
        const hollowData = data.map(d => ({
          ...d,
          color: d.close > d.open ? 'transparent' : (d.close < d.open ? '#ef5350' : '#26a69a')
        }));
        hollowSeries.setData(hollowData);
        return hollowSeries;

      case CHART_TYPES.HEIKIN_ASHI:
        const heikinSeries = chart.addCandlestickSeries(commonOptions);
        heikinSeries.setData(data);
        return heikinSeries;

      case CHART_TYPES.LINE:
        const lineSeries = chart.addLineSeries({
          color: '#2196f3',
          lineWidth: 2,
        });
        lineSeries.setData(data);
        return lineSeries;

      case CHART_TYPES.AREA:
        const areaSeries = chart.addAreaSeries({
          topColor: '#2196f340',
          bottomColor: '#2196f300',
          lineColor: '#2196f3',
          lineWidth: 2,
        });
        areaSeries.setData(data);
        return areaSeries;

      case CHART_TYPES.BASELINE:
        const baselineSeries = chart.addBaselineSeries({
          baseValue: { type: 'price', price: data[0]?.value || 0 },
          topFillColor1: '#26a69a40',
          topFillColor2: '#26a69a20',
          bottomFillColor1: '#ef535040',
          bottomFillColor2: '#ef535020',
          topLineColor: '#26a69a',
          bottomLineColor: '#ef5350',
          lineWidth: 2,
        });
        baselineSeries.setData(data);
        return baselineSeries;

      case CHART_TYPES.BARS:
        const barSeries = chart.addHistogramSeries({
          color: '#2196f3',
        });
        barSeries.setData(data.map(d => ({ time: d.time, value: d.close })));
        return barSeries;

      default:
        return null;
    }
  };

  const calculateHeikinAshi = (data) => {
    if (!data.length) return [];
    
    const heikinData = [];
    let prevHeikin = null;

    data.forEach((candle, index) => {
      const heikin = {
        time: candle.time,
        open: 0,
        high: 0,
        low: 0,
        close: 0
      };

      // Heikin Ashi Close = (O + H + L + C) / 4
      heikin.close = (candle.open + candle.high + candle.low + candle.close) / 4;

      if (index === 0) {
        // First candle
        heikin.open = (candle.open + candle.close) / 2;
      } else {
        // Heikin Ashi Open = (previous HA Open + previous HA Close) / 2
        heikin.open = (prevHeikin.open + prevHeikin.close) / 2;
      }

      // Heikin Ashi High = max(High, HA Open, HA Close)
      heikin.high = Math.max(candle.high, heikin.open, heikin.close);

      // Heikin Ashi Low = min(Low, HA Open, HA Close)
      heikin.low = Math.min(candle.low, heikin.open, heikin.close);

      heikinData.push(heikin);
      prevHeikin = heikin;
    });

    return heikinData;
  };

  const addIndicatorToChart = (chart, indicator) => {
    switch (indicator.type) {
      case 'sma':
      case 'ema':
        const maSeries = chart.addLineSeries({
          color: indicator.type === 'sma' ? '#2196f3' : '#ff9800',
          lineWidth: 2,
          title: `${indicator.type.toUpperCase()}(${indicator.period})`
        });
        maSeries.setData(indicator.data);
        break;

      case 'bollinger_bands':
        ['upper', 'middle', 'lower'].forEach((band, index) => {
          const bandSeries = chart.addLineSeries({
            color: ['#f44336', '#2196f3', '#f44336'][index],
            lineWidth: index === 1 ? 2 : 1,
            lineStyle: index !== 1 ? 1 : 0, // 0 = solid, 1 = dotted
            title: `BB ${band.toUpperCase()}`
          });
          bandSeries.setData(indicator.data.map(d => ({
            time: d.time,
            value: d[band]
          })));
        });
        break;

      case 'volume_profile':
        // Implementation for volume profile
        // This would require custom drawing on the chart
        break;

      default:
        break;
    }
  };

  const handleChartTypeChange = (event, newType) => {
    if (newType !== null) {
      setChartType(newType);
      onChartTypeChange && onChartTypeChange(newType);
    }
  };

  const handleTimeframeChange = (event) => {
    const newTimeframe = event.target.value;
    setTimeframe(newTimeframe);
    onTimeframeChange && onTimeframeChange(newTimeframe);
  };

  const handleDrawingToolChange = (event, newTool) => {
    if (newTool !== null) {
      setDrawingTool(newTool);
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      {/* Chart Controls */}
      <Paper sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* Chart Type Selector */}
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={handleChartTypeChange}
          size="small"
        >
          <ToggleButton value={CHART_TYPES.CANDLESTICK}>
            <Tooltip title="Candlestick">
              <CandlestickChart />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={CHART_TYPES.HOLLOW_CANDLESTICK}>
            <Tooltip title="Hollow Candlestick">
              <BarChart />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={CHART_TYPES.HEIKIN_ASHI}>
            <Tooltip title="Heikin Ashi">
              <Timeline />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={CHART_TYPES.LINE}>
            <Tooltip title="Line">
              <ShowChart />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={CHART_TYPES.AREA}>
            <Tooltip title="Area">
              <AreaChart />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={CHART_TYPES.BASELINE}>
            <Tooltip title="Baseline">
              <TrendingUp />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Timeframe Selector */}
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <Select value={timeframe} onChange={handleTimeframeChange}>
            {TIMEFRAMES.map((tf) => (
              <MenuItem key={tf.value} value={tf.value}>
                {tf.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Drawing Tools */}
        <ToggleButtonGroup
          value={drawingTool}
          exclusive
          onChange={handleDrawingToolChange}
          size="small"
        >
          <ToggleButton value={DRAWING_TOOLS.TREND_LINE}>
            <Tooltip title="Trend Line">
              <Straighten />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={DRAWING_TOOLS.FIBONACCI}>
            <Tooltip title="Fibonacci">
              <GridOn />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Scale Type */}
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select
            value={scaleType}
            onChange={(e) => setScaleType(e.target.value)}
          >
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="logarithmic">Log</MenuItem>
            <MenuItem value="percentage">Percentage</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="body2" color="text.secondary">
          {symbol} • {timeframe.toUpperCase()}
        </Typography>
      </Paper>

      {/* Chart Container */}
      <Box
        ref={chartContainerRef}
        sx={{
          width: '100%',
          height: height,
          position: 'relative',
          border: theme === 'dark' ? '1px solid #2B2B43' : '1px solid #e0e0e0',
          borderRadius: 1,
        }}
      />
    </Box>
  );
};

export default ChartEngine;