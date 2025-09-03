# 🧪 Cypress Testing Suite - Quick Start

## 🚀 اجرای سریع تست‌ها

### 1. شروع React Application
```bash
npm start
# Wait for http://localhost:3000 to be ready
```

### 2. اجرای تست‌ها
```bash
# همه تست‌ها
npm run test:e2e

# تست‌های خاص
npm run test:ui          # UI/UX Tests
npm run test:logic       # Logic Tests  
npm run test:performance # Performance Tests
npm run test:integration # Integration Tests

# Cypress GUI
npm run cypress:open
```

### 3. تست‌های Performance
```bash
npm run test:performance
# بررسی memory usage، loading times، frame rates
```

### 4. گزارش‌گیری
```bash
node cypress/scripts/ci-pipeline.js
# تولید گزارش HTML در cypress/reports/
```

## 📁 فایل‌های کلیدی

```
cypress/
├── e2e/                     # 6 دسته تست کامل
│   ├── 01-basic-navigation  # ناوبری و routing
│   ├── 02-advanced-charts-ui # UI/UX نمودار
│   ├── 03-indicators-logic  # منطق اندیکاتورها
│   ├── 04-drawing-tools     # ابزارهای رسم
│   ├── 05-integration-flows # user flows
│   └── 06-performance-tests # تست‌های عملکرد
├── support/commands.js      # Custom commands
└── scripts/test-runner.js   # اتوماسیون تست
```

## 🎯 تست‌های اصلی

1. **Navigation**: بررسی routing و responsive design
2. **Chart UI**: نمودار، chart types، symbols، timeframes  
3. **Indicators**: اندیکاتورهای تکنیکال و محاسبات
4. **Drawing Tools**: ابزارهای رسم و persistence
5. **Integration**: user workflows کامل
6. **Performance**: memory، speed، optimization

## 📊 Performance Monitoring

- ✅ Load time < 5s
- ✅ Memory usage < 100MB  
- ✅ Frame rate > 30fps
- ✅ Chart interactions < 100ms

## 🛠️ Custom Commands

```javascript
cy.waitForChartLoad()       // انتظار نمودار
cy.selectSymbol('AAPL')     // انتخاب نماد
cy.addIndicator('sma')      // اضافه کردن اندیکاتور
cy.measurePerformance()     // اندازه‌گیری performance
cy.checkMemoryUsage()       // بررسی memory
```

## 🐛 Debug

```bash
# Screenshot در صورت خطا
cypress run --spec "cypress/e2e/test.cy.js"

# Debug mode
DEBUG=cypress:* npm run cypress:run
```

مستندات کامل: [TESTING.md](../../../docs-dev/TESTING.md)