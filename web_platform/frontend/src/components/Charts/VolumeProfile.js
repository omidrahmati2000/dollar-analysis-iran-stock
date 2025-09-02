import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

class VolumeProfileEngine {
  constructor(data, container, options = {}) {
    this.data = data;
    this.container = container;
    this.options = {
      width: options.width || 1200,
      height: options.height || 600,
      margin: options.margin || { top: 20, right: 200, bottom: 40, left: 80 },
      profileType: options.profileType || 'session',
      rowSize: options.rowSize || 'auto',
      valueArea: options.valueArea || 70,
      ...options
    };
    this.svg = null;
    this.profiles = [];
  }

  calculateVolumeProfile() {
    const priceRange = this.getPriceRange();
    const rowSize = this.calculateRowSize(priceRange);
    const volumeByPrice = new Map();
    
    this.data.forEach(candle => {
      const avgPrice = (candle.high + candle.low) / 2;
      const priceLevel = Math.floor(avgPrice / rowSize) * rowSize;
      
      if (!volumeByPrice.has(priceLevel)) {
        volumeByPrice.set(priceLevel, {
          price: priceLevel,
          volume: 0,
          buyVolume: 0,
          sellVolume: 0,
          tpo: 0,
          timeSpent: 0
        });
      }
      
      const profile = volumeByPrice.get(priceLevel);
      profile.volume += candle.volume;
      
      if (candle.close >= candle.open) {
        profile.buyVolume += candle.volume * 0.6;
        profile.sellVolume += candle.volume * 0.4;
      } else {
        profile.sellVolume += candle.volume * 0.6;
        profile.buyVolume += candle.volume * 0.4;
      }
      
      profile.tpo += 1;
      profile.timeSpent += 1;
    });
    
    return Array.from(volumeByPrice.values()).sort((a, b) => a.price - b.price);
  }

  calculateSessionVolumeProfile() {
    const sessions = this.identifySessions();
    const profiles = [];
    
    sessions.forEach(session => {
      const sessionData = this.data.filter(d => 
        d.timestamp >= session.start && d.timestamp <= session.end
      );
      
      if (sessionData.length > 0) {
        const profile = this.calculateVolumeProfileForData(sessionData);
        profiles.push({
          ...profile,
          session: session,
          type: 'session'
        });
      }
    });
    
    return profiles;
  }

  calculateVolumeProfileForData(data) {
    const priceRange = {
      min: d3.min(data, d => d.low),
      max: d3.max(data, d => d.high)
    };
    
    const rowSize = this.calculateRowSize(priceRange);
    const volumeByPrice = new Map();
    
    data.forEach(candle => {
      for (let price = candle.low; price <= candle.high; price += rowSize) {
        const priceLevel = Math.floor(price / rowSize) * rowSize;
        
        if (!volumeByPrice.has(priceLevel)) {
          volumeByPrice.set(priceLevel, {
            price: priceLevel,
            volume: 0,
            buyVolume: 0,
            sellVolume: 0,
            delta: 0,
            tpo: 0
          });
        }
        
        const profile = volumeByPrice.get(priceLevel);
        const volumeAtLevel = candle.volume / ((candle.high - candle.low) / rowSize);
        profile.volume += volumeAtLevel;
        
        if (candle.close >= candle.open) {
          profile.buyVolume += volumeAtLevel * 0.6;
          profile.sellVolume += volumeAtLevel * 0.4;
        } else {
          profile.sellVolume += volumeAtLevel * 0.6;
          profile.buyVolume += volumeAtLevel * 0.4;
        }
        
        profile.delta = profile.buyVolume - profile.sellVolume;
        profile.tpo += 1;
      }
    });
    
    const profileArray = Array.from(volumeByPrice.values()).sort((a, b) => a.price - b.price);
    
    const poc = this.calculatePOC(profileArray);
    const valueArea = this.calculateValueArea(profileArray);
    
    return {
      profile: profileArray,
      poc: poc,
      valueArea: valueArea,
      high: priceRange.max,
      low: priceRange.min
    };
  }

