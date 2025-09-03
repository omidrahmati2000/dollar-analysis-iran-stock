class HistoricalDataService {
    constructor() {
        this.baseURL = 'http://localhost:8000/api/v2';
        this.cache = new Map();
        this.maxCacheSize = 100; // Maximum number of cached datasets
    }

    /**
     * Generate cache key for data requests
     */
    getCacheKey(symbol, timeframe, from, to) {
        return `${symbol}_${timeframe}_${from}_${to}`;
    }

    /**
     * Manage cache size
     */
    manageCacheSize() {
        if (this.cache.size > this.maxCacheSize) {
            // Remove oldest entries
            const keysToDelete = Array.from(this.cache.keys()).slice(0, this.cache.size - this.maxCacheSize);
            keysToDelete.forEach(key => this.cache.delete(key));
        }
    }

    /**
     * Fetch historical OHLCV data
     */
    async getHistoricalData(symbol, timeframe = '1D', from = null, to = null, useCache = true) {
        const cacheKey = this.getCacheKey(symbol, timeframe, from, to);
        
        // Check cache first
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                return cached.data;
            }
        }

        try {
            // Build query parameters
            const params = new URLSearchParams({
                timeframe,
                limit: 1000 // Adjust based on your needs
            });

            if (from) params.append('from', from);
            if (to) params.append('to', to);

            // For now, generate mock historical data since we don't have historical endpoints
            const data = await this.generateMockHistoricalData(symbol, timeframe, from, to);

            // Cache the result
            if (useCache) {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
                this.manageCacheSize();
            }

            return data;

        } catch (error) {
            console.error('Error fetching historical data:', error);
            throw error;
        }
    }

    /**
     * Generate mock historical data for demonstration
     * In production, this would be replaced with real API calls
     */
    async generateMockHistoricalData(symbol, timeframe, from, to) {
        const timeframeMinutes = this.getTimeframeMinutes(timeframe);
        const endTime = to ? new Date(to) : new Date();
        const startTime = from ? new Date(from) : new Date(endTime.getTime() - (100 * timeframeMinutes * 60 * 1000));

        const data = [];
        let currentTime = new Date(startTime);
        let currentPrice = 1000 + Math.random() * 4000; // Base price between 1000-5000

        while (currentTime <= endTime) {
            const timestamp = Math.floor(currentTime.getTime() / 1000);
            
            // Generate OHLCV data with realistic price movement
            const open = currentPrice;
            const changePercent = (Math.random() - 0.5) * 0.1; // ±5% max change
            const close = open * (1 + changePercent);
            
            const high = Math.max(open, close) * (1 + Math.random() * 0.02);
            const low = Math.min(open, close) * (1 - Math.random() * 0.02);
            const volume = Math.floor(Math.random() * 10000000) + 100000;

            data.push({
                time: timestamp,
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(close.toFixed(2)),
                volume
            });

            currentPrice = close;
            currentTime = new Date(currentTime.getTime() + timeframeMinutes * 60 * 1000);
        }

        return data;
    }

    /**
     * Get timeframe in minutes
     */
    getTimeframeMinutes(timeframe) {
        const timeframes = {
            '1m': 1,
            '5m': 5,
            '15m': 15,
            '30m': 30,
            '1H': 60,
            '4H': 240,
            '1D': 1440,
            '1W': 10080,
            '1M': 43200
        };

        return timeframes[timeframe] || 1440; // Default to 1 day
    }

    /**
     * Fetch real-time quote (current price)
     */
    async getCurrentQuote(symbol) {
        try {
            const response = await fetch(`${this.baseURL}/stocks/search?query=${symbol}&limit=1`);
            const data = await response.json();
            
            if (data.stocks && data.stocks.length > 0) {
                const stock = data.stocks[0];
                return {
                    symbol: stock.symbol,
                    price: stock.last_price,
                    change: stock.price_change,
                    changePercent: stock.price_change_percent,
                    volume: stock.volume || 0,
                    timestamp: Date.now()
                };
            }

            // Fallback to mock data
            return this.generateMockQuote(symbol);
        } catch (error) {
            console.error('Error fetching current quote:', error);
            return this.generateMockQuote(symbol);
        }
    }

    /**
     * Generate mock current quote
     */
    generateMockQuote(symbol) {
        const basePrice = 1000 + Math.random() * 4000;
        const changePercent = (Math.random() - 0.5) * 0.2; // ±10%
        const change = basePrice * changePercent;
        
        return {
            symbol,
            price: parseFloat(basePrice.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat((changePercent * 100).toFixed(2)),
            volume: Math.floor(Math.random() * 10000000) + 100000,
            timestamp: Date.now()
        };
    }

    /**
     * Fetch multiple symbols data
     */
    async getMultipleHistoricalData(symbols, timeframe = '1D', from = null, to = null) {
        const promises = symbols.map(symbol => 
            this.getHistoricalData(symbol, timeframe, from, to)
        );

        try {
            const results = await Promise.all(promises);
            const data = {};
            
            symbols.forEach((symbol, index) => {
                data[symbol] = results[index];
            });
            
            return data;
        } catch (error) {
            console.error('Error fetching multiple historical data:', error);
            throw error;
        }
    }

    /**
     * Search for symbols
     */
    async searchSymbols(query, limit = 10) {
        try {
            const [stocksResponse, currenciesResponse] = await Promise.all([
                fetch(`${this.baseURL}/stocks/search?query=${query}&limit=${limit}`),
                fetch(`${this.baseURL}/currencies/search?query=${query}&limit=${limit}`)
            ]);

            const stocksData = await stocksResponse.json();
            const currenciesData = await currenciesResponse.json();

            return {
                stocks: stocksData.stocks || [],
                currencies: currenciesData.currencies || []
            };
        } catch (error) {
            console.error('Error searching symbols:', error);
            return { stocks: [], currencies: [] };
        }
    }

    /**
     * Get supported timeframes
     */
    getSupportedTimeframes() {
        return [
            { value: '1m', label: '1 Minute', minutes: 1 },
            { value: '5m', label: '5 Minutes', minutes: 5 },
            { value: '15m', label: '15 Minutes', minutes: 15 },
            { value: '30m', label: '30 Minutes', minutes: 30 },
            { value: '1H', label: '1 Hour', minutes: 60 },
            { value: '4H', label: '4 Hours', minutes: 240 },
            { value: '1D', label: '1 Day', minutes: 1440 },
            { value: '1W', label: '1 Week', minutes: 10080 },
            { value: '1M', label: '1 Month', minutes: 43200 }
        ];
    }

    /**
     * Calculate indicators (simplified - in production use TA-Lib or server-side calculation)
     */
    async calculateIndicators(data, indicators) {
        const results = {};

        for (const indicator of indicators) {
            switch (indicator.type) {
                case 'sma':
                    results[indicator.id] = this.calculateSMA(data, indicator.period);
                    break;
                case 'ema':
                    results[indicator.id] = this.calculateEMA(data, indicator.period);
                    break;
                case 'rsi':
                    results[indicator.id] = this.calculateRSI(data, indicator.period);
                    break;
                case 'macd':
                    results[indicator.id] = this.calculateMACD(data, indicator.fastPeriod, indicator.slowPeriod, indicator.signalPeriod);
                    break;
                case 'bb':
                    results[indicator.id] = this.calculateBollingerBands(data, indicator.period, indicator.stdDev);
                    break;
                default:
                    console.warn(`Indicator ${indicator.type} not implemented`);
            }
        }

        return results;
    }

    // Simplified technical indicator calculations
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
        let gains = 0;
        let losses = 0;

        // Calculate initial averages
        for (let i = 1; i <= period; i++) {
            const change = data[i].close - data[i-1].close;
            if (change > 0) gains += change;
            else losses -= change;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period; i < data.length; i++) {
            const change = data[i].close - data[i-1].close;
            
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - change) / period;
            }

            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));

            result.push({
                time: data[i].time,
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
        const startIndex = Math.max(fastEMA.length, slowEMA.length) - Math.min(fastEMA.length, slowEMA.length);
        
        for (let i = startIndex; i < Math.min(fastEMA.length, slowEMA.length); i++) {
            macdLine.push({
                time: fastEMA[i].time,
                value: fastEMA[i].value - slowEMA[i].value
            });
        }
        
        // Calculate Signal line (EMA of MACD)
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        
        // Calculate Histogram
        const histogram = [];
        for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
            if (macdLine[i] && signalLine[i] && macdLine[i].time === signalLine[i].time) {
                histogram.push({
                    time: macdLine[i].time,
                    value: macdLine[i].value - signalLine[i].value
                });
            }
        }

        return {
            macd: macdLine,
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
            
            // Calculate standard deviation
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

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Export singleton instance
export default new HistoricalDataService();