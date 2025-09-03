class PerformanceBenchmark {
    constructor() {
        this.marks = new Map();
        this.measures = [];
    }

    start(name) {
        const startTime = performance.now();
        this.marks.set(name, startTime);
        console.log(`🚀 Starting: ${name} at ${startTime.toFixed(2)}ms`);
        return startTime;
    }

    end(name, maxExpected = null) {
        const startTime = this.marks.get(name);
        if (!startTime) {
            console.warn(`⚠️ No start mark found for: ${name}`);
            return null;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        
        const measure = {
            name,
            startTime,
            endTime,
            duration
        };

        this.measures.push(measure);
        this.marks.delete(name);

        const status = maxExpected && duration > maxExpected ? '❌' : '✅';
        console.log(`${status} ${name}: ${duration.toFixed(2)}ms${maxExpected ? ` (max: ${maxExpected}ms)` : ''}`);

        return measure;
    }

    getMemoryUsage() {
        if (!performance.memory) {
            return { error: 'Memory API not available' };
        }

        const memory = performance.memory;
        const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
        const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);

        const memoryInfo = {
            used: parseFloat(usedMB),
            total: parseFloat(totalMB),
            limit: parseFloat(limitMB),
            usagePercent: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2)
        };

        console.log(`🧠 Memory: ${usedMB}MB used / ${totalMB}MB total / ${limitMB}MB limit (${memoryInfo.usagePercent}%)`);
        
        return memoryInfo;
    }

    testChartPerformance(chartEngine) {
        if (!chartEngine) return;

        this.start('chart-render-test');
        
        // Simulate chart interactions
        const testData = this.generateTestData(100);
        chartEngine.setData?.(testData);
        
        setTimeout(() => {
            this.end('chart-render-test', 1000);
            this.getMemoryUsage();
        }, 100);
    }

    generateTestData(count) {
        const data = [];
        let price = 100;
        const now = Date.now();

        for (let i = 0; i < count; i++) {
            const time = now - (count - i) * 60000;
            const change = (Math.random() - 0.5) * 2;
            price += change;

            data.push({
                time: Math.floor(time / 1000),
                open: price,
                high: price + Math.random() * 2,
                low: price - Math.random() * 2,
                close: price + (Math.random() - 0.5) * 1,
                volume: Math.floor(Math.random() * 1000000)
            });
        }

        return data;
    }

    runFullBenchmark() {
        console.log('🏁 Starting Full Performance Benchmark');
        
        // Test memory baseline
        const baselineMemory = this.getMemoryUsage();
        
        // Test data generation
        this.start('data-generation');
        const testData = this.generateTestData(500);
        this.end('data-generation', 100);
        
        // Test data processing
        this.start('data-processing');
        const processedData = testData.map(item => ({
            ...item,
            sma: this.calculateSMA(testData, 20, testData.indexOf(item))
        }));
        this.end('data-processing', 200);
        
        // Memory after processing
        const afterMemory = this.getMemoryUsage();
        const memoryIncrease = afterMemory.used - baselineMemory.used;
        
        console.log(`📊 Memory increase: ${memoryIncrease.toFixed(2)}MB`);
        
        // Summary
        this.printSummary();
        
        return {
            measures: this.measures,
            memoryBaseline: baselineMemory,
            memoryAfter: afterMemory,
            memoryIncrease
        };
    }

    calculateSMA(data, period, index) {
        if (index < period - 1) return null;
        
        const sum = data
            .slice(index - period + 1, index + 1)
            .reduce((acc, item) => acc + item.close, 0);
        
        return sum / period;
    }

    printSummary() {
        console.log('\n📋 Performance Summary:');
        console.log('=========================');
        
        this.measures.forEach(measure => {
            const status = measure.duration > 1000 ? '❌ SLOW' : 
                          measure.duration > 500 ? '⚠️ MEDIUM' : '✅ FAST';
            console.log(`${status} ${measure.name}: ${measure.duration.toFixed(2)}ms`);
        });
        
        const totalTime = this.measures.reduce((sum, measure) => sum + measure.duration, 0);
        console.log(`\n⏱️ Total Time: ${totalTime.toFixed(2)}ms`);
        
        this.getMemoryUsage();
        console.log('=========================\n');
    }

    monitorFrameRate() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const countFrames = (currentTime) => {
            frameCount++;
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round(frameCount * 1000 / (currentTime - lastTime));
                const status = fps >= 60 ? '✅' : fps >= 30 ? '⚠️' : '❌';
                console.log(`${status} FPS: ${fps}`);
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(countFrames);
        };
        
        requestAnimationFrame(countFrames);
    }

    checkWebVitals() {
        if ('navigation' in performance.getEntriesByType('navigation')[0]) {
            const navigation = performance.getEntriesByType('navigation')[0];
            
            const vitals = {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
                loadComplete: navigation.loadEventEnd - navigation.navigationStart,
                firstByte: navigation.responseStart - navigation.requestStart,
                domInteractive: navigation.domInteractive - navigation.navigationStart
            };
            
            console.log('🎯 Web Vitals:');
            console.log(`   DOM Content Loaded: ${vitals.domContentLoaded.toFixed(2)}ms`);
            console.log(`   Load Complete: ${vitals.loadComplete.toFixed(2)}ms`);
            console.log(`   First Byte: ${vitals.firstByte.toFixed(2)}ms`);
            console.log(`   DOM Interactive: ${vitals.domInteractive.toFixed(2)}ms`);
            
            return vitals;
        }
        
        return null;
    }

    startMemoryMonitoring() {
        setInterval(() => {
            const memory = this.getMemoryUsage();
            if (memory.used > 100) {
                console.warn(`⚠️ High memory usage detected: ${memory.used}MB`);
            }
        }, 10000); // Check every 10 seconds
    }
}

// Global instance
const benchmark = new PerformanceBenchmark();

// Auto-start monitoring
if (typeof window !== 'undefined') {
    window.performanceBenchmark = benchmark;
    benchmark.startMemoryMonitoring();
    
    // Log initial state
    setTimeout(() => {
        benchmark.checkWebVitals();
        benchmark.getMemoryUsage();
    }, 1000);
}

export default benchmark;