  calculatePOC(profile) {
    let maxVolume = 0;
    let pocPrice = 0;
    
    profile.forEach(level => {
      if (level.volume > maxVolume) {
        maxVolume = level.volume;
        pocPrice = level.price;
      }
    });
    
    return { price: pocPrice, volume: maxVolume };
  }

  calculateValueArea(profile) {
    const totalVolume = profile.reduce((sum, level) => sum + level.volume, 0);
    const targetVolume = totalVolume * (this.options.valueArea / 100);
    
    const poc = this.calculatePOC(profile);
    let valueAreaVolume = poc.volume;
    let valueAreaHigh = poc.price;
    let valueAreaLow = poc.price;
    
    const pocIndex = profile.findIndex(level => level.price === poc.price);
    let upperIndex = pocIndex + 1;
    let lowerIndex = pocIndex - 1;
    
    while (valueAreaVolume < targetVolume) {
      let upperVolume = 0;
      let lowerVolume = 0;
      
      if (upperIndex < profile.length) {
        upperVolume = profile[upperIndex].volume;
        if (upperIndex + 1 < profile.length) {
          upperVolume += profile[upperIndex + 1].volume;
        }
      }
      
      if (lowerIndex >= 0) {
        lowerVolume = profile[lowerIndex].volume;
        if (lowerIndex - 1 >= 0) {
          lowerVolume += profile[lowerIndex - 1].volume;
        }
      }
      
      if (upperVolume >= lowerVolume && upperIndex < profile.length) {
        valueAreaVolume += profile[upperIndex].volume;
        valueAreaHigh = profile[upperIndex].price;
        upperIndex++;
        if (upperIndex < profile.length && valueAreaVolume < targetVolume) {
          valueAreaVolume += profile[upperIndex].volume;
          valueAreaHigh = profile[upperIndex].price;
          upperIndex++;
        }
      } else if (lowerIndex >= 0) {
        valueAreaVolume += profile[lowerIndex].volume;
        valueAreaLow = profile[lowerIndex].price;
        lowerIndex--;
        if (lowerIndex >= 0 && valueAreaVolume < targetVolume) {
          valueAreaVolume += profile[lowerIndex].volume;
          valueAreaLow = profile[lowerIndex].price;
          lowerIndex--;
        }
      } else {
        break;
      }
    }
    
    return {
      high: valueAreaHigh,
      low: valueAreaLow,
      volume: valueAreaVolume,
      percentage: (valueAreaVolume / totalVolume) * 100
    };
  }

  calculateVolumeFootprint() {
    const footprint = [];
    
    this.data.forEach(candle => {
      const levels = this.calculateFootprintLevels(candle);
      footprint.push({
        timestamp: candle.timestamp,
        date: candle.date,
        levels: levels,
        totalVolume: candle.volume,
        delta: levels.reduce((sum, l) => sum + l.delta, 0),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      });
    });
    
    return footprint;
  }

  calculateFootprintLevels(candle) {
    const levels = [];
    const levelCount = 10;
    const priceStep = (candle.high - candle.low) / levelCount;
    
    for (let i = 0; i < levelCount; i++) {
      const price = candle.low + (i * priceStep);
      const volumeAtLevel = candle.volume / levelCount;
      
      const buyRatio = candle.close >= candle.open ? 0.6 : 0.4;
      const sellRatio = 1 - buyRatio;
      
      levels.push({
        price: price,
        buyVolume: volumeAtLevel * buyRatio,
        sellVolume: volumeAtLevel * sellRatio,
        delta: volumeAtLevel * (buyRatio - sellRatio),
        totalVolume: volumeAtLevel
      });
    }
    
    return levels;
  }

  calculateTPO() {
    const tpoProfile = new Map();
    const priceRange = this.getPriceRange();
    const rowSize = this.calculateRowSize(priceRange);
    
    const periods = this.splitIntoPeriods();
    
    periods.forEach((period, periodIndex) => {
      const letter = String.fromCharCode(65 + (periodIndex % 26));
      
      period.forEach(candle => {
        for (let price = candle.low; price <= candle.high; price += rowSize) {
          const priceLevel = Math.floor(price / rowSize) * rowSize;
          
          if (!tpoProfile.has(priceLevel)) {
            tpoProfile.set(priceLevel, {
              price: priceLevel,
              tpo: [],
              count: 0
            });
          }
          
          const profile = tpoProfile.get(priceLevel);
          if (!profile.tpo.includes(letter)) {
            profile.tpo.push(letter);
            profile.count++;
          }
        }
      });
    });
    
    return Array.from(tpoProfile.values()).sort((a, b) => a.price - b.price);
  }

  splitIntoPeriods() {
    const periodLength = 30 * 60 * 1000;
    const periods = [];
    let currentPeriod = [];
    let periodStart = this.data[0].timestamp;
    
    this.data.forEach(candle => {
      if (candle.timestamp - periodStart >= periodLength) {
        if (currentPeriod.length > 0) {
          periods.push(currentPeriod);
        }
        currentPeriod = [candle];
        periodStart = candle.timestamp;
      } else {
        currentPeriod.push(candle);
      }
    });
    
    if (currentPeriod.length > 0) {
      periods.push(currentPeriod);
    }
    
    return periods;
  }

  calculateMarketProfile() {
    const profile = {
      volumeProfile: this.calculateVolumeProfile(),
      tpoProfile: this.calculateTPO(),
      footprint: this.calculateVolumeFootprint(),
      sessions: this.calculateSessionVolumeProfile(),
      statistics: this.calculateStatistics()
    };
    
    return profile;
  }

  calculateStatistics() {
    const volumes = this.data.map(d => d.volume);
    const prices = this.data.map(d => d.close);
    
    return {
      totalVolume: volumes.reduce((a, b) => a + b, 0),
      avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      maxVolume: Math.max(...volumes),
      minVolume: Math.min(...volumes),
      vwap: this.calculateVWAP(),
      volumeWeightedStdDev: this.calculateVolumeWeightedStdDev(),
      deltaCumulative: this.calculateCumulativeDelta()
    };
  }

  calculateVWAP() {
    let sumPriceVolume = 0;
    let sumVolume = 0;
    
    this.data.forEach(candle => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      sumPriceVolume += typicalPrice * candle.volume;
      sumVolume += candle.volume;
    });
    
    return sumVolume > 0 ? sumPriceVolume / sumVolume : 0;
  }

  calculateVolumeWeightedStdDev() {
    const vwap = this.calculateVWAP();
    let sumSquaredDiff = 0;
    let sumVolume = 0;
    
    this.data.forEach(candle => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      sumSquaredDiff += Math.pow(typicalPrice - vwap, 2) * candle.volume;
      sumVolume += candle.volume;
    });
    
    return Math.sqrt(sumSquaredDiff / sumVolume);
  }

  calculateCumulativeDelta() {
    let cumulativeDelta = 0;
    const deltaProfile = [];
    
    this.data.forEach(candle => {
      const buyVolume = candle.close >= candle.open ? candle.volume * 0.6 : candle.volume * 0.4;
      const sellVolume = candle.volume - buyVolume;
      const delta = buyVolume - sellVolume;
      cumulativeDelta += delta;
      
      deltaProfile.push({
        timestamp: candle.timestamp,
        delta: delta,
        cumulativeDelta: cumulativeDelta
      });
    });
    
    return deltaProfile;
  }

  identifySessions() {
    const sessions = [];
    const sessionLength = 4 * 60 * 60 * 1000;
    
    let sessionStart = this.data[0].timestamp;
    let sessionEnd = sessionStart + sessionLength;
    
    while (sessionStart < this.data[this.data.length - 1].timestamp) {
      sessions.push({
        start: sessionStart,
        end: sessionEnd,
        name: new Date(sessionStart).toLocaleString()
      });
      sessionStart = sessionEnd;
      sessionEnd = sessionStart + sessionLength;
    }
    
    return sessions;
  }

  getPriceRange() {
    return {
      min: d3.min(this.data, d => d.low),
      max: d3.max(this.data, d => d.high)
    };
  }

  calculateRowSize(priceRange) {
    if (this.options.rowSize !== 'auto') {
      return this.options.rowSize;
    }
    
    const range = priceRange.max - priceRange.min;
    const targetRows = 50;
    return range / targetRows;
  }

  render() {
    this.initChart();
    
    switch (this.options.profileType) {
      case 'volume':
        this.renderVolumeProfile();
        break;
      case 'tpo':
        this.renderTPOProfile();
        break;
      case 'footprint':
        this.renderFootprint();
        break;
      case 'session':
        this.renderSessionProfile();
        break;
      default:
        this.renderVolumeProfile();
    }
  }

  initChart() {
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height);
    
    this.chartArea = this.svg.append('g')
      .attr('transform', `translate(${this.options.margin.left},${this.options.margin.top})`);
  }

  renderVolumeProfile() {
    const profile = this.calculateVolumeProfile();
    const poc = this.calculatePOC(profile);
    const valueArea = this.calculateValueArea(profile);
    
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const yScale = d3.scaleLinear()
      .domain([d3.min(profile, d => d.price), d3.max(profile, d => d.price)])
      .range([innerHeight, 0]);
    
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(profile, d => d.volume)])
      .range([0, innerWidth * 0.3]);
    
    this.chartArea.append('rect')
      .attr('class', 'value-area')
      .attr('x', 0)
      .attr('y', yScale(valueArea.high))
      .attr('width', innerWidth)
      .attr('height', yScale(valueArea.low) - yScale(valueArea.high))
      .attr('fill', '#e3f2fd')
      .attr('opacity', 0.3);
    
    const bars = this.chartArea.selectAll('.volume-bar')
      .data(profile)
      .enter().append('g')
      .attr('class', 'volume-bar');
    
    bars.append('rect')
      .attr('x', innerWidth - xScale(0))
      .attr('y', d => yScale(d.price) - 2)
      .attr('width', d => xScale(d.volume))
      .attr('height', 4)
      .attr('fill', d => d.price === poc.price ? '#ff9800' : '#2196f3')
      .attr('opacity', 0.7);
    
    bars.append('rect')
      .attr('x', innerWidth - xScale(0))
      .attr('y', d => yScale(d.price) - 2)
      .attr('width', d => xScale(d.buyVolume))
      .attr('height', 2)
      .attr('fill', '#4caf50')
      .attr('opacity', 0.8);
    
    bars.append('rect')
      .attr('x', innerWidth - xScale(0) + xScale(d => d.buyVolume))
      .attr('y', d => yScale(d.price))
      .attr('width', d => xScale(d.sellVolume))
      .attr('height', 2)
      .attr('fill', '#f44336')
      .attr('opacity', 0.8);
    
    this.chartArea.append('line')
      .attr('class', 'poc-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(poc.price))
      .attr('y2', yScale(poc.price))
      .attr('stroke', '#ff9800')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');
    
    this.addLabels(poc, valueArea, yScale);
  }

  renderTPOProfile() {
    const tpoProfile = this.calculateTPO();
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const yScale = d3.scaleLinear()
      .domain([d3.min(tpoProfile, d => d.price), d3.max(tpoProfile, d => d.price)])
      .range([innerHeight, 0]);
    
    const maxTPO = d3.max(tpoProfile, d => d.count);
    const letterWidth = 12;
    
    tpoProfile.forEach(level => {
      level.tpo.forEach((letter, i) => {
        this.chartArea.append('text')
          .attr('x', innerWidth - (maxTPO - i) * letterWidth)
          .attr('y', yScale(level.price))
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .attr('fill', '#333')
          .text(letter);
      });
    });
  }

  renderFootprint() {
    const footprint = this.calculateVolumeFootprint();
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const xScale = d3.scaleTime()
      .domain(d3.extent(footprint, d => d.date))
      .range([0, innerWidth]);
    
    const yScale = d3.scaleLinear()
      .domain([
        d3.min(footprint, d => d.low),
        d3.max(footprint, d => d.high)
      ])
      .range([innerHeight, 0]);
    
    const barWidth = innerWidth / footprint.length * 0.8;
    
    footprint.forEach(bar => {
      const x = xScale(bar.date);
      
      bar.levels.forEach(level => {
        const y = yScale(level.price);
        
        this.chartArea.append('rect')
          .attr('x', x - barWidth / 2)
          .attr('y', y - 2)
          .attr('width', barWidth / 2)
          .attr('height', 4)
          .attr('fill', '#4caf50')
          .attr('opacity', level.buyVolume / (level.buyVolume + level.sellVolume));
        
        this.chartArea.append('rect')
          .attr('x', x)
          .attr('y', y - 2)
          .attr('width', barWidth / 2)
          .attr('height', 4)
          .attr('fill', '#f44336')
          .attr('opacity', level.sellVolume / (level.buyVolume + level.sellVolume));
        
        this.chartArea.append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('font-size', '8px')
          .attr('fill', level.delta > 0 ? '#4caf50' : '#f44336')
          .text(Math.abs(Math.round(level.delta)));
      });
    });
  }

  renderSessionProfile() {
    const sessions = this.calculateSessionVolumeProfile();
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    const innerHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    
    const sessionWidth = innerWidth / sessions.length;
    
    sessions.forEach((session, i) => {
      const x = i * sessionWidth;
      
      const yScale = d3.scaleLinear()
        .domain([session.low, session.high])
        .range([innerHeight, 0]);
      
      const xScale = d3.scaleLinear()
        .domain([0, d3.max(session.profile, d => d.volume)])
        .range([0, sessionWidth * 0.8]);
      
      session.profile.forEach(level => {
        this.chartArea.append('rect')
          .attr('x', x + sessionWidth - xScale(level.volume))
          .attr('y', yScale(level.price) - 1)
          .attr('width', xScale(level.volume))
          .attr('height', 2)
          .attr('fill', level.price === session.poc.price ? '#ff9800' : '#2196f3')
          .attr('opacity', 0.7);
      });
      
      this.chartArea.append('rect')
        .attr('x', x)
        .attr('y', yScale(session.valueArea.high))
        .attr('width', sessionWidth)
        .attr('height', yScale(session.valueArea.low) - yScale(session.valueArea.high))
        .attr('fill', '#e3f2fd')
        .attr('opacity', 0.2);
    });
  }

  addLabels(poc, valueArea, yScale) {
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    
    this.chartArea.append('text')
      .attr('x', innerWidth + 10)
      .attr('y', yScale(poc.price))
      .attr('font-size', '12px')
      .attr('fill', '#ff9800')
      .text(`POC: ${poc.price.toFixed(2)}`);
    
    this.chartArea.append('text')
      .attr('x', innerWidth + 10)
      .attr('y', yScale(valueArea.high))
      .attr('font-size', '10px')
      .attr('fill', '#2196f3')
      .text(`VAH: ${valueArea.high.toFixed(2)}`);
    
    this.chartArea.append('text')
      .attr('x', innerWidth + 10)
      .attr('y', yScale(valueArea.low))
      .attr('font-size', '10px')
      .attr('fill', '#2196f3')
      .text(`VAL: ${valueArea.low.toFixed(2)}`);
  }

  clear() {
    if (this.svg) {
      this.svg.remove();
    }
  }
}

export const VolumeProfile = React.memo(({ data, type, options }) => {
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    if (!data || !data.length || !containerRef.current) return;

    if (engineRef.current) {
      engineRef.current.clear();
    }

    engineRef.current = new VolumeProfileEngine(data, containerRef.current, {
      ...options,
      profileType: type
    });

    engineRef.current.render();

    return () => {
      if (engineRef.current) {
        engineRef.current.clear();
      }
    };
  }, [data, type, options]);

  const marketProfile = useMemo(() => {
    if (!data || !data.length) return null;
    const engine = new VolumeProfileEngine(data, null, options);
    return engine.calculateMarketProfile();
  }, [data, options]);

  return (
    <div className="volume-profile-container">
      <div ref={containerRef} className="volume-profile-chart" />
      {marketProfile && (
        <div className="volume-profile-stats">
          <div className="stat-item">
            <span>VWAP:</span>
            <span>{marketProfile.statistics.vwap.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span>Total Volume:</span>
            <span>{(marketProfile.statistics.totalVolume / 1000000).toFixed(2)}M</span>
          </div>
          <div className="stat-item">
            <span>Avg Volume:</span>
            <span>{(marketProfile.statistics.avgVolume / 1000).toFixed(2)}K</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default VolumeProfileEngine;