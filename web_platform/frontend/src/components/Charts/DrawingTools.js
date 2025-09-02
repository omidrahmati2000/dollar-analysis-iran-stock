import React, { useState, useCallback } from 'react';
import {
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  ColorPicker,
  Slider,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Straighten,
  HorizontalRule,
  VerticalAlignCenter,
  Timeline,
  ShowChart,
  TextFields,
  Label,
  CropFree,
  TrendingUp
} from '@mui/icons-material';

const DRAWING_TOOLS = {
  NONE: 'none',
  TREND_LINE: 'trend_line',
  HORIZONTAL_LINE: 'horizontal_line', 
  VERTICAL_LINE: 'vertical_line',
  FIBONACCI_RETRACEMENT: 'fibonacci_retracement',
  FIBONACCI_EXTENSION: 'fibonacci_extension',
  CHANNEL: 'channel',
  RECTANGLE: 'rectangle',
  TRIANGLE: 'triangle',
  TEXT: 'text',
  PRICE_LABEL: 'price_label',
  ARROW: 'arrow'
};

const FIBONACCI_LEVELS = [
  { level: 0, label: '0%', color: '#808080' },
  { level: 23.6, label: '23.6%', color: '#f44336' },
  { level: 38.2, label: '38.2%', color: '#ff9800' },
  { level: 50, label: '50%', color: '#2196f3' },
  { level: 61.8, label: '61.8%', color: '#9c27b0' },
  { level: 78.6, label: '78.6%', color: '#4caf50' },
  { level: 100, label: '100%', color: '#808080' }
];

