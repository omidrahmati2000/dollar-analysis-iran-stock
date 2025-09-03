const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1920,
    viewportHeight: 1080,
    video: false,
    screenshot: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    setupNodeEvents(on, config) {
      // Task for custom commands
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });
    },
    
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js'
  },
  
  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.js'
  },
  
  env: {
    // Test environment variables
    apiUrl: 'http://localhost:8000/api/v2',
    testSymbol: 'AAPL',
    testTimeframe: '1D'
  }
});