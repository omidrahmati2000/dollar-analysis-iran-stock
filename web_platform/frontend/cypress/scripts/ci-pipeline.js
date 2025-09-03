#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// CI/CD Pipeline Configuration
const PIPELINE_CONFIG = {
  parallel: false, // Set to true for parallel execution
  retries: 2,
  timeout: 30000,
  browsers: ['electron'], // Add 'chrome', 'firefox' for cross-browser testing
  recordVideo: true,
  generateReport: true
};

class CIPipeline {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    
    console.log(`${colors[level]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: 'pipe',
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data;
        if (options.verbose) {
          console.log(data.toString());
        }
      });

      process.stderr.on('data', (data) => {
        stderr += data;
        if (options.verbose) {
          console.error(data.toString());
        }
      });

      process.on('close', (code) => {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      process.on('error', reject);
    });
  }

  async checkPrerequisites() {
    this.log('🔍 Checking prerequisites...');

    // Check if Node.js and npm are available
    try {
      const nodeVersion = await this.runCommand('node', ['--version']);
      const npmVersion = await this.runCommand('npm', ['--version']);
      
      this.log(`✅ Node.js: ${nodeVersion.stdout}`, 'success');
      this.log(`✅ npm: ${npmVersion.stdout}`, 'success');
    } catch (error) {
      this.log('❌ Node.js or npm not found', 'error');
      throw error;
    }

    // Check if React app dependencies are installed
    if (!fs.existsSync('node_modules')) {
      this.log('📦 Installing dependencies...', 'warning');
      const install = await this.runCommand('npm', ['install'], { verbose: true });
      
      if (install.code !== 0) {
        this.log('❌ Failed to install dependencies', 'error');
        throw new Error('Dependency installation failed');
      }
    }

    // Check if React app is running
    try {
      const fetch = require('node-fetch').default || require('node-fetch');
      await fetch('http://localhost:3000');
      this.log('✅ React application is running', 'success');
    } catch (error) {
      this.log('⚠️ React application is not running. Attempting to start...', 'warning');
      
      // Start React app in background
      this.reactProcess = spawn('npm', ['start'], {
        detached: true,
        stdio: 'ignore'
      });

      // Wait for app to start
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const fetch = require('node-fetch').default || require('node-fetch');
          await fetch('http://localhost:3000');
          this.log('✅ React application started successfully', 'success');
          break;
        } catch {
          attempts++;
          this.log(`⏳ Waiting for React app to start... (${attempts}/${maxAttempts})`, 'info');
        }
      }

      if (attempts === maxAttempts) {
        throw new Error('Failed to start React application');
      }
    }
  }

  async runTestSuite(browser = 'electron') {
    this.log(`🧪 Running test suite with ${browser}...`);

    const cypressArgs = [
      'cypress', 'run',
      '--browser', browser,
      '--spec', 'cypress/e2e/**/*.cy.js'
    ];

    if (PIPELINE_CONFIG.recordVideo) {
      cypressArgs.push('--record');
    }

    const result = await this.runCommand('npx', cypressArgs, { verbose: true });
    
    return {
      browser,
      passed: result.code === 0,
      code: result.code,
      output: result.stdout,
      error: result.stderr
    };
  }

  async generateReport() {
    if (!PIPELINE_CONFIG.generateReport) return;

    this.log('📊 Generating test report...');

    const reportDir = path.join('cypress', 'reports');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      results: this.results,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        successRate: this.results.length > 0 ? 
          (this.results.filter(r => r.passed).length / this.results.length * 100).toFixed(2) : 0
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    const reportFile = path.join(reportDir, 'test-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    fs.writeFileSync(path.join(reportDir, 'test-report.html'), htmlReport);

    this.log(`✅ Report generated: ${reportFile}`, 'success');
    return report;
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Cypress Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat { background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        .result { margin: 10px 0; padding: 10px; border-left: 3px solid #ccc; }
        .result.passed { border-color: #28a745; }
        .result.failed { border-color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Cypress Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
        <p>Duration: ${(report.duration / 1000).toFixed(2)} seconds</p>
    </div>
    
    <div class="summary">
        <div class="stat">
            <h3>Total Tests</h3>
            <p>${report.summary.total}</p>
        </div>
        <div class="stat passed">
            <h3>Passed</h3>
            <p>${report.summary.passed}</p>
        </div>
        <div class="stat failed">
            <h3>Failed</h3>
            <p>${report.summary.failed}</p>
        </div>
        <div class="stat">
            <h3>Success Rate</h3>
            <p>${report.summary.successRate}%</p>
        </div>
    </div>
    
    <h2>Test Results</h2>
    ${report.results.map(result => `
        <div class="result ${result.passed ? 'passed' : 'failed'}">
            <h3>${result.passed ? '✅' : '❌'} ${result.browser.toUpperCase()}</h3>
            <p>Status: ${result.passed ? 'PASSED' : 'FAILED'}</p>
            ${result.error ? `<pre style="color: red;">${result.error}</pre>` : ''}
        </div>
    `).join('')}
    
    <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 5px;">
        <h3>Environment</h3>
        <ul>
            <li>Node.js: ${report.environment.nodeVersion}</li>
            <li>Platform: ${report.environment.platform}</li>
            <li>Architecture: ${report.environment.arch}</li>
        </ul>
    </div>
</body>
</html>`;
  }

  async cleanup() {
    this.log('🧹 Cleaning up...');

    // Kill React process if we started it
    if (this.reactProcess) {
      this.reactProcess.kill();
    }
  }

  async run() {
    try {
      this.log('🚀 Starting CI/CD Pipeline for Advanced Charts Testing', 'info');

      await this.checkPrerequisites();

      // Run tests for each browser
      for (const browser of PIPELINE_CONFIG.browsers) {
        let attempts = 0;
        let result;

        while (attempts <= PIPELINE_CONFIG.retries) {
          try {
            result = await this.runTestSuite(browser);
            break;
          } catch (error) {
            attempts++;
            if (attempts <= PIPELINE_CONFIG.retries) {
              this.log(`⚠️ Test failed, retrying... (${attempts}/${PIPELINE_CONFIG.retries})`, 'warning');
            } else {
              result = {
                browser,
                passed: false,
                code: 1,
                error: error.message
              };
            }
          }
        }

        this.results.push(result);
        
        if (result.passed) {
          this.log(`✅ Tests passed for ${browser}`, 'success');
        } else {
          this.log(`❌ Tests failed for ${browser}`, 'error');
        }
      }

      // Generate report
      const report = await this.generateReport();

      // Final summary
      const totalPassed = this.results.filter(r => r.passed).length;
      const totalFailed = this.results.filter(r => !r.passed).length;

      this.log('\n📊 Pipeline Summary:', 'info');
      this.log(`✅ Passed: ${totalPassed}`, 'success');
      this.log(`❌ Failed: ${totalFailed}`, 'error');

      if (totalFailed > 0) {
        this.log('💥 Pipeline failed - some tests did not pass', 'error');
        process.exit(1);
      } else {
        this.log('🎉 Pipeline completed successfully - all tests passed!', 'success');
        process.exit(0);
      }

    } catch (error) {
      this.log(`💥 Pipeline error: ${error.message}`, 'error');
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run pipeline
if (require.main === module) {
  const pipeline = new CIPipeline();
  pipeline.run();
}

module.exports = CIPipeline;