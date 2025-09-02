# 📈 Iran Stock Market - TradingView Frontend

یک پلتفرم نمودارهای پیشرفته به سبک TradingView برای بازار بورس ایران

## 🏗️ Architecture Overview

### 🎯 Service Layer Pattern
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Components    │    │    Services     │    │  Repositories   │
│                 │────│                 │────│                 │
│ • SuperChart    │    │ • ChartData     │    │ • Stock         │
│ • ChartDemo     │    │ • WebSocket     │    │ • Indicator     │
│ • ApiStatus     │    │ • Cache         │    │ • Market        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Backend API   │
                       │                 │
                       │ • FastAPI       │
                       │ • PostgreSQL    │
                       │ • WebSocket     │
                       └─────────────────┘
```

### 🔧 Service Architecture

#### 1. **API Layer (`services/api/`)**
- `base.js` - Base API service with interceptors
- Automatic error handling
- Request/Response logging
- Timeout management

#### 2. **Repository Layer (`services/repositories/`)**
- `StockRepository.js` - Stock data management
- `IndicatorRepository.js` - Technical indicators
- Data transformation and caching
- Fallback mechanisms

#### 3. **Business Logic (`services/`)**
- `ChartDataService.js` - Chart data orchestration
- WebSocket management
- Real-time updates
- Pattern detection

#### 4. **Cache Management (`services/cache/`)**
- `CacheManager.js` - In-memory caching with TTL
- Namespace-based organization
- Performance statistics
- Automatic cleanup

## 🚀 Quick Start

### نصب وابستگی‌ها
```bash
npm install
```

### اجرای برنامه
```bash
npm start
```

### دسترسی به برنامه
- **Frontend:** http://localhost:3000
- **Chart Demo:** http://localhost:3000/demo
- **API Backend:** http://localhost:8000

## 📊 Features

### 📈 Chart Types (9 نوع)
- **Candlestick** - شمع‌های معمولی
- **Hollow Candles** - شمع‌های توخالی
- **Heikin Ashi** - هایکن آشی
- **Renko** - رنکو
- **Kagi** - کاگی
- **Line Break** - شکست خط
- **Point & Figure** - نقطه و شکل
- **Range Bars** - نوار محدوده
- **Baseline** - خط پایه

### ⏱️ Timeframes
- **Time-based:** 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M
- **Tick-based:** 1T, 10T, 100T, 500T
- **Range-based:** R10, R25, R50, R100
- **Custom:** ایجاد بازه زمانی سفارشی

### 📊 Technical Indicators (80+)
- **Trend:** SMA, EMA, WMA, VWMA, Bollinger Bands, Ichimoku
- **Momentum:** RSI, MACD, Stochastic, CCI, Williams %R
- **Volume:** OBV, MFI, VWAP, Chaikin Money Flow
- **Volatility:** ATR, Keltner Channels, Standard Deviation

### 🎯 Volume Analysis
- **Volume Profile** - پروفایل حجم
- **TPO Profile** - پروفایل زمان-قیمت
- **Volume Footprint** - رد پای حجم
- **VWAP Analysis** - تحلیل VWAP
- **Delta Analysis** - تحلیل دلتا

## 🔌 API Integration

### Authentication
```javascript
// No authentication required - Free platform
const data = await stockRepository.getHistoricalData('FOLD');
```

### Stock Data
```javascript
// Get historical data
const chartData = await chartDataService.getChartData('FOLD', {
  timeframe: '1H',
  limit: 500,
  includeIndicators: true,
  indicators: [
    { type: 'sma', period: 20 },
    { type: 'rsi', period: 14 }
  ]
});

// Get real-time data
const realTime = await stockRepository.getRealTimeData('FOLD');
```

### WebSocket Real-time
```javascript
// Subscribe to real-time updates
chartDataService.subscribeToRealTimeUpdates('FOLD', (data) => {
  console.log('Real-time update:', data);
});
```

### Caching
```javascript
// Cache management
import { getCacheManager } from './services/cache/CacheManager';

const cache = getCacheManager('stocks');
cache.set('FOLD_1D', data, 300); // 5 minutes TTL
const cached = cache.get('FOLD_1D');
```

## 🎨 Component Usage

### SuperChart Component
```jsx
import SuperChart from './components/Charts/SuperChart';

function App() {
  return (
    <SuperChart 
      symbol="FOLD"
      data={stockData}
      indicators={[
        { type: 'sma', period: 20 },
        { type: 'bollinger', period: 20, std: 2 }
      ]}
      chartType="candlestick"
      timeframe={{ type: 'hour', count: 1 }}
      showVolumeProfile={true}
    />
  );
}
```

### API Status Component
```jsx
import ApiStatus from './components/Charts/ApiStatus';

// Shows API connection status and cache statistics
<ApiStatus />
```

## 🛠️ Development

### Project Structure
```
src/
├── components/
│   └── Charts/
│       ├── SuperChart.js          # Main chart component
│       ├── ChartTypes.js         # Chart type implementations
│       ├── VolumeProfile.js      # Volume analysis
│       ├── TechnicalIndicators.js # Technical indicators
│       ├── TimeframeSelector.js   # Timeframe management
│       └── ApiStatus.js          # API status display
├── services/
│   ├── api/
│   │   └── base.js              # Base API service
│   ├── repositories/
│   │   ├── StockRepository.js   # Stock data repository
│   │   └── IndicatorRepository.js # Indicator repository
│   ├── cache/
│   │   └── CacheManager.js      # Cache management
│   ├── ChartDataService.js      # Business logic
│   └── index.js                 # Service aggregation
└── styles/
    └── *.css                    # Component styles
```

### Adding New Indicators
```javascript
// 1. Add to TechnicalIndicators.js
static CUSTOM_INDICATOR(data, period) {
  // Implementation
  return results;
}

// 2. Add to IndicatorRepository.js
async getCustomIndicator(symbol, options) {
  // API integration
}

// 3. Update component usage
const indicators = [
  { type: 'custom_indicator', period: 14 }
];
```

### Adding New Chart Types
```javascript
// 1. Implement in ChartTypes.js
drawCustomChart() {
  // D3.js implementation
}

// 2. Add to SuperChart.js
const CHART_TYPES = [
  { value: 'custom', label: 'Custom Chart' }
];
```

## 🔧 Configuration

### Environment Variables
```bash
# API Configuration
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws

# Development
CHOKIDAR_USEPOLLING=true
WATCHPACK_POLLING=true
```

### Service Configuration
```javascript
// services/index.js
export const serviceConfig = {
  api: {
    baseURL: 'http://localhost:8000',
    timeout: 10000,
    retries: 3
  },
  cache: {
    defaultTTL: 300,
    maxEntries: 1000
  }
};
```

## 📊 Performance

### Caching Strategy
- **Real-time data:** 5 seconds TTL
- **Intraday data:** 30 seconds - 5 minutes TTL
- **Daily data:** 1 hour TTL
- **Indicators:** Based on timeframe
- **Stock list:** 10 minutes TTL

### Memory Management
- Automatic cache cleanup every 5 minutes
- Namespace-based cache organization
- LRU eviction for memory limits
- Performance monitoring

### Optimization
- Data virtualization for large datasets
- Lazy loading of chart components
- WebSocket connection pooling
- Efficient D3.js rendering

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests
```bash
npm run test:e2e
```

### Performance Tests
```bash
npm run test:performance
```

## 🚀 Production Build

### Build for Production
```bash
npm run build
```

### Docker Production
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## 📈 Monitoring

### Health Checks
- API connectivity monitoring
- WebSocket connection status
- Cache performance metrics
- Error rate tracking

### Performance Metrics
```javascript
import { getPerformanceMetrics } from './services';

const metrics = getPerformanceMetrics();
console.log('Performance:', metrics);
```

## 🤝 Contributing

### Code Style
- ESLint + Prettier
- Consistent naming (camelCase for JS, kebab-case for CSS)
- Persian comments for business logic
- English for technical documentation

### Git Workflow
```bash
# Feature branch
git checkout -b feature/new-indicator

# Commit with conventional format
git commit -m "feat: add custom bollinger bands indicator"

# Pull request to main branch
```

## 📚 Documentation

- **API Requirements:** `docs-dev/frontend-api-requirements.md`
- **Component Docs:** Inline JSDoc comments
- **Architecture:** This README

## 🐛 Troubleshooting

### Common Issues

1. **API Connection Failed**
   ```bash
   # Check backend is running
   curl http://localhost:8000/health
   ```

2. **WebSocket Not Connecting**
   ```javascript
   // Check WebSocket URL in console
   console.log(process.env.REACT_APP_WS_URL);
   ```

3. **Cache Issues**
   ```javascript
   // Clear all caches
   import { clearAllCaches } from './services';
   clearAllCaches();
   ```

4. **Performance Issues**
   ```javascript
   // Check cache hit rate
   import { getGlobalCacheStats } from './services';
   console.log(getGlobalCacheStats());
   ```

## 📞 Support

- **Issues:** GitHub Issues
- **Documentation:** Inline comments + README
- **Performance:** Use ApiStatus component for diagnostics

---

## 🎯 Next Steps

1. **Real API Integration** - اتصال به API واقعی بورس ایران
2. **Advanced Indicators** - اندیکاتورهای پیشرفته‌تر
3. **Pattern Recognition** - تشخیص الگوهای پیشرفته
4. **Portfolio Management** - مدیریت پرتفوی
5. **Alerts System** - سیستم هشدارها

---

**Built with ❤️ for Iranian Stock Market Analysis**