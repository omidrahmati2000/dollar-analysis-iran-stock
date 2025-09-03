#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  'navigation': {
    spec: 'cypress/e2e/01-basic-navigation.cy.js',
    description: '🧭 Basic Navigation Tests'
  },
  'ui': {
    spec: 'cypress/e2e/02-advanced-charts-ui.cy.js',
    description: '📈 Advanced Charts UI Tests'
  },
  'logic': {
    spec: 'cypress/e2e/03-indicators-logic.cy.js',
    description: '📊 Technical Indicators Logic Tests'
  },
  'drawing': {
    spec: 'cypress/e2e/04-drawing-tools.cy.js',
    description: '✏️ Drawing Tools Tests'
  },
  'integration': {
    spec: 'cypress/e2e/05-integration-flows.cy.js',
    description: '🌊 Integration Flow Tests'
  },
  'performance': {
    spec: 'cypress/e2e/06-performance-tests.cy.js',
    description: '🚀 Performance Tests'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTest(testName, config) {
  return new Promise((resolve, reject) => {
    log(`\n${config.description}`, 'cyan');
    log(`Running: ${testName}`, 'yellow');
    
    const startTime = Date.now();
    
    const cypress = spawn('npx', ['cypress', 'run', '--spec', config.spec], {
      stdio: 'inherit',
      shell: true
    });
    
    cypress.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        log(`✅ ${testName} passed in ${duration}s`, 'green');
        resolve({ test: testName, status: 'passed', duration });
      } else {
        log(`❌ ${testName} failed in ${duration}s`, 'red');
        resolve({ test: testName, status: 'failed', duration, exitCode: code });
      }
    });
    
    cypress.on('error', (error) => {
      log(`💥 Error running ${testName}: ${error.message}`, 'red');
      reject(error);
    });
  });
}

async function runAllTests() {
  log('\n🚀 Starting Comprehensive Test Suite', 'bright');
  log('=====================================', 'bright');
  
  const startTime = Date.now();
  const results = [];
  
  // Check if React app is running
  log('\n🔍 Checking if React application is running...', 'yellow');
  
  try {
    const fetch = require('node-fetch').default;
    await fetch('http://localhost:3000');
    log('✅ React application is running on port 3000', 'green');
  } catch (error) {
    log('❌ React application is not running on port 3000', 'red');
    log('Please start the React app with: npm start', 'yellow');
    process.exit(1);
  }
  
  // Run tests sequentially
  for (const [testName, config] of Object.entries(TEST_CONFIG)) {
    try {
      const result = await runTest(testName, config);
      results.push(result);
    } catch (error) {
      results.push({
        test: testName,
        status: 'error',
        error: error.message,
        duration: 0
      });
    }
  }
  
  // Print summary
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const errors = results.filter(r => r.status === 'error').length;
  
  log('\n📊 Test Results Summary', 'bright');
  log('=======================', 'bright');
  
  results.forEach(result => {
    const icon = result.status === 'passed' ? '✅' : 
                 result.status === 'failed' ? '❌' : '💥';
    const color = result.status === 'passed' ? 'green' : 'red';
    
    log(`${icon} ${result.test}: ${result.status} (${result.duration}s)`, color);
  });
  
  log(`\n📈 Overall Results:`, 'bright');
  log(`   Total Tests: ${results.length}`, 'cyan');
  log(`   Passed: ${passed}`, 'green');
  log(`   Failed: ${failed}`, 'red');
  log(`   Errors: ${errors}`, 'magenta');
  log(`   Total Duration: ${totalDuration}s`, 'yellow');
  
  const successRate = ((passed / results.length) * 100).toFixed(1);
  log(`   Success Rate: ${successRate}%`, successRate > 80 ? 'green' : 'red');
  
  // Exit with appropriate code
  if (failed > 0 || errors > 0) {
    log('\n❌ Some tests failed. Check the logs above for details.', 'red');
    process.exit(1);
  } else {
    log('\n🎉 All tests passed successfully!', 'green');
    process.exit(0);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  runAllTests();
} else {
  const testName = args[0];
  if (TEST_CONFIG[testName]) {
    runTest(testName, TEST_CONFIG[testName])
      .then(result => {
        if (result.status === 'passed') {
          log(`\n🎉 Test ${testName} passed!`, 'green');
          process.exit(0);
        } else {
          log(`\n❌ Test ${testName} failed!`, 'red');
          process.exit(1);
        }
      })
      .catch(error => {
        log(`\n💥 Error: ${error.message}`, 'red');
        process.exit(1);
      });
  } else {
    log(`❌ Unknown test: ${testName}`, 'red');
    log(`Available tests: ${Object.keys(TEST_CONFIG).join(', ')}`, 'yellow');
    process.exit(1);
  }
}