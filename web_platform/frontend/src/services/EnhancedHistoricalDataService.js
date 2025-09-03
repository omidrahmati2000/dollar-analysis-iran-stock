class EnhancedHistoricalDataService {
    constructor() {
        this.baseURL = 'http://localhost:8000/api/v2';
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.cacheTimeout = 300000; // 5 minutes
        
        // IndexedDB for persistent caching
        this.dbName = 'ChartDataCache';
        this.dbVersion = 1;
        this.db = null;
        
        // Request throttling to prevent performance issues
        this.activeRequests = new Set();
        this.maxConcurrentRequests = 3;
        this.requestQueue = [];
        
        this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('historicalData')) {
                    const store = db.createObjectStore('historicalData', { keyPath: 'id' });
                    store.createIndex('symbol', 'symbol', { unique: false });
                    store.createIndex('timeframe', 'timeframe', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('indicators')) {
                    const indicatorStore = db.createObjectStore('indicators', { keyPath: 'id' });
                    indicatorStore.createIndex('symbol', 'symbol', { unique: false });
                    indicatorStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    getCacheKey(symbol, timeframe, from, to) {
        return `${symbol}_${timeframe}_${from || 'null'}_${to || 'null'}`;
    }

    async getFromIndexedDB(key) {
        if (!this.db) return null;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['historicalData'], 'readonly');
            const store = transaction.objectStore('historicalData');
            const request = store.get(key);
            
            request.onsuccess = () => {
                const result = request.result;
                if (result && Date.now() - result.timestamp < this.cacheTimeout) {
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => resolve(null);
        });
    }

    async saveToIndexedDB(key, data) {
        if (!this.db) return;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['historicalData'], 'readwrite');
            const store = transaction.objectStore('historicalData');
            
            const record = {
                id: key,
                data: data,
                timestamp: Date.now()
            };
            
            store.put(record);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    }

    /**
     * Throttle requests to prevent system overload
     */
    async throttleRequest(requestFn) {
        return new Promise((resolve, reject) => {
            const executeRequest = async () => {
                const requestId = Math.random().toString(36);
                this.activeRequests.add(requestId);
                
                try {
                    const result = await requestFn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.activeRequests.delete(requestId);
                    this.processQueue();
                }
            };
            
            if (this.activeRequests.size < this.maxConcurrentRequests) {
                executeRequest();
            } else {
                this.requestQueue.push(executeRequest);
            }
        });
    }
    
    processQueue() {
        if (this.requestQueue.length > 0 && this.activeRequests.size < this.maxConcurrentRequests) {
            const nextRequest = this.requestQueue.shift();
            nextRequest();
        }
    }

    /**
     * Get historical OHLCV data with advanced caching
     */
    async getHistoricalData(symbol, timeframe = '1D', from = null, to = null, useCache = true) {
        return this.throttleRequest(async () => {
            return this._getHistoricalDataInternal(symbol, timeframe, from, to, useCache);
        });
    }
    
    async _getHistoricalDataInternal(symbol, timeframe = '1D', from = null, to = null, useCache = true) {
        const cacheKey = this.getCacheKey(symbol, timeframe, from, to);
        
        // Check memory cache first
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        // Skip IndexedDB for now to improve performance
        // IndexedDB operations can be added later if needed

        try {
            // Build query parameters
            const params = new URLSearchParams({
                timeframe,
                limit: 2000 // Increased limit for better charts
            });

            if (from) params.append('from', from);
            if (to) params.append('to', to);

            // Try to get real data first
            let data = await this.tryRealHistoricalData(symbol, params);
            
            // Fallback to enhanced mock data if no real data
            if (!data || data.length === 0) {
                data = await this.generateEnhancedMockData(symbol, timeframe, from, to);
            }

            // Apply data validation and cleaning
            data = this.validateAndCleanData(data);
            
            // Apply timeframe aggregation if needed
            data = this.aggregateTimeframe(data, timeframe);

            // Cache the result
            if (useCache) {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
                
                // Skip IndexedDB save for performance
                this.manageCacheSize();
            }

            return data;

        } catch (error) {
            console.error('Error fetching historical data:', error);
            
            // Return enhanced mock data as fallback
            return this.generateEnhancedMockData(symbol, timeframe, from, to);
        }
    }

    async tryRealHistoricalData(symbol, params) {
        try {
            // Convert timeframe parameter to match backend expectations
            const backendParams = new URLSearchParams(params);
            const timeframe = backendParams.get('timeframe') || '1D';
            
            // Map frontend timeframes to backend format
            const timeframeMap = {
                '1m': '1d',  // Use daily for minute data
                '5m': '1d',  // Use daily for 5min data
                '15m': '1d', // Use daily for 15min data
                '1h': '1d',  // Use daily for hourly data
                '4h': '1d',  // Use daily for 4h data
                '1D': '1d',  // Daily
                '1W': '1w',  // Weekly
                '1M': '1m'   // Monthly
            };
            
            const backendTimeframe = timeframeMap[timeframe] || '1d';
            backendParams.set('timeframe', backendTimeframe);
            
            // Add default days parameter if not specified
            if (!backendParams.has('days')) {
                const defaultDays = timeframe === '1D' ? 365 : 
                                  timeframe === '1W' ? 365 * 2 : 
                                  timeframe === '1M' ? 365 * 5 : 90;
                backendParams.set('days', defaultDays);
            }
            
            // Try to get real data from backend using correct endpoint
            const encodedSymbol = encodeURIComponent(symbol);
            const url = `${this.baseURL}/stocks/${encodedSymbol}/ohlcv?${backendParams.toString()}`;
            
            console.log(`🔄 Fetching real data from: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                // Remove timeout property as it's not standard
                signal: AbortSignal.timeout(8000)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Real data received for ${symbol}:`, result.length, 'records');
                
                if (result && Array.isArray(result) && result.length > 0) {
                    return this.transformDataFormat(result);
                }
            } else {
                console.warn(`❌ Backend returned ${response.status} for ${symbol}`);
            }
            
            // If no real data, return null to use mock data
            return null;
            
        } catch (error) {
            console.warn(`⚠️ Real API unavailable for ${symbol}:`, error.message);
            return null;
        }
    }

    transformDataFormat(rawData) {
        // Transform backend OHLCV data to chart format
        if (!rawData || !Array.isArray(rawData)) return [];
        
        return rawData.map(item => {
            // Backend returns: symbol, date, open_price, high_price, low_price, close_price, volume, adjusted_close, daily_return, volatility
            const timeValue = item.date || item.timestamp || item.time;
            let timestamp;
            
            if (typeof timeValue === 'string') {
                timestamp = Math.floor(new Date(timeValue).getTime() / 1000);
            } else if (typeof timeValue === 'number') {
                // If already a timestamp, convert to seconds if needed
                timestamp = timeValue > 1e10 ? Math.floor(timeValue / 1000) : timeValue;
            } else {
                return null; // Skip invalid entries
            }
            
            return {
                time: timestamp,
                open: parseFloat(item.open_price || item.open || item.o || 0),
                high: parseFloat(item.high_price || item.high || item.h || 0),
                low: parseFloat(item.low_price || item.low || item.l || 0),
                close: parseFloat(item.close_price || item.adjusted_close || item.close || item.c || 0),
                volume: parseInt(item.volume || item.trade_volume || item.v || 0)
            };
        })
        .filter(item => item && item.time > 0 && item.close > 0) // Remove invalid entries
        .sort((a, b) => a.time - b.time); // Sort by time ascending
    }

    async generateEnhancedMockData(symbol, timeframe, from, to) {
        const timeframeMinutes = this.getTimeframeMinutes(timeframe);
        const endTime = to ? new Date(to) : new Date();
        
        // Severely limit data points for performance
        let maxDataPoints;
        switch (timeframe) {
            case '1m':
                maxDataPoints = 100; // 100 minutes
                break;
            case '5m':
                maxDataPoints = 150; // ~12 hours
                break;
            case '15m':
                maxDataPoints = 200; // ~2 days
                break;
            case '1h':
                maxDataPoints = 250; // ~10 days
                break;
            case '4h':
                maxDataPoints = 300; // ~50 days
                break;
            case '1D':
                maxDataPoints = 365; // 1 year
                break;
            case '1W':
                maxDataPoints = 200; // ~4 years
                break;
            case '1M':
                maxDataPoints = 120; // ~10 years
                break;
            default:
                maxDataPoints = 100;
        }
        
        const startTime = from ? new Date(from) : new Date(endTime.getTime() - (maxDataPoints * timeframeMinutes * 60 * 1000));

        // Get base price for symbol
        const basePrice = await this.getBasePriceForSymbol(symbol);
        const data = [];
        
        let currentTime = new Date(startTime);
        let currentPrice = basePrice;
        
        // Market behavior parameters
        const volatility = this.getVolatilityForSymbol(symbol);
        const trend = Math.random() - 0.5; // Overall trend bias
        let momentum = 0;

        while (currentTime <= endTime) {
            const timestamp = Math.floor(currentTime.getTime() / 1000);
            
            // Generate more realistic price movement
            const randomWalk = (Math.random() - 0.5) * volatility;
            const trendComponent = trend * 0.001;
            const meanReversion = -momentum * 0.1;
            
            const priceChange = randomWalk + trendComponent + meanReversion;
            momentum = momentum * 0.9 + priceChange * 0.1;
            
            const open = currentPrice;
            const close = open * (1 + priceChange);
            
            // Generate high and low with realistic spreads
            const range = Math.abs(close - open) + (Math.random() * open * 0.005);
            const high = Math.max(open, close) + range * Math.random();
            const low = Math.min(open, close) - range * Math.random();
            
            // Generate volume with realistic patterns
            const baseVolume = this.getBaseVolumeForSymbol(symbol);
            const volumeMultiplier = 0.5 + Math.random() * 1.5;
            const priceChangeVolume = Math.abs(priceChange) * 10;
            const volume = Math.floor(baseVolume * volumeMultiplier * (1 + priceChangeVolume));

            data.push({
                time: timestamp,
                open: parseFloat(open.toFixed(this.getPriceDecimals(symbol))),
                high: parseFloat(high.toFixed(this.getPriceDecimals(symbol))),
                low: parseFloat(low.toFixed(this.getPriceDecimals(symbol))),
                close: parseFloat(close.toFixed(this.getPriceDecimals(symbol))),
                volume
            });

            currentPrice = close;
            currentTime = new Date(currentTime.getTime() + timeframeMinutes * 60 * 1000);
        }

        return data;
    }

    async getBasePriceForSymbol(symbol) {
        // Use static prices only - no API calls for performance
        const basePrices = {
            'AAPL': 150.0,
            'GOOGL': 2500.0,
            'MSFT': 300.0,
            'TSLA': 200.0,
            'AMZN': 120.0,
            'NVDA': 400.0,
            'META': 250.0,
            'AMD': 100.0,
            'NFLX': 350.0,
            'BABA': 80.0,
            'TAPICO': 3500,
            'FOOLAD': 2800,
            'SAIPA': 1200,
            'USD': 42000,
            'EUR': 45000,
            'GOLD': 2850000,
            'BTC': 43000,
            'ETH': 2400
        };

        return basePrices[symbol] || 100.0;
    }

    getVolatilityForSymbol(symbol) {
        const volatilities = {
            'BTC': 0.05,
            'ETH': 0.04,
            'GOLD': 0.02,
            'USD': 0.015,
            'EUR': 0.015,
            'TAPICO': 0.03,
            'FOOLAD': 0.025,
            'SAIPA': 0.035
        };

        return volatilities[symbol] || 0.025;
    }

    getBaseVolumeForSymbol(symbol) {
        const volumes = {
            'TAPICO': 50000000,
            'FOOLAD': 30000000,
            'SAIPA': 20000000,
            'USD': 1000000,
            'EUR': 800000,
            'GOLD': 100000,
            'BTC': 500000,
            'ETH': 1000000
        };

        return volumes[symbol] || 5000000;
    }

    getPriceDecimals(symbol) {
        const decimals = {
            'USD': 0,
            'EUR': 0,
            'GOLD': 0,
            'BTC': 1,
            'ETH': 1
        };

        return decimals[symbol] || 2;
    }

    validateAndCleanData(data) {
        return data.filter(item => {
            // Remove invalid data points
            return item.time > 0 &&
                   item.open > 0 &&
                   item.high > 0 &&
                   item.low > 0 &&
                   item.close > 0 &&
                   item.high >= Math.max(item.open, item.close) &&
                   item.low <= Math.min(item.open, item.close) &&
                   item.volume >= 0;
        }).sort((a, b) => a.time - b.time);
    }

    aggregateTimeframe(data, targetTimeframe) {
        const targetMinutes = this.getTimeframeMinutes(targetTimeframe);
        
        // If data is already at target timeframe, return as is
        if (data.length < 2) return data;
        
        const dataInterval = (data[1].time - data[0].time) / 60;
        if (Math.abs(dataInterval - targetMinutes) < 1) {
            return data;
        }

        // Aggregate data to target timeframe
        const aggregated = [];
        const periodSeconds = targetMinutes * 60;
        
        for (let i = 0; i < data.length; i++) {
            const periodStart = Math.floor(data[i].time / periodSeconds) * periodSeconds;
            
            // Find all data points in this period
            const periodData = [];
            let j = i;
            while (j < data.length && Math.floor(data[j].time / periodSeconds) * periodSeconds === periodStart) {
                periodData.push(data[j]);
                j++;
            }
            
            if (periodData.length > 0) {
                aggregated.push({
                    time: periodStart,
                    open: periodData[0].open,
                    high: Math.max(...periodData.map(d => d.high)),
                    low: Math.min(...periodData.map(d => d.low)),
                    close: periodData[periodData.length - 1].close,
                    volume: periodData.reduce((sum, d) => sum + d.volume, 0)
                });
            }
            
            i = j - 1; // Skip processed data points
        }

        return aggregated;
    }

    getTimeframeMinutes(timeframe) {
        const timeframes = {
            '1m': 1,
            '3m': 3,
            '5m': 5,
            '15m': 15,
            '30m': 30,
            '1H': 60,
            '2H': 120,
            '4H': 240,
            '6H': 360,
            '8H': 480,
            '12H': 720,
            '1D': 1440,
            '3D': 4320,
            '1W': 10080,
            '2W': 20160,
            '1M': 43200,
            '3M': 129600,
            '6M': 259200,
            '1Y': 525600
        };

        return timeframes[timeframe] || 1440;
    }

    /**
     * Get current quote with enhanced error handling
     */
    async getCurrentQuote(symbol) {
        try {
            // Try to get real quote from backend using correct endpoints
            const encodedSymbol = encodeURIComponent(symbol);
            const endpoints = [
                `/stocks/${encodedSymbol}`,
                `/currencies/${encodedSymbol}`,
                `/stocks/search?q=${encodedSymbol}&limit=1`
            ];

            for (const endpoint of endpoints) {
                try {
                    const url = `${this.baseURL}${endpoint}`;
                    console.log(`🔄 Fetching quote from: ${url}`);
                    
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        signal: AbortSignal.timeout(5000)
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`✅ Quote data received for ${symbol}:`, data);
                        
                        // Handle different response formats
                        if (data.symbol || data.currency_code) {
                            return this.normalizeQuoteData(data, symbol);
                        }
                        
                        // Handle array responses (search results)
                        if (Array.isArray(data) && data.length > 0) {
                            return this.normalizeQuoteData(data[0], symbol);
                        }
                        
                        // Handle nested data
                        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                            return this.normalizeQuoteData(data.data[0], symbol);
                        }
                    } else {
                        console.warn(`❌ Quote endpoint returned ${response.status} for ${symbol}`);
                    }
                } catch (endpointError) {
                    console.warn(`⚠️ Quote endpoint failed for ${symbol}:`, endpointError.message);
                    continue;
                }
            }
            
            console.log(`📊 No real quote data found for ${symbol}, using mock data`);
            // Fallback to mock data if no real data available
            return this.generateMockQuote(symbol);
            
        } catch (error) {
            console.warn(`⚠️ Real quote API unavailable for ${symbol}:`, error.message);
            return this.generateMockQuote(symbol);
        }
    }

    /**
     * Search symbols using real backend API
     */
    async searchSymbols(query, limit = 10) {
        try {
            if (!query || query.length < 2) {
                return [];
            }

            // Try to get real search results from backend
            const encodedQuery = encodeURIComponent(query);
            const endpoints = [
                `/stocks/search?q=${encodedQuery}&limit=${limit}`,
                `/currencies/search?q=${encodedQuery}&limit=${limit}`
            ];

            const results = [];

            for (const endpoint of endpoints) {
                try {
                    const url = `${this.baseURL}${endpoint}`;
                    console.log(`🔍 Searching symbols from: ${url}`);
                    
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        signal: AbortSignal.timeout(5000)
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`🔍 Search results received for "${query}":`, data.length);
                        
                        // Transform search results to consistent format
                        if (Array.isArray(data)) {
                            data.forEach(item => {
                                results.push({
                                    symbol: item.symbol || item.currency_code || '',
                                    name: item.company_name || item.currency_name || item.currency_name_fa || '',
                                    type: item.currency_code ? 'currency' : 'stock',
                                    price: item.last_price || item.price_irr || 0,
                                    change: item.price_change || item.change_24h || 0,
                                    changePercent: item.price_change_percent || item.change_percent_24h || 0
                                });
                            });
                        }
                    } else {
                        console.warn(`❌ Search endpoint returned ${response.status} for "${query}"`);
                    }
                } catch (endpointError) {
                    console.warn(`⚠️ Search endpoint failed for "${query}":`, endpointError.message);
                    continue;
                }
            }

            // If we got results, return them
            if (results.length > 0) {
                return results.slice(0, limit);
            }

            console.log(`📊 No real search results found for "${query}", using mock data`);
            // Fallback to mock search results
            return this.generateMockSearchResults(query, limit);
            
        } catch (error) {
            console.warn(`⚠️ Search API unavailable for "${query}":`, error.message);
            return this.generateMockSearchResults(query, limit);
        }
    }

    generateMockSearchResults(query, limit) {
        // Generate mock search results based on common Iranian stock symbols
        const mockSymbols = [
            { symbol: 'فولاد', name: 'شرکت فولاد مبارکه اصفهان', type: 'stock' },
            { symbol: 'شپنا', name: 'پتروشیمی پارس', type: 'stock' },
            { symbol: 'خودرو', name: 'ایران خودرو', type: 'stock' },
            { symbol: 'دریا', name: 'صندوق سرمایه‌گذاری دریای آبی فیروزه', type: 'stock' },
            { symbol: 'USD', name: 'دلار آمریکا', type: 'currency' },
            { symbol: 'EUR', name: 'یورو', type: 'currency' }
        ];

        return mockSymbols
            .filter(item => 
                item.symbol.toLowerCase().includes(query.toLowerCase()) ||
                item.name.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, limit)
            .map(item => ({
                symbol: item.symbol,
                name: item.name,
                type: item.type,
                price: this.getBasePriceForSymbol(item.symbol),
                change: (Math.random() - 0.5) * 100,
                changePercent: (Math.random() - 0.5) * 5
            }));
    }

    normalizeQuoteData(data, symbol) {
        // Normalize different API response formats
        const price = data.last_price || data.price_irr || data.close || data.price || 0;
        const change = data.price_change || data.change || 0;
        const changePercent = data.price_change_percent || data.change_percent_24h || 0;
        const volume = data.volume || data.trade_volume || 0;
        
        return {
            symbol: data.symbol || data.currency_code || symbol,
            price: parseFloat(price),
            change: parseFloat(change),
            changePercent: parseFloat(changePercent),
            volume: parseInt(volume),
            high24h: data.high_24h || data.high || price * 1.02,
            low24h: data.low_24h || data.low || price * 0.98,
            marketCap: data.market_cap || price * 1000000,
            timestamp: Date.now()
        };
    }

    generateMockQuote(symbol) {
        // Fallback mock quote for when real API is unavailable
        const basePrice = this.getBasePriceForSymbol(symbol);
        const change = (Math.random() - 0.5) * basePrice * 0.05;
        
        return {
            symbol: symbol,
            price: basePrice + change,
            change: change,
            changePercent: (change / basePrice) * 100,
            volume: Math.floor(Math.random() * 1000000),
            high24h: basePrice * (1 + Math.random() * 0.03),
            low24h: basePrice * (1 - Math.random() * 0.03),
            marketCap: basePrice * 1000000,
            timestamp: Date.now()
        };
    }

    generateEnhancedMockQuote(symbol) {
        const basePrice = this.getBasePriceForSymbol(symbol);
        const volatility = this.getVolatilityForSymbol(symbol);
        
        // Generate realistic price movement
        const changePercent = (Math.random() - 0.5) * volatility * 2; // Daily change
        const change = basePrice * changePercent;
        const currentPrice = basePrice + change;
        
        return {
            symbol,
            price: parseFloat(currentPrice.toFixed(this.getPriceDecimals(symbol))),
            change: parseFloat(change.toFixed(this.getPriceDecimals(symbol))),
            changePercent: parseFloat((changePercent * 100).toFixed(2)),
            volume: this.getBaseVolumeForSymbol(symbol) * (0.5 + Math.random()),
            high24h: currentPrice * (1 + Math.random() * 0.05),
            low24h: currentPrice * (1 - Math.random() * 0.05),
            marketCap: currentPrice * this.getBaseVolumeForSymbol(symbol) * 0.1,
            timestamp: Date.now()
        };
    }

    /**
     * Advanced technical analysis with server-side calculation simulation
     */
    async calculateAdvancedIndicators(data, indicators) {
        const results = {};

        for (const indicator of indicators) {
            const indicatorType = indicator.type || indicator.id;
            const cacheKey = `indicator_${indicatorType}_${JSON.stringify(indicator.params)}`;
            
            try {
                switch (indicatorType) {
                    case 'sma':
                        results[indicator.id] = this.calculateSMA(data, indicator.params.period);
                        break;
                    case 'ema':
                        results[indicator.id] = this.calculateEMA(data, indicator.params.period);
                        break;
                    case 'rsi':
                        results[indicator.id] = this.calculateRSI(data, indicator.params.period);
                        break;
                    case 'macd':
                        results[indicator.id] = this.calculateMACD(data, 
                            indicator.params.fastPeriod, 
                            indicator.params.slowPeriod, 
                            indicator.params.signalPeriod);
                        break;
                    case 'bb':
                        results[indicator.id] = this.calculateBollingerBands(data, 
                            indicator.params.period, 
                            indicator.params.stdDev);
                        break;
                    case 'stoch':
                        results[indicator.id] = this.calculateStochastic(data,
                            indicator.params.kPeriod,
                            indicator.params.dPeriod);
                        break;
                    case 'cci':
                        results[indicator.id] = this.calculateCCI(data, indicator.params.period);
                        break;
                    case 'williams':
                        results[indicator.id] = this.calculateWilliamsR(data, indicator.params.period);
                        break;
                    case 'atr':
                        results[indicator.id] = this.calculateATR(data, indicator.params.period);
                        break;
                    case 'adx':
                        results[indicator.id] = this.calculateADX(data, indicator.params.period);
                        break;
                    default:
                        console.warn(`Indicator ${indicatorType} not implemented`);
                }
            } catch (error) {
                console.error(`Error calculating ${indicatorType}:`, error);
            }
        }

        return results;
    }

    // Enhanced technical indicator calculations
    calculateSMA(data, period) {
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0);
            result.push({
                time: data[i].time,
                value: sum / period
            });
        }
        return result;
    }

    calculateEMA(data, period) {
        const multiplier = 2 / (period + 1);
        const result = [];
        let ema = data[0].close;
        
        result.push({ time: data[0].time, value: ema });
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i].close - ema) * multiplier + ema;
            result.push({ time: data[i].time, value: ema });
        }
        return result;
    }

    calculateRSI(data, period = 14) {
        const result = [];
        const changes = [];
        
        // Calculate price changes
        for (let i = 1; i < data.length; i++) {
            changes.push(data[i].close - data[i - 1].close);
        }
        
        // Calculate initial average gains and losses
        let avgGain = 0;
        let avgLoss = 0;
        
        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) {
                avgGain += changes[i];
            } else {
                avgLoss -= changes[i];
            }
        }
        
        avgGain /= period;
        avgLoss /= period;
        
        // Calculate RSI
        for (let i = period; i < changes.length; i++) {
            const change = changes[i];
            
            if (change > 0) {
                avgGain = ((avgGain * (period - 1)) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = ((avgLoss * (period - 1)) - change) / period;
            }
            
            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            
            result.push({
                time: data[i + 1].time,
                value: rsi
            });
        }
        
        return result;
    }

    calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const fastEMA = this.calculateEMA(data, fastPeriod);
        const slowEMA = this.calculateEMA(data, slowPeriod);
        
        // Calculate MACD line
        const macdLine = [];
        const minLength = Math.min(fastEMA.length, slowEMA.length);
        
        for (let i = 0; i < minLength; i++) {
            if (fastEMA[i].time === slowEMA[i].time) {
                macdLine.push({
                    time: fastEMA[i].time,
                    value: fastEMA[i].value - slowEMA[i].value,
                    close: fastEMA[i].value - slowEMA[i].value // For EMA calculation
                });
            }
        }
        
        // Calculate Signal line
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        
        // Calculate Histogram
        const histogram = [];
        for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
            const macdValue = macdLine[i];
            const signalValue = signalLine.find(s => s.time === macdValue.time);
            
            if (signalValue) {
                const histValue = macdValue.value - signalValue.value;
                histogram.push({
                    time: macdValue.time,
                    value: histValue,
                    color: histValue >= 0 ? '#26a69a' : '#ef5350'
                });
            }
        }

        return {
            macd: macdLine.map(item => ({ time: item.time, value: item.value })),
            signal: signalLine,
            histogram: histogram
        };
    }

    calculateBollingerBands(data, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(data, period);
        const result = { upper: [], middle: [], lower: [] };

        for (let i = 0; i < sma.length; i++) {
            const dataIndex = i + period - 1;
            const slice = data.slice(dataIndex - period + 1, dataIndex + 1);
            
            const mean = sma[i].value;
            const variance = slice.reduce((acc, item) => acc + Math.pow(item.close - mean, 2), 0) / period;
            const standardDeviation = Math.sqrt(variance);

            result.middle.push(sma[i]);
            result.upper.push({
                time: sma[i].time,
                value: mean + (stdDev * standardDeviation)
            });
            result.lower.push({
                time: sma[i].time,
                value: mean - (stdDev * standardDeviation)
            });
        }

        return result;
    }

    calculateStochastic(data, kPeriod = 14, dPeriod = 3) {
        const result = { k: [], d: [] };
        
        for (let i = kPeriod - 1; i < data.length; i++) {
            const slice = data.slice(i - kPeriod + 1, i + 1);
            const highest = Math.max(...slice.map(d => d.high));
            const lowest = Math.min(...slice.map(d => d.low));
            const current = data[i].close;
            
            const kValue = ((current - lowest) / (highest - lowest)) * 100;
            
            result.k.push({
                time: data[i].time,
                value: kValue
            });
        }
        
        // Calculate %D (SMA of %K)
        for (let i = dPeriod - 1; i < result.k.length; i++) {
            const slice = result.k.slice(i - dPeriod + 1, i + 1);
            const dValue = slice.reduce((sum, item) => sum + item.value, 0) / dPeriod;
            
            result.d.push({
                time: result.k[i].time,
                value: dValue
            });
        }
        
        return result;
    }

    calculateCCI(data, period = 20) {
        const result = [];
        
        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            
            // Calculate typical prices
            const typicalPrices = slice.map(d => (d.high + d.low + d.close) / 3);
            const smaTP = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;
            
            // Calculate mean deviation
            const meanDev = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
            
            // Calculate CCI
            const currentTP = (data[i].high + data[i].low + data[i].close) / 3;
            const cci = (currentTP - smaTP) / (0.015 * meanDev);
            
            result.push({
                time: data[i].time,
                value: cci
            });
        }
        
        return result;
    }

    calculateWilliamsR(data, period = 14) {
        const result = [];
        
        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            const highest = Math.max(...slice.map(d => d.high));
            const lowest = Math.min(...slice.map(d => d.low));
            const current = data[i].close;
            
            const williamsR = ((highest - current) / (highest - lowest)) * -100;
            
            result.push({
                time: data[i].time,
                value: williamsR
            });
        }
        
        return result;
    }

    calculateATR(data, period = 14) {
        const result = [];
        const trueRanges = [];
        
        // Calculate True Range for each period
        for (let i = 1; i < data.length; i++) {
            const high = data[i].high;
            const low = data[i].low;
            const prevClose = data[i - 1].close;
            
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            
            trueRanges.push(tr);
        }
        
        // Calculate ATR (Simple Moving Average of True Range)
        for (let i = period - 1; i < trueRanges.length; i++) {
            const slice = trueRanges.slice(i - period + 1, i + 1);
            const atr = slice.reduce((sum, tr) => sum + tr, 0) / period;
            
            result.push({
                time: data[i + 1].time,
                value: atr
            });
        }
        
        return result;
    }

    calculateADX(data, period = 14) {
        const result = [];
        const dmPlus = [];
        const dmMinus = [];
        const trueRanges = [];
        
        // Calculate directional movements and true ranges
        for (let i = 1; i < data.length; i++) {
            const high = data[i].high;
            const low = data[i].low;
            const prevHigh = data[i - 1].high;
            const prevLow = data[i - 1].low;
            const prevClose = data[i - 1].close;
            
            const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
            const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;
            
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            
            dmPlus.push(plusDM);
            dmMinus.push(minusDM);
            trueRanges.push(tr);
        }
        
        // Calculate smoothed averages
        for (let i = period - 1; i < dmPlus.length; i++) {
            const avgPlusDM = dmPlus.slice(i - period + 1, i + 1).reduce((sum, dm) => sum + dm, 0) / period;
            const avgMinusDM = dmMinus.slice(i - period + 1, i + 1).reduce((sum, dm) => sum + dm, 0) / period;
            const avgTR = trueRanges.slice(i - period + 1, i + 1).reduce((sum, tr) => sum + tr, 0) / period;
            
            const plusDI = (avgPlusDM / avgTR) * 100;
            const minusDI = (avgMinusDM / avgTR) * 100;
            
            const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
            
            result.push({
                time: data[i + 1].time,
                value: dx,
                plusDI,
                minusDI
            });
        }
        
        // Calculate ADX (smoothed DX)
        const adxResult = [];
        for (let i = period - 1; i < result.length; i++) {
            const slice = result.slice(i - period + 1, i + 1);
            const adx = slice.reduce((sum, item) => sum + item.value, 0) / period;
            
            adxResult.push({
                time: result[i].time,
                value: adx,
                plusDI: result[i].plusDI,
                minusDI: result[i].minusDI
            });
        }
        
        return adxResult;
    }

    // Cache management
    manageCacheSize() {
        if (this.cache.size > this.maxCacheSize) {
            const keysToDelete = Array.from(this.cache.keys()).slice(0, this.cache.size - this.maxCacheSize);
            keysToDelete.forEach(key => this.cache.delete(key));
        }
    }

    clearCache() {
        this.cache.clear();
        if (this.db) {
            const transaction = this.db.transaction(['historicalData'], 'readwrite');
            const store = transaction.objectStore('historicalData');
            store.clear();
        }
    }

    getCacheStats() {
        return {
            memorySize: this.cache.size,
            maxSize: this.maxCacheSize,
            memoryKeys: Array.from(this.cache.keys())
        };
    }

    // Utility methods
    getSupportedTimeframes() {
        return [
            { value: '1m', label: '1 Minute', minutes: 1 },
            { value: '3m', label: '3 Minutes', minutes: 3 },
            { value: '5m', label: '5 Minutes', minutes: 5 },
            { value: '15m', label: '15 Minutes', minutes: 15 },
            { value: '30m', label: '30 Minutes', minutes: 30 },
            { value: '1H', label: '1 Hour', minutes: 60 },
            { value: '2H', label: '2 Hours', minutes: 120 },
            { value: '4H', label: '4 Hours', minutes: 240 },
            { value: '6H', label: '6 Hours', minutes: 360 },
            { value: '12H', label: '12 Hours', minutes: 720 },
            { value: '1D', label: '1 Day', minutes: 1440 },
            { value: '3D', label: '3 Days', minutes: 4320 },
            { value: '1W', label: '1 Week', minutes: 10080 },
            { value: '1M', label: '1 Month', minutes: 43200 }
        ];
    }

    getSupportedIndicators() {
        return [
            { type: 'sma', name: 'Simple Moving Average', category: 'overlay', params: { period: 20 } },
            { type: 'ema', name: 'Exponential Moving Average', category: 'overlay', params: { period: 20 } },
            { type: 'bb', name: 'Bollinger Bands', category: 'overlay', params: { period: 20, stdDev: 2 } },
            { type: 'rsi', name: 'Relative Strength Index', category: 'oscillator', params: { period: 14 } },
            { type: 'macd', name: 'MACD', category: 'oscillator', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
            { type: 'stoch', name: 'Stochastic', category: 'oscillator', params: { kPeriod: 14, dPeriod: 3 } },
            { type: 'cci', name: 'Commodity Channel Index', category: 'oscillator', params: { period: 20 } },
            { type: 'williams', name: 'Williams %R', category: 'oscillator', params: { period: 14 } },
            { type: 'atr', name: 'Average True Range', category: 'volatility', params: { period: 14 } },
            { type: 'adx', name: 'Average Directional Index', category: 'trend', params: { period: 14 } }
        ];
    }

    // Cleanup
    destroy() {
        this.clearCache();
        if (this.db) {
            this.db.close();
        }
    }
}

// Export singleton instance
export default new EnhancedHistoricalDataService();