const DrawingTools = ({ 
  chart, 
  selectedTool, 
  onToolChange, 
  drawings = [],
  onDrawingsChange,
  theme = 'dark' 
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState(null);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  
  const [drawingProperties, setDrawingProperties] = useState({
    color: '#2196f3',
    lineWidth: 1,
    lineStyle: 'solid', // solid, dashed, dotted
    text: '',
    fontSize: 12,
    backgroundColor: 'transparent',
    transparency: 0.5
  });

  const handleToolChange = useCallback((event, newTool) => {
    if (newTool !== null) {
      onToolChange(newTool);
      setIsDrawing(false);
      setCurrentDrawing(null);
    }
  }, [onToolChange]);

  const handleChartClick = useCallback((event, price) => {
    if (selectedTool === DRAWING_TOOLS.NONE) return;

    const point = {
      time: event.time,
      price: price,
      x: event.point?.x || 0,
      y: event.point?.y || 0
    };

    switch (selectedTool) {
      case DRAWING_TOOLS.TREND_LINE:
        handleTrendLineDrawing(point);
        break;
      case DRAWING_TOOLS.HORIZONTAL_LINE:
        handleHorizontalLineDrawing(point);
        break;
      case DRAWING_TOOLS.VERTICAL_LINE:
        handleVerticalLineDrawing(point);
        break;
      case DRAWING_TOOLS.FIBONACCI_RETRACEMENT:
        handleFibonacciDrawing(point);
        break;
      case DRAWING_TOOLS.CHANNEL:
        handleChannelDrawing(point);
        break;
      case DRAWING_TOOLS.RECTANGLE:
        handleRectangleDrawing(point);
        break;
      case DRAWING_TOOLS.TEXT:
        handleTextDrawing(point);
        break;
      case DRAWING_TOOLS.PRICE_LABEL:
        handlePriceLabelDrawing(point);
        break;
      default:
        break;
    }
  }, [selectedTool, isDrawing, currentDrawing]);

  const handleTrendLineDrawing = (point) => {
    if (!isDrawing) {
      // Start drawing
      setIsDrawing(true);
      setCurrentDrawing({
        id: Date.now().toString(),
        type: DRAWING_TOOLS.TREND_LINE,
        points: [point],
        properties: { ...drawingProperties }
      });
    } else {
      // Finish drawing
      const newDrawing = {
        ...currentDrawing,
        points: [...currentDrawing.points, point]
      };
      
      const updatedDrawings = [...drawings, newDrawing];
      onDrawingsChange(updatedDrawings);
      drawTrendLineOnChart(newDrawing);
      
      setIsDrawing(false);
      setCurrentDrawing(null);
      onToolChange(DRAWING_TOOLS.NONE);
    }
  };

  const handleHorizontalLineDrawing = (point) => {
    const newDrawing = {
      id: Date.now().toString(),
      type: DRAWING_TOOLS.HORIZONTAL_LINE,
      points: [point],
      properties: { ...drawingProperties }
    };
    
    const updatedDrawings = [...drawings, newDrawing];
    onDrawingsChange(updatedDrawings);
    drawHorizontalLineOnChart(newDrawing);
    onToolChange(DRAWING_TOOLS.NONE);
  };

  const handleVerticalLineDrawing = (point) => {
    const newDrawing = {
      id: Date.now().toString(),
      type: DRAWING_TOOLS.VERTICAL_LINE,
      points: [point],
      properties: { ...drawingProperties }
    };
    
    const updatedDrawings = [...drawings, newDrawing];
    onDrawingsChange(updatedDrawings);
    drawVerticalLineOnChart(newDrawing);
    onToolChange(DRAWING_TOOLS.NONE);
  };

  const handleFibonacciDrawing = (point) => {
    if (!isDrawing) {
      // Start drawing
      setIsDrawing(true);
      setCurrentDrawing({
        id: Date.now().toString(),
        type: DRAWING_TOOLS.FIBONACCI_RETRACEMENT,
        points: [point],
        properties: { ...drawingProperties }
      });
    } else {
      // Finish drawing
      const newDrawing = {
        ...currentDrawing,
        points: [...currentDrawing.points, point]
      };
      
      const updatedDrawings = [...drawings, newDrawing];
      onDrawingsChange(updatedDrawings);
      drawFibonacciOnChart(newDrawing);
      
      setIsDrawing(false);
      setCurrentDrawing(null);
      onToolChange(DRAWING_TOOLS.NONE);
    }
  };

  const handleChannelDrawing = (point) => {
    if (!isDrawing) {
      setIsDrawing(true);
      setCurrentDrawing({
        id: Date.now().toString(),
        type: DRAWING_TOOLS.CHANNEL,
        points: [point],
        properties: { ...drawingProperties }
      });
    } else if (currentDrawing.points.length === 1) {
      setCurrentDrawing({
        ...currentDrawing,
        points: [...currentDrawing.points, point]
      });
    } else {
      // Finish channel with third point
      const newDrawing = {
        ...currentDrawing,
        points: [...currentDrawing.points, point]
      };
      
      const updatedDrawings = [...drawings, newDrawing];
      onDrawingsChange(updatedDrawings);
      drawChannelOnChart(newDrawing);
      
      setIsDrawing(false);
      setCurrentDrawing(null);
      onToolChange(DRAWING_TOOLS.NONE);
    }
  };

  const handleTextDrawing = (point) => {
    setSelectedDrawing({
      id: Date.now().toString(),
      type: DRAWING_TOOLS.TEXT,
      points: [point],
      properties: { ...drawingProperties }
    });
    setShowPropertiesDialog(true);
  };

  const handlePriceLabelDrawing = (point) => {
    const newDrawing = {
      id: Date.now().toString(),
      type: DRAWING_TOOLS.PRICE_LABEL,
      points: [point],
      properties: { ...drawingProperties, text: point.price.toFixed(2) }
    };
    
    const updatedDrawings = [...drawings, newDrawing];
    onDrawingsChange(updatedDrawings);
    drawPriceLabelOnChart(newDrawing);
    onToolChange(DRAWING_TOOLS.NONE);
  };

  // Drawing functions for chart
  const drawTrendLineOnChart = (drawing) => {
    if (!chart || drawing.points.length < 2) return;

    const series = chart.addLineSeries({
      color: drawing.properties.color,
      lineWidth: drawing.properties.lineWidth,
      lineStyle: getLineStyle(drawing.properties.lineStyle),
      priceLineVisible: false,
      lastValueVisible: false
    });

    const lineData = drawing.points.map(point => ({
      time: point.time,
      value: point.price
    }));

    series.setData(lineData);
    
    // Store series reference for later removal
    drawing.seriesRef = series;
  };

  const drawHorizontalLineOnChart = (drawing) => {
    if (!chart || drawing.points.length < 1) return;

    const price = drawing.points[0].price;
    
    chart.addPriceLine({
      price: price,
      color: drawing.properties.color,
      lineWidth: drawing.properties.lineWidth,
      lineStyle: getLineStyle(drawing.properties.lineStyle),
      axisLabelVisible: true,
      title: `H-Line: ${price.toFixed(2)}`
    });
  };

  const drawVerticalLineOnChart = (drawing) => {
    if (!chart || drawing.points.length < 1) return;

    // Vertical lines require custom implementation with lightweight-charts
    // This is a simplified version
    const time = drawing.points[0].time;
    
    const series = chart.addLineSeries({
      color: drawing.properties.color,
      lineWidth: drawing.properties.lineWidth,
      lineStyle: getLineStyle(drawing.properties.lineStyle),
      priceLineVisible: false,
      lastValueVisible: false
    });

    // Create vertical line by using same time with different prices
    const priceScale = chart.priceScale();
    const minPrice = priceScale.getVisibleLogicalRange()?.from || 0;
    const maxPrice = priceScale.getVisibleLogicalRange()?.to || 100;

    series.setData([
      { time: time, value: minPrice },
      { time: time, value: maxPrice }
    ]);

    drawing.seriesRef = series;
  };

  const drawFibonacciOnChart = (drawing) => {
    if (!chart || drawing.points.length < 2) return;

    const startPoint = drawing.points[0];
    const endPoint = drawing.points[1];
    const priceDiff = endPoint.price - startPoint.price;

    FIBONACCI_LEVELS.forEach(fibLevel => {
      const price = startPoint.price + (priceDiff * fibLevel.level / 100);
      
      const series = chart.addLineSeries({
        color: fibLevel.color,
        lineWidth: 1,
        lineStyle: 1, // dashed
        priceLineVisible: false,
        lastValueVisible: false
      });

      series.setData([
        { time: startPoint.time, value: price },
        { time: endPoint.time, value: price }
      ]);

      // Add label
      chart.addPriceLine({
        price: price,
        color: fibLevel.color,
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: `Fib ${fibLevel.label}`
      });
    });
  };

  const drawChannelOnChart = (drawing) => {
    if (!chart || drawing.points.length < 3) return;

    // Draw parallel lines for channel
    const [point1, point2, point3] = drawing.points;
    
    // Calculate slope from first two points
    const slope = (point2.price - point1.price) / (point2.time - point1.time);
    
    // Main trend line
    const mainSeries = chart.addLineSeries({
      color: drawing.properties.color,
      lineWidth: drawing.properties.lineWidth,
      lineStyle: getLineStyle(drawing.properties.lineStyle),
      priceLineVisible: false,
      lastValueVisible: false
    });

    mainSeries.setData([
      { time: point1.time, value: point1.price },
      { time: point2.time, value: point2.price }
    ]);

    // Parallel line
    const offset = point3.price - (point1.price + slope * (point3.time - point1.time));
    const parallelSeries = chart.addLineSeries({
      color: drawing.properties.color,
      lineWidth: drawing.properties.lineWidth,
      lineStyle: getLineStyle(drawing.properties.lineStyle),
      priceLineVisible: false,
      lastValueVisible: false
    });

    parallelSeries.setData([
      { time: point1.time, value: point1.price + offset },
      { time: point2.time, value: point2.price + offset }
    ]);

    drawing.seriesRef = [mainSeries, parallelSeries];
  };

  const drawPriceLabelOnChart = (drawing) => {
    if (!chart || drawing.points.length < 1) return;

    const price = drawing.points[0].price;
    
    chart.addPriceLine({
      price: price,
      color: drawing.properties.color,
      lineWidth: 2,
      axisLabelVisible: true,
      title: drawing.properties.text || `${price.toFixed(2)}`
    });
  };

  const getLineStyle = (style) => {
    switch (style) {
      case 'dashed':
        return 1;
      case 'dotted':
        return 2;
      default:
        return 0; // solid
    }
  };

  const handlePropertiesSave = () => {
    if (selectedDrawing) {
      const newDrawing = {
        ...selectedDrawing,
        properties: { ...drawingProperties }
      };
      
      const updatedDrawings = [...drawings, newDrawing];
      onDrawingsChange(updatedDrawings);
      
      // Draw on chart based on type
      switch (newDrawing.type) {
        case DRAWING_TOOLS.TEXT:
          drawTextOnChart(newDrawing);
          break;
        default:
          break;
      }
    }
    
    setShowPropertiesDialog(false);
    setSelectedDrawing(null);
    onToolChange(DRAWING_TOOLS.NONE);
  };

  const drawTextOnChart = (drawing) => {
    // Text drawing would require custom overlay implementation
    // This is a simplified version using price line
    const price = drawing.points[0].price;
    
    chart.addPriceLine({
      price: price,
      color: drawing.properties.color,
      lineWidth: 1,
      axisLabelVisible: true,
      title: drawing.properties.text
    });
  };

  const removeDrawing = (drawingId) => {
    const drawingToRemove = drawings.find(d => d.id === drawingId);
    if (drawingToRemove && drawingToRemove.seriesRef) {
      if (Array.isArray(drawingToRemove.seriesRef)) {
        drawingToRemove.seriesRef.forEach(series => chart.removeSeries(series));
      } else {
        chart.removeSeries(drawingToRemove.seriesRef);
      }
    }
    
    const updatedDrawings = drawings.filter(d => d.id !== drawingId);
    onDrawingsChange(updatedDrawings);
  };

  const clearAllDrawings = () => {
    drawings.forEach(drawing => {
      if (drawing.seriesRef) {
        if (Array.isArray(drawing.seriesRef)) {
          drawing.seriesRef.forEach(series => chart.removeSeries(series));
        } else {
          chart.removeSeries(drawing.seriesRef);
        }
      }
    });
    
    onDrawingsChange([]);
  };

  return (
    <Box>
      {/* Drawing Tools */}
      <ToggleButtonGroup
        value={selectedTool}
        exclusive
        onChange={handleToolChange}
        size="small"
        sx={{ flexWrap: 'wrap' }}
      >
        <ToggleButton value={DRAWING_TOOLS.TREND_LINE}>
          <Tooltip title="Trend Line">
            <Straighten />
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value={DRAWING_TOOLS.HORIZONTAL_LINE}>
          <Tooltip title="Horizontal Line">
            <HorizontalRule />
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value={DRAWING_TOOLS.VERTICAL_LINE}>
          <Tooltip title="Vertical Line">
            <VerticalAlignCenter />
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value={DRAWING_TOOLS.FIBONACCI_RETRACEMENT}>
          <Tooltip title="Fibonacci Retracement">
            <Timeline />
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value={DRAWING_TOOLS.CHANNEL}>
          <Tooltip title="Channel">
            <ShowChart />
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value={DRAWING_TOOLS.RECTANGLE}>
          <Tooltip title="Rectangle">
            <CropFree />
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value={DRAWING_TOOLS.TEXT}>
          <Tooltip title="Text">
            <TextFields />
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value={DRAWING_TOOLS.PRICE_LABEL}>
          <Tooltip title="Price Label">
            <Label />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Properties Dialog */}
      <Dialog open={showPropertiesDialog} onClose={() => setShowPropertiesDialog(false)}>
        <DialogTitle>Drawing Properties</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300, pt: 1 }}>
            {selectedDrawing?.type === DRAWING_TOOLS.TEXT && (
              <TextField
                label="Text"
                value={drawingProperties.text}
                onChange={(e) => setDrawingProperties({
                  ...drawingProperties,
                  text: e.target.value
                })}
                fullWidth
              />
            )}
            
            <TextField
              label="Color"
              type="color"
              value={drawingProperties.color}
              onChange={(e) => setDrawingProperties({
                ...drawingProperties,
                color: e.target.value
              })}
            />
            
            <Box>
              <Typography gutterBottom>Line Width</Typography>
              <Slider
                value={drawingProperties.lineWidth}
                onChange={(e, value) => setDrawingProperties({
                  ...drawingProperties,
                  lineWidth: value
                })}
                min={1}
                max={5}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
            
            <FormControl fullWidth>
              <InputLabel>Line Style</InputLabel>
              <Select
                value={drawingProperties.lineStyle}
                onChange={(e) => setDrawingProperties({
                  ...drawingProperties,
                  lineStyle: e.target.value
                })}
              >
                <MenuItem value="solid">Solid</MenuItem>
                <MenuItem value="dashed">Dashed</MenuItem>
                <MenuItem value="dotted">Dotted</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button onClick={() => setShowPropertiesDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handlePropertiesSave} variant="contained">
                Apply
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default DrawingTools;