import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

class ChartTypeManager {
  constructor(data, container, options = {}) {
    this.data = data;
    this.container = container;
    this.options = {
      width: options.width || 1200,
      height: options.height || 600,
      margin: options.margin || { top: 20, right: 80, bottom: 40, left: 80 },
      ...options
    };
    this.svg = null;
    this.xScale = null;
    this.yScale = null;
  }

  initChart() {
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height);
    
    this.chartArea = this.svg.append('g')
      .attr('transform', `translate(${this.options.margin.left},${this.options.margin.top})`);
    
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    this.xScale = d3.scaleTime()
      .domain(d3.extent(this.data, d => d.date))
      .range([0, innerWidth]);
    
    this.yScale = d3.scaleLinear()
      .domain([
        d3.min(this.data, d => d.low) * 0.98,
        d3.max(this.data, d => d.high) * 1.02
      ])
      .range([innerHeight, 0]);
  }

  drawCandlestick() {
    this.initChart();
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const candles = this.chartArea.selectAll('.candle')
      .data(this.data)
      .enter().append('g')
      .attr('class', 'candle')
      .attr('transform', d => `translate(${this.xScale(d.date)},0)`);
    
    candles.append('line')
      .attr('class', 'high-low')
      .attr('y1', d => this.yScale(d.high))
      .attr('y2', d => this.yScale(d.low))
      .attr('stroke', d => d.close >= d.open ? '#26a69a' : '#ef5350')
      .attr('stroke-width', 1);
    
    const candleWidth = Math.max(2, (this.xScale.range()[1] / this.data.length) * 0.7);
    
    candles.append('rect')
      .attr('class', 'body')
      .attr('x', -candleWidth / 2)
      .attr('y', d => this.yScale(Math.max(d.open, d.close)))
      .attr('width', candleWidth)
      .attr('height', d => Math.abs(this.yScale(d.open) - this.yScale(d.close)))
      .attr('fill', d => d.close >= d.open ? '#26a69a' : '#ef5350')
      .attr('stroke', d => d.close >= d.open ? '#26a69a' : '#ef5350');
    
    this.addAxes();
  }

  drawHeikinAshi() {
    const haData = this.calculateHeikinAshi();
    this.data = haData;
    this.drawCandlestick();
  }

  calculateHeikinAshi() {
    const haData = [];
    this.data.forEach((candle, i) => {
      if (i === 0) {
        haData.push({
          date: candle.date,
          open: (candle.open + candle.close) / 2,
          close: (candle.open + candle.high + candle.low + candle.close) / 4,
          high: candle.high,
          low: candle.low,
          volume: candle.volume
        });
      } else {
        const prevHA = haData[i - 1];
        const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
        const haOpen = (prevHA.open + prevHA.close) / 2;
        haData.push({
          date: candle.date,
          open: haOpen,
          close: haClose,
          high: Math.max(candle.high, haOpen, haClose),
          low: Math.min(candle.low, haOpen, haClose),
          volume: candle.volume
        });
      }
    });
    return haData;
  }

  drawRenko() {
    this.initChart();
    const boxSize = this.calculateBoxSize();
    const renkoData = this.calculateRenko(boxSize);
    
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    
    this.xScale = d3.scaleLinear()
      .domain([0, renkoData.length])
      .range([0, innerWidth]);
    
    const boxes = this.chartArea.selectAll('.renko-box')
      .data(renkoData)
      .enter().append('rect')
      .attr('class', 'renko-box')
      .attr('x', (d, i) => this.xScale(i))
      .attr('y', d => this.yScale(d.high))
      .attr('width', innerWidth / renkoData.length * 0.9)
      .attr('height', d => Math.abs(this.yScale(d.high) - this.yScale(d.low)))
      .attr('fill', d => d.direction === 'up' ? '#26a69a' : '#ef5350')
      .attr('stroke', d => d.direction === 'up' ? '#1e7e67' : '#c62828')
      .attr('stroke-width', 1);
    
    this.addAxes();
  }

  calculateRenko(boxSize) {
    const renkoData = [];
    let currentBox = null;
    
    this.data.forEach(candle => {
      if (!currentBox) {
        currentBox = {
          low: Math.floor(candle.close / boxSize) * boxSize,
          high: Math.floor(candle.close / boxSize) * boxSize + boxSize,
          direction: 'up'
        };
        renkoData.push(currentBox);
      } else {
        const diff = candle.close - currentBox.high;
        const boxCount = Math.floor(Math.abs(diff) / boxSize);
        
        if (boxCount >= 1) {
          for (let i = 0; i < boxCount; i++) {
            if (diff > 0) {
              currentBox = {
                low: currentBox.high,
                high: currentBox.high + boxSize,
                direction: 'up'
              };
            } else {
              currentBox = {
                high: currentBox.low,
                low: currentBox.low - boxSize,
                direction: 'down'
              };
            }
            renkoData.push(currentBox);
          }
        }
      }
    });
    
    return renkoData;
  }

  calculateBoxSize() {
    const prices = this.data.map(d => d.close);
    const atr = this.calculateATR(14);
    return atr[atr.length - 1] * 0.5;
  }

  calculateATR(period) {
    const tr = [];
    const atr = [];
    
    this.data.forEach((candle, i) => {
      if (i === 0) {
        tr.push(candle.high - candle.low);
      } else {
        const prevClose = this.data[i - 1].close;
        tr.push(Math.max(
          candle.high - candle.low,
          Math.abs(candle.high - prevClose),
          Math.abs(candle.low - prevClose)
        ));
      }
      
      if (i >= period - 1) {
        if (i === period - 1) {
          atr.push(tr.slice(0, period).reduce((a, b) => a + b) / period);
        } else {
          atr.push((atr[atr.length - 1] * (period - 1) + tr[i]) / period);
        }
      }
    });
    
    return atr;
  }

  drawKagi() {
    this.initChart();
    const reversalAmount = this.calculateReversalAmount();
    const kagiData = this.calculateKagi(reversalAmount);
    
    const line = d3.line()
      .x(d => this.xScale(d.date))
      .y(d => this.yScale(d.price));
    
    this.chartArea.selectAll('.kagi-line')
      .data(kagiData)
      .enter().append('path')
      .attr('class', 'kagi-line')
      .attr('d', d => line(d.points))
      .attr('fill', 'none')
      .attr('stroke', d => d.trend === 'up' ? '#26a69a' : '#ef5350')
      .attr('stroke-width', d => d.thick ? 3 : 1);
    
    this.addAxes();
  }

  calculateKagi(reversalAmount) {
    const kagiLines = [];
    let currentLine = null;
    let prevPrice = this.data[0].close;
    let trend = 'up';
    
    this.data.forEach((candle, i) => {
      if (i === 0) {
        currentLine = {
          points: [{ date: candle.date, price: candle.close }],
          trend: 'up',
          thick: false
        };
      } else {
        const priceChange = candle.close - prevPrice;
        
        if (Math.abs(priceChange) >= reversalAmount) {
          if ((trend === 'up' && priceChange < 0) || (trend === 'down' && priceChange > 0)) {
            kagiLines.push(currentLine);
            trend = priceChange > 0 ? 'up' : 'down';
            currentLine = {
              points: [
                { date: currentLine.points[currentLine.points.length - 1].date, price: prevPrice },
                { date: candle.date, price: candle.close }
              ],
              trend: trend,
              thick: this.determineKagiThickness(candle.close, kagiLines)
            };
          } else {
            currentLine.points.push({ date: candle.date, price: candle.close });
          }
          prevPrice = candle.close;
        }
      }
    });
    
    if (currentLine) kagiLines.push(currentLine);
    return kagiLines;
  }

  determineKagiThickness(price, previousLines) {
    if (previousLines.length < 2) return false;
    const prevHigh = Math.max(...previousLines[previousLines.length - 1].points.map(p => p.price));
    const prevLow = Math.min(...previousLines[previousLines.length - 1].points.map(p => p.price));
    return price > prevHigh || price < prevLow;
  }

  calculateReversalAmount() {
    const prices = this.data.map(d => d.close);
    const avgPrice = prices.reduce((a, b) => a + b) / prices.length;
    return avgPrice * 0.04;
  }

  drawLineBreak(boxCount = 3) {
    this.initChart();
    const lineBreakData = this.calculateLineBreak(boxCount);
    
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    
    this.xScale = d3.scaleLinear()
      .domain([0, lineBreakData.length])
      .range([0, innerWidth]);
    
    const boxes = this.chartArea.selectAll('.line-break-box')
      .data(lineBreakData)
      .enter().append('rect')
      .attr('class', 'line-break-box')
      .attr('x', (d, i) => this.xScale(i))
      .attr('y', d => this.yScale(Math.max(d.open, d.close)))
      .attr('width', innerWidth / lineBreakData.length * 0.9)
      .attr('height', d => Math.abs(this.yScale(d.open) - this.yScale(d.close)))
      .attr('fill', d => d.close > d.open ? '#26a69a' : '#ef5350')
      .attr('stroke', d => d.close > d.open ? '#1e7e67' : '#c62828')
      .attr('stroke-width', 1);
    
    this.addAxes();
  }

  calculateLineBreak(boxCount) {
    const lineBreakData = [];
    
    this.data.forEach((candle, i) => {
      if (i === 0) {
        lineBreakData.push({
          open: candle.open,
          close: candle.close,
          date: candle.date
        });
      } else {
        const prevBoxes = lineBreakData.slice(-boxCount);
        const currentTrend = prevBoxes[prevBoxes.length - 1].close > prevBoxes[prevBoxes.length - 1].open;
        
        if (currentTrend) {
          if (candle.close > prevBoxes[prevBoxes.length - 1].close) {
            lineBreakData.push({
              open: prevBoxes[prevBoxes.length - 1].close,
              close: candle.close,
              date: candle.date
            });
          } else if (candle.close < Math.min(...prevBoxes.map(b => b.open))) {
            lineBreakData.push({
              open: prevBoxes[prevBoxes.length - 1].close,
              close: candle.close,
              date: candle.date
            });
          }
        } else {
          if (candle.close < prevBoxes[prevBoxes.length - 1].close) {
            lineBreakData.push({
              open: prevBoxes[prevBoxes.length - 1].close,
              close: candle.close,
              date: candle.date
            });
          } else if (candle.close > Math.max(...prevBoxes.map(b => b.open))) {
            lineBreakData.push({
              open: prevBoxes[prevBoxes.length - 1].close,
              close: candle.close,
              date: candle.date
            });
          }
        }
      }
    });
    
    return lineBreakData;
  }

  drawPointAndFigure() {
    this.initChart();
    const boxSize = this.calculateBoxSize();
    const reversalAmount = 3;
    const pnfData = this.calculatePointAndFigure(boxSize, reversalAmount);
    
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const columnWidth = innerWidth / pnfData.length;
    const boxHeight = innerHeight / 50;
    
    pnfData.forEach((column, i) => {
      column.boxes.forEach((box, j) => {
        const text = column.type === 'X' ? 'X' : 'O';
        this.chartArea.append('text')
          .attr('x', i * columnWidth + columnWidth / 2)
          .attr('y', this.yScale(box))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', column.type === 'X' ? '#26a69a' : '#ef5350')
          .attr('font-size', Math.min(columnWidth, boxHeight) * 0.8)
          .text(text);
      });
    });
    
    this.addAxes();
  }

  calculatePointAndFigure(boxSize, reversalAmount) {
    const columns = [];
    let currentColumn = null;
    let currentPrice = this.data[0].close;
    
    this.data.forEach(candle => {
      const boxPrice = Math.floor(candle.close / boxSize) * boxSize;
      
      if (!currentColumn) {
        currentColumn = {
          type: 'X',
          boxes: [boxPrice],
          startPrice: boxPrice
        };
      } else {
        const priceDiff = boxPrice - currentColumn.boxes[currentColumn.boxes.length - 1];
        const boxCount = Math.abs(priceDiff / boxSize);
        
        if (currentColumn.type === 'X') {
          if (priceDiff > 0) {
            for (let i = 1; i <= boxCount; i++) {
              currentColumn.boxes.push(currentColumn.boxes[currentColumn.boxes.length - 1] + boxSize);
            }
          } else if (boxCount >= reversalAmount) {
            columns.push(currentColumn);
            currentColumn = {
              type: 'O',
              boxes: [],
              startPrice: currentColumn.boxes[currentColumn.boxes.length - 1]
            };
            for (let i = 1; i <= boxCount; i++) {
              currentColumn.boxes.push(currentColumn.startPrice - i * boxSize);
            }
          }
        } else {
          if (priceDiff < 0) {
            for (let i = 1; i <= boxCount; i++) {
              currentColumn.boxes.push(currentColumn.boxes[currentColumn.boxes.length - 1] - boxSize);
            }
          } else if (boxCount >= reversalAmount) {
            columns.push(currentColumn);
            currentColumn = {
              type: 'X',
              boxes: [],
              startPrice: currentColumn.boxes[currentColumn.boxes.length - 1]
            };
            for (let i = 1; i <= boxCount; i++) {
              currentColumn.boxes.push(currentColumn.startPrice + i * boxSize);
            }
          }
        }
      }
    });
    
    if (currentColumn) columns.push(currentColumn);
    return columns;
  }

  drawRangeBar(rangeSize) {
    this.initChart();
    const rangeData = this.calculateRangeBars(rangeSize);
    
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    
    this.xScale = d3.scaleLinear()
      .domain([0, rangeData.length])
      .range([0, innerWidth]);
    
    const bars = this.chartArea.selectAll('.range-bar')
      .data(rangeData)
      .enter().append('g')
      .attr('class', 'range-bar')
      .attr('transform', (d, i) => `translate(${this.xScale(i)},0)`);
    
    bars.append('line')
      .attr('class', 'high-low')
      .attr('y1', d => this.yScale(d.high))
      .attr('y2', d => this.yScale(d.low))
      .attr('stroke', d => d.close >= d.open ? '#26a69a' : '#ef5350')
      .attr('stroke-width', 1);
    
    const barWidth = Math.max(2, (innerWidth / rangeData.length) * 0.7);
    
    bars.append('rect')
      .attr('class', 'body')
      .attr('x', -barWidth / 2)
      .attr('y', d => this.yScale(Math.max(d.open, d.close)))
      .attr('width', barWidth)
      .attr('height', d => Math.abs(this.yScale(d.open) - this.yScale(d.close)))
      .attr('fill', d => d.close >= d.open ? '#26a69a' : '#ef5350');
    
    this.addAxes();
  }

  calculateRangeBars(rangeSize) {
    const rangeBars = [];
    let currentBar = null;
    
    this.data.forEach(tick => {
      if (!currentBar) {
        currentBar = {
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close,
          volume: tick.volume,
          date: tick.date
        };
      } else {
        currentBar.high = Math.max(currentBar.high, tick.high);
        currentBar.low = Math.min(currentBar.low, tick.low);
        currentBar.close = tick.close;
        currentBar.volume += tick.volume;
        
        if (currentBar.high - currentBar.low >= rangeSize) {
          rangeBars.push(currentBar);
          currentBar = null;
        }
      }
    });
    
    if (currentBar) rangeBars.push(currentBar);
    return rangeBars;
  }

  drawHollowCandles() {
    this.initChart();
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const candles = this.chartArea.selectAll('.hollow-candle')
      .data(this.data)
      .enter().append('g')
      .attr('class', 'hollow-candle')
      .attr('transform', d => `translate(${this.xScale(d.date)},0)`);
    
    candles.append('line')
      .attr('class', 'high-low')
      .attr('y1', d => this.yScale(d.high))
      .attr('y2', d => this.yScale(d.low))
      .attr('stroke', d => d.close >= d.open ? '#26a69a' : '#ef5350')
      .attr('stroke-width', 1);
    
    const candleWidth = Math.max(2, (this.xScale.range()[1] / this.data.length) * 0.7);
    
    candles.append('rect')
      .attr('class', 'body')
      .attr('x', -candleWidth / 2)
      .attr('y', d => this.yScale(Math.max(d.open, d.close)))
      .attr('width', candleWidth)
      .attr('height', d => Math.abs(this.yScale(d.open) - this.yScale(d.close)))
      .attr('fill', (d, i) => {
        if (i === 0) return d.close >= d.open ? '#26a69a' : '#ef5350';
        const prevClose = this.data[i - 1].close;
        return d.close >= prevClose ? 'none' : (d.close >= d.open ? '#26a69a' : '#ef5350');
      })
      .attr('stroke', d => d.close >= d.open ? '#26a69a' : '#ef5350')
      .attr('stroke-width', 1);
    
    this.addAxes();
  }

  drawBaseline(baselineValue) {
    this.initChart();
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const baseline = baselineValue || d3.mean(this.data, d => d.close);
    
    const area = d3.area()
      .x(d => this.xScale(d.date))
      .y0(this.yScale(baseline))
      .y1(d => this.yScale(d.close));
    
    this.chartArea.append('line')
      .attr('class', 'baseline')
      .attr('x1', 0)
      .attr('x2', this.xScale.range()[1])
      .attr('y1', this.yScale(baseline))
      .attr('y2', this.yScale(baseline))
      .attr('stroke', '#888')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');
    
    this.chartArea.append('path')
      .datum(this.data.filter(d => d.close >= baseline))
      .attr('class', 'area-above')
      .attr('d', area)
      .attr('fill', '#26a69a')
      .attr('opacity', 0.3);
    
    this.chartArea.append('path')
      .datum(this.data.filter(d => d.close < baseline))
      .attr('class', 'area-below')
      .attr('d', area)
      .attr('fill', '#ef5350')
      .attr('opacity', 0.3);
    
    const line = d3.line()
      .x(d => this.xScale(d.date))
      .y(d => this.yScale(d.close));
    
    this.chartArea.append('path')
      .datum(this.data)
      .attr('class', 'price-line')
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#2196F3')
      .attr('stroke-width', 2);
    
    this.addAxes();
  }

  addAxes() {
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const xAxis = d3.axisBottom(this.xScale)
      .ticks(10)
      .tickFormat(d3.timeFormat('%Y-%m-%d'));
    
    const yAxis = d3.axisLeft(this.yScale)
      .ticks(10);
    
    this.chartArea.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);
    
    this.chartArea.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);
  }

  clear() {
    if (this.svg) {
      this.svg.remove();
    }
  }
}

export const ChartTypes = React.memo(({ data, type, options }) => {
  const containerRef = useRef(null);
  const chartManagerRef = useRef(null);

  useEffect(() => {
    if (!data || !data.length || !containerRef.current) return;

    if (chartManagerRef.current) {
      chartManagerRef.current.clear();
    }

    chartManagerRef.current = new ChartTypeManager(data, containerRef.current, options);

    switch (type) {
      case 'candlestick':
        chartManagerRef.current.drawCandlestick();
        break;
      case 'heikinashi':
        chartManagerRef.current.drawHeikinAshi();
        break;
      case 'renko':
        chartManagerRef.current.drawRenko();
        break;
      case 'kagi':
        chartManagerRef.current.drawKagi();
        break;
      case 'linebreak':
        chartManagerRef.current.drawLineBreak();
        break;
      case 'pointfigure':
        chartManagerRef.current.drawPointAndFigure();
        break;
      case 'rangebar':
        chartManagerRef.current.drawRangeBar(options.rangeSize || 10);
        break;
      case 'hollow':
        chartManagerRef.current.drawHollowCandles();
        break;
      case 'baseline':
        chartManagerRef.current.drawBaseline(options.baseline);
        break;
      default:
        chartManagerRef.current.drawCandlestick();
    }

    return () => {
      if (chartManagerRef.current) {
        chartManagerRef.current.clear();
      }
    };
  }, [data, type, options]);

  return <div ref={containerRef} className="chart-container" />;
});

export default ChartTypeManager;