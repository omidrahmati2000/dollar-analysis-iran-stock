/**
 * Chart Replay Component - بازپخش تاریخی نمودار
 * Bar replay functionality for historical market playback
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { ChartTypes } from './ChartTypes';

class ChartReplayEngine {
  constructor(data, container, options = {}) {
    this.fullData = data || [];
    this.container = container;
    this.options = {
      width: options.width || 1200,
      height: options.height || 600,
      margin: options.margin || { top: 20, right: 80, bottom: 80, left: 80 },
      ...options
    };
    
    // Replay state
    this.currentIndex = 0;
    this.isPlaying = false;
    this.playSpeed = 1; // 1x, 2x, 4x, etc.
    this.stepMode = 'bar'; // 'bar', 'tick', 'second'
    
    // Playback controls
    this.playInterval = null;
    this.baseSpeed = 500; // milliseconds per step
    
    // Chart instance
    this.chartManager = null;
    
    // Callbacks
    this.onProgressChange = options.onProgressChange || (() => {});
    this.onPlayStateChange = options.onPlayStateChange || (() => {});
    this.onDataUpdate = options.onDataUpdate || (() => {});
  }

  /**
   * Initialize replay system
   */
  initialize() {
    if (!this.fullData || this.fullData.length === 0) {
      throw new Error('No data available for replay');
    }

    console.log(`🎬 Chart Replay initialized with ${this.fullData.length} data points`);
    
    // Start from beginning
    this.currentIndex = 0;
    this.updateChart();
    
    return {
      totalBars: this.fullData.length,
      currentIndex: this.currentIndex,
      canPlay: true
    };
  }

  /**
   * Update chart with current data slice
   */
  updateChart() {
    if (!this.container || this.currentIndex >= this.fullData.length) {
      return;
    }

    // Get data up to current index
    const currentData = this.fullData.slice(0, this.currentIndex + 1);
    
    if (this.chartManager) {
      this.chartManager.clear();
    }

    // Create new chart with current data
    this.chartManager = new (require('./ChartTypes').default)(
      currentData, 
      this.container, 
      this.options
    );

    // Draw chart based on type
    const chartType = this.options.chartType || 'candlestick';
    switch (chartType) {
      case 'candlestick':
        this.chartManager.drawCandlestick();
        break;
      case 'heikinashi':
        this.chartManager.drawHeikinAshi();
        break;
      case 'renko':
        this.chartManager.drawRenko();
        break;
      default:
        this.chartManager.drawCandlestick();
    }

    // Add progress indicator
    this.addProgressIndicator();
    
    // Notify callbacks
    this.onDataUpdate(currentData);
    this.onProgressChange({
      currentIndex: this.currentIndex,
      totalBars: this.fullData.length,
      progress: (this.currentIndex / this.fullData.length) * 100,
      currentBar: this.fullData[this.currentIndex]
    });
  }

  /**
   * Add visual progress indicator to chart
   */
  addProgressIndicator() {
    if (!this.chartManager || !this.chartManager.svg) {
      return;
    }

    const svg = this.chartManager.svg;
    const innerWidth = this.options.width - this.options.margin.left - this.options.margin.right;
    
    // Remove existing indicator
    svg.select('.replay-indicator').remove();
    
    // Add progress bar
    const progressGroup = svg.append('g')
      .attr('class', 'replay-indicator')
      .attr('transform', `translate(${this.options.margin.left}, ${this.options.height - 40})`);
    
    // Background bar
    progressGroup.append('rect')
      .attr('class', 'progress-bg')
      .attr('width', innerWidth)
      .attr('height', 4)
      .attr('fill', '#333')
      .attr('rx', 2);
    
    // Progress fill
    const progress = this.currentIndex / this.fullData.length;
    progressGroup.append('rect')
      .attr('class', 'progress-fill')
      .attr('width', innerWidth * progress)
      .attr('height', 4)
      .attr('fill', '#2196f3')
      .attr('rx', 2);
    
    // Current position indicator
    progressGroup.append('circle')
      .attr('class', 'progress-dot')
      .attr('cx', innerWidth * progress)
      .attr('cy', 2)
      .attr('r', 6)
      .attr('fill', '#2196f3')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // Progress text
    progressGroup.append('text')
      .attr('class', 'progress-text')
      .attr('x', innerWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ccc')
      .attr('font-size', '12px')
      .text(`${this.currentIndex + 1} / ${this.fullData.length} (${(progress * 100).toFixed(1)}%)`);
  }

  /**
   * Play/Resume replay
   */
  play() {
    if (this.isPlaying) {
      return;
    }

    if (this.currentIndex >= this.fullData.length - 1) {
      this.reset();
    }

    this.isPlaying = true;
    this.onPlayStateChange(true);

    const stepDelay = this.baseSpeed / this.playSpeed;
    
    this.playInterval = setInterval(() => {
      this.step();
      
      if (this.currentIndex >= this.fullData.length - 1) {
        this.pause();
      }
    }, stepDelay);

    console.log(`▶️ Replay started at ${this.playSpeed}x speed`);
  }

  /**
   * Pause replay
   */
  pause() {
    if (!this.isPlaying) {
      return;
    }

    this.isPlaying = false;
    this.onPlayStateChange(false);

    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }

    console.log('⏸️ Replay paused');
  }

  /**
   * Step forward one bar
   */
  step() {
    if (this.currentIndex < this.fullData.length - 1) {
      this.currentIndex++;
      this.updateChart();
    }
  }

  /**
   * Step backward one bar
   */
  stepBack() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateChart();
    }
  }

  /**
   * Jump to specific position
   */
  seekTo(index) {
    if (index >= 0 && index < this.fullData.length) {
      this.currentIndex = index;
      this.updateChart();
    }
  }

  /**
   * Jump to specific percentage
   */
  seekToPercent(percent) {
    const index = Math.floor((percent / 100) * this.fullData.length);
    this.seekTo(Math.min(index, this.fullData.length - 1));
  }

  /**
   * Reset to beginning
   */
  reset() {
    this.pause();
    this.currentIndex = 0;
    this.updateChart();
    console.log('⏮️ Replay reset');
  }

  /**
   * Jump to end
   */
  jumpToEnd() {
    this.pause();
    this.currentIndex = this.fullData.length - 1;
    this.updateChart();
    console.log('⏭️ Jumped to end');
  }

  /**
   * Set playback speed
   */
  setSpeed(speed) {
    this.playSpeed = Math.max(0.25, Math.min(10, speed));
    
    // Restart interval if playing
    if (this.isPlaying) {
      this.pause();
      this.play();
    }

    console.log(`🎬 Speed set to ${this.playSpeed}x`);
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Get current replay state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      totalBars: this.fullData.length,
      progress: (this.currentIndex / this.fullData.length) * 100,
      playSpeed: this.playSpeed,
      currentBar: this.fullData[this.currentIndex] || null,
      canStepBack: this.currentIndex > 0,
      canStepForward: this.currentIndex < this.fullData.length - 1
    };
  }

  /**
   * Export current frame as image
   */
  exportFrame() {
    if (!this.chartManager || !this.chartManager.svg) {
      return null;
    }

    const svgElement = this.chartManager.svg.node();
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };
      
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
    });
  }

  /**
   * Cleanup
   */
  destroy() {
    this.pause();
    
    if (this.chartManager) {
      this.chartManager.clear();
    }
    
    console.log('🎬 Chart Replay destroyed');
  }
}

export const ChartReplay = React.memo(({ 
  data, 
  chartType = 'candlestick',
  width = 1200, 
  height = 600,
  onStateChange = () => {},
  autoStart = false 
}) => {
  const containerRef = useRef(null);
  const replayEngineRef = useRef(null);
  const [replayState, setReplayState] = useState({
    isPlaying: false,
    currentIndex: 0,
    totalBars: 0,
    progress: 0,
    playSpeed: 1,
    currentBar: null
  });

  // Initialize replay engine
  useEffect(() => {
    if (!data || !data.length || !containerRef.current) {
      return;
    }

    if (replayEngineRef.current) {
      replayEngineRef.current.destroy();
    }

    replayEngineRef.current = new ChartReplayEngine(data, containerRef.current, {
      width,
      height,
      chartType,
      onProgressChange: (progress) => {
        setReplayState(prev => ({ ...prev, ...progress }));
      },
      onPlayStateChange: (isPlaying) => {
        setReplayState(prev => ({ ...prev, isPlaying }));
      },
      onDataUpdate: (currentData) => {
        // Can be used for additional processing
      }
    });

    const state = replayEngineRef.current.initialize();
    setReplayState(prev => ({ ...prev, ...state }));

    if (autoStart) {
      setTimeout(() => {
        replayEngineRef.current?.play();
      }, 1000);
    }

    return () => {
      if (replayEngineRef.current) {
        replayEngineRef.current.destroy();
      }
    };
  }, [data, chartType, width, height, autoStart]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange(replayState);
  }, [replayState, onStateChange]);

  // Control handlers
  const handlePlay = useCallback(() => {
    replayEngineRef.current?.play();
  }, []);

  const handlePause = useCallback(() => {
    replayEngineRef.current?.pause();
  }, []);

  const handleTogglePlayPause = useCallback(() => {
    replayEngineRef.current?.togglePlayPause();
  }, []);

  const handleStep = useCallback(() => {
    replayEngineRef.current?.step();
  }, []);

  const handleStepBack = useCallback(() => {
    replayEngineRef.current?.stepBack();
  }, []);

  const handleReset = useCallback(() => {
    replayEngineRef.current?.reset();
  }, []);

  const handleJumpToEnd = useCallback(() => {
    replayEngineRef.current?.jumpToEnd();
  }, []);

  const handleSpeedChange = useCallback((speed) => {
    replayEngineRef.current?.setSpeed(speed);
    setReplayState(prev => ({ ...prev, playSpeed: speed }));
  }, []);

  const handleSeek = useCallback((percent) => {
    replayEngineRef.current?.seekToPercent(percent);
  }, []);

  const formatTime = useCallback((bar) => {
    if (!bar || !bar.date) return '';
    return new Date(bar.date).toLocaleString('fa-IR');
  }, []);

  const formatPrice = useCallback((price) => {
    return new Intl.NumberFormat('fa-IR').format(price);
  }, []);

  return (
    <div className="chart-replay">
      {/* Chart Container */}
      <div ref={containerRef} className="replay-chart-container" />
      
      {/* Controls */}
      <div className="replay-controls">
        <div className="control-group">
          <button 
            onClick={handleReset}
            className="control-btn"
            disabled={replayState.currentIndex === 0}
            title="Reset to beginning"
          >
            ⏮️
          </button>
          
          <button 
            onClick={handleStepBack}
            className="control-btn"
            disabled={replayState.currentIndex === 0}
            title="Step back"
          >
            ⏪
          </button>
          
          <button 
            onClick={handleTogglePlayPause}
            className="control-btn play-pause"
            title={replayState.isPlaying ? 'Pause' : 'Play'}
          >
            {replayState.isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <button 
            onClick={handleStep}
            className="control-btn"
            disabled={replayState.currentIndex >= replayState.totalBars - 1}
            title="Step forward"
          >
            ⏩
          </button>
          
          <button 
            onClick={handleJumpToEnd}
            className="control-btn"
            disabled={replayState.currentIndex >= replayState.totalBars - 1}
            title="Jump to end"
          >
            ⏭️
          </button>
        </div>

        {/* Progress Slider */}
        <div className="progress-group">
          <input
            type="range"
            min="0"
            max="100"
            value={replayState.progress}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="progress-slider"
          />
          <span className="progress-text">
            {replayState.currentIndex + 1} / {replayState.totalBars}
          </span>
        </div>

        {/* Speed Control */}
        <div className="speed-group">
          <label>Speed:</label>
          <select 
            value={replayState.playSpeed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="speed-select"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={8}>8x</option>
          </select>
        </div>

        {/* Current Bar Info */}
        {replayState.currentBar && (
          <div className="bar-info">
            <div className="info-item">
              <span>Time:</span>
              <span>{formatTime(replayState.currentBar)}</span>
            </div>
            <div className="info-item">
              <span>Open:</span>
              <span>{formatPrice(replayState.currentBar.open)}</span>
            </div>
            <div className="info-item">
              <span>High:</span>
              <span>{formatPrice(replayState.currentBar.high)}</span>
            </div>
            <div className="info-item">
              <span>Low:</span>
              <span>{formatPrice(replayState.currentBar.low)}</span>
            </div>
            <div className="info-item">
              <span>Close:</span>
              <span>{formatPrice(replayState.currentBar.close)}</span>
            </div>
            <div className="info-item">
              <span>Volume:</span>
              <span>{(replayState.currentBar.volume / 1000).toFixed(0)}K</span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .chart-replay {
          background: #1a1a1a;
          border-radius: 8px;
          overflow: hidden;
        }

        .replay-chart-container {
          width: 100%;
          background: #1a1a1a;
        }

        .replay-controls {
          background: #2d2d2d;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          border-top: 1px solid #404040;
        }

        .control-group {
          display: flex;
          gap: 5px;
        }

        .control-btn {
          background: #404040;
          border: 1px solid #555;
          color: #fff;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
          font-size: 16px;
        }

        .control-btn:hover:not(:disabled) {
          background: #555;
        }

        .control-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .control-btn.play-pause {
          background: #2196f3;
          border-color: #2196f3;
        }

        .control-btn.play-pause:hover {
          background: #1976d2;
        }

        .progress-group {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 200px;
        }

        .progress-slider {
          flex: 1;
          height: 6px;
          background: #404040;
          outline: none;
          border-radius: 3px;
        }

        .progress-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #2196f3;
          border-radius: 50%;
          cursor: pointer;
        }

        .progress-text {
          font-size: 12px;
          color: #ccc;
          white-space: nowrap;
        }

        .speed-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .speed-group label {
          font-size: 12px;
          color: #ccc;
        }

        .speed-select {
          background: #404040;
          border: 1px solid #555;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .bar-info {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          font-size: 12px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .info-item span:first-child {
          color: #aaa;
          font-weight: 500;
        }

        .info-item span:last-child {
          color: #fff;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .replay-controls {
            flex-direction: column;
            align-items: stretch;
            gap: 15px;
          }

          .control-group {
            justify-content: center;
          }

          .bar-info {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
});

export default ChartReplay;