/**
 * Charts Components Index
 * TradingView-inspired charting platform for Iran Stock Market
 * 
 * All components are designed to work with LocalStorage for user data persistence
 * since no authentication system exists. Only price/historical data comes from backend.
 */

// Core Chart Components
export { default as ChartTypes } from './ChartTypes';
export { default as TechnicalIndicators } from './TechnicalIndicators';
export { default as TimeframeSelector } from './TimeframeSelector';
export { default as VolumeProfile } from './VolumeProfile';

// Advanced Features
export { default as DrawingTools } from './DrawingTools';
export { default as ChartComparison } from './ChartComparison';
export { default as ChartReplay } from './ChartReplay';
export { default as CustomScriptBuilder } from './CustomScriptBuilder';
export { default as ChartSharing } from './ChartSharing';

/**
 * Feature Overview:
 * 
 * 1. ChartTypes.js - 9 different chart types:
 *    - Candlestick, Heikin Ashi, Renko, Kagi
 *    - Line Break, Point & Figure, Range Bars
 *    - Hollow Candles, Baseline
 * 
 * 2. TechnicalIndicators.js - 80+ technical indicators:
 *    - Moving Averages (SMA, EMA, WMA, VWMA, etc.)
 *    - Oscillators (RSI, Stochastic, MACD, etc.)
 *    - Volatility (Bollinger Bands, ATR, etc.)
 *    - Volume (OBV, A/D Line, etc.)
 *    - Trend (ADX, Parabolic SAR, etc.)
 *    - Support/Resistance (Pivot Points, etc.)
 *    - Candlestick Pattern Recognition
 * 
 * 3. TimeframeSelector.js - Custom timeframe management:
 *    - Standard timeframes (1m, 5m, 15m, 1h, 4h, 1D, 1W, 1M)
 *    - Custom intervals
 *    - Tick-based charts
 *    - Range-based charts
 *    - Renko brick size management
 * 
 * 4. VolumeProfile.js - Advanced volume analysis:
 *    - Volume Profile (VP)
 *    - Market Profile (TPO)
 *    - Volume Footprint
 *    - VWAP calculations
 *    - Value Area statistics
 * 
 * 5. DrawingTools.js - Professional drawing tools:
 *    - Trend lines
 *    - Horizontal/Vertical lines
 *    - Fibonacci retracements/extensions
 *    - Channels (parallel lines)
 *    - Rectangles and shapes
 *    - Text annotations
 *    - Price labels
 * 
 * 6. ChartComparison.js - Multi-symbol comparison:
 *    - Compare up to 10 symbols
 *    - Multiple comparison modes (absolute, normalized, percentage, ratio)
 *    - Different visualization types
 *    - Performance statistics
 *    - Save/load comparisons
 * 
 * 7. ChartReplay.js - Historical playback:
 *    - Step-by-step chart replay
 *    - Variable speed controls
 *    - Jump to specific dates/times
 *    - Export replay frames
 *    - Progress tracking
 * 
 * 8. CustomScriptBuilder.js - Pine Script-like environment:
 *    - Custom indicator creation
 *    - Trading strategy development
 *    - Built-in function library
 *    - Code editor with syntax support
 *    - Sample scripts and documentation
 *    - Import/export scripts
 * 
 * 9. ChartSharing.js - Save and share functionality:
 *    - Save chart layouts locally
 *    - Share charts with custom URLs
 *    - Privacy controls (private, unlisted, public)
 *    - Export/import chart configurations
 *    - Favorites system
 *    - Chart library management
 * 
 * Data Architecture:
 * - All user data stored in LocalStorage
 * - Portfolio management (PortfolioService.js)
 * - Alerts system (AlertsService.js)
 * - Watchlist management (WatchlistService.js)
 * - Comprehensive storage manager (LocalStorageManager.js)
 * 
 * Backend Integration:
 * - Only price and historical data from backend
 * - Real-time WebSocket updates
 * - Symbol search and metadata
 * - Market data feeds
 * 
 * Usage Example:
 * ```jsx
 * import {
 *   ChartTypes,
 *   TechnicalIndicators,
 *   DrawingTools,
 *   ChartComparison,
 *   ChartSharing
 * } from './components/Charts';
 * 
 * function TradingPlatform() {
 *   return (
 *     <div>
 *       <ChartTypes />
 *       <TechnicalIndicators />
 *       <DrawingTools />
 *       <ChartComparison />
 *       <ChartSharing />
 *     </div>
 *   );
 * }
 * ```
 * 
 * All components are:
 * - Responsive and mobile-friendly
 * - Support both dark and light themes
 * - Optimized for performance
 * - Include comprehensive error handling
 * - Support Persian (RTL) layouts
 * - Compatible with Iran stock market data formats
 */