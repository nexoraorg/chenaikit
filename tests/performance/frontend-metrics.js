// Frontend Performance Metrics Testing
// Uses Lighthouse CI and Web Vitals for comprehensive performance analysis

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  'first-contentful-paint': 1500,      // 1.5s
  'largest-contentful-paint': 2500,    // 2.5s
  'cumulative-layout-shift': 0.1,      // 0.1
  'first-input-delay': 100,           // 100ms
  'speed-index': 3000,                // 3s
  'time-to-interactive': 5000,         // 5s
  'total-blocking-time': 300,          // 300ms
};

// Test configurations
const TEST_CONFIGURATIONS = [
  {
    name: 'Dashboard Load',
    url: 'http://localhost:3000/dashboard',
    viewport: { width: 1920, height: 1080 },
    networkThrottling: 'regular3G',
    cpuThrottling: 4,
  },
  {
    name: 'Transactions Page',
    url: 'http://localhost:3000/transactions',
    viewport: { width: 1920, height: 1080 },
    networkThrottling: 'regular3G',
    cpuThrottling: 4,
  },
  {
    name: 'Analytics Dashboard',
    url: 'http://localhost:3000/analytics',
    viewport: { width: 1920, height: 1080 },
    networkThrottling: 'regular3G',
    cpuThrottling: 4,
  },
  {
    name: 'Mobile Dashboard',
    url: 'http://localhost:3000/dashboard',
    viewport: { width: 375, height: 667 },
    networkThrottling: 'slow3G',
    cpuThrottling: 4,
  },
];

class FrontendPerformanceTester {
  constructor() {
    this.results = [];
    this.browser = null;
    this.page = null;
  }

  // Initialize browser and page
  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.browser.newPage();
    
    // Enable performance monitoring
    await this.page.coverage.startJSCoverage();
    await this.page.coverage.startCSSCoverage();
  }

  // Run all performance tests
  async runAllTests() {
    console.log('🚀 Starting frontend performance tests...\n');

    for (const config of TEST_CONFIGURATIONS) {
      await this.runTest(config);
    }

    await this.generateReport();
    await this.cleanup();
  }

  // Run individual test
  async runTest(config) {
    console.log(`📊 Testing ${config.name}...`);
    
    try {
      // Set viewport
      await this.page.setViewport(config.viewport);
      
      // Set up network throttling
      await this.page.emulateNetworkConditions({
        offline: false,
        downloadThroughput: this.getNetworkSpeed(config.networkThrottling).download,
        uploadThroughput: this.getNetworkSpeed(config.networkThrottling).upload,
        latency: this.getNetworkSpeed(config.networkThrottling).latency,
      });
      
      // Set up CPU throttling
      await this.page.emulateCPUThrottling(config.cpuThrottling);
      
      // Navigate to page
      const startTime = Date.now();
      await this.page.goto(config.url, { waitUntil: 'networkidle2' });
      const loadTime = Date.now() - startTime;
      
      // Wait for page to be fully interactive
      await this.page.waitForTimeout(3000);
      
      // Collect performance metrics
      const metrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        return {
          navigation,
          paint,
          webVitals: this.collectWebVitals(),
        };
      });
      
      // Collect coverage information
      const [jsCoverage, cssCoverage] = await Promise.all([
        this.page.coverage.stopJSCoverage(),
        this.page.coverage.stopCSSCoverage(),
      ]);
      
      // Calculate coverage statistics
      const jsStats = this.calculateCoverage(jsCoverage);
      const cssStats = this.calculateCoverage(cssCoverage);
      
      // Restart coverage collection
      await this.page.coverage.startJSCoverage();
      await this.page.coverage.startCSSCoverage();
      
      // Create result object
      const result = {
        testName: config.name,
        url: config.url,
        viewport: config.viewport,
        networkThrottling: config.networkThrottling,
        cpuThrottling: config.cpuThrottling,
        loadTime,
        metrics,
        jsCoverage: jsStats,
        cssCoverage: cssStats,
        timestamp: new Date().toISOString(),
        passed: this.evaluatePerformance(metrics),
      };
      
      this.results.push(result);
      
      // Print results
      this.printTestResult(result);
      
    } catch (error) {
      console.error(`❌ Error testing ${config.name}:`, error.message);
      
      const result = {
        testName: config.name,
        url: config.url,
        error: error.message,
        passed: false,
        timestamp: new Date().toISOString(),
      };
      
      this.results.push(result);
    }
  }

  // Collect Web Vitals metrics
  async collectWebVitals() {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {};
        
        // First Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcp = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcp) vitals.firstContentfulPaint = fcp.startTime;
        }).observe({ entryTypes: ['paint'] });
        
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lcp = entries[entries.length - 1];
          vitals.largestContentfulPaint = lcp.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Cumulative Layout Shift
        new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          vitals.cumulativeLayoutShift = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });
        
        // First Input Delay
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            vitals.firstInputDelay = entry.processingStart - entry.startTime;
            break;
          }
        }).observe({ entryTypes: ['first-input'] });
        
        // Time to Interactive
        setTimeout(() => {
          vitals.timeToInteractive = performance.timing.domInteractive - performance.timing.navigationStart;
          resolve(vitals);
        }, 5000);
      });
    });
  }

  // Calculate coverage statistics
  calculateCoverage(coverage) {
    const totalBytes = coverage.reduce((sum, entry) => sum + entry.text.length, 0);
    const usedBytes = coverage.reduce((sum, entry) => {
      return sum + entry.ranges.reduce((rangeSum, range) => rangeSum + (range.end - range.start), 0);
    }, 0);
    
    return {
      totalBytes,
      usedBytes,
      coveragePercentage: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
      unusedBytes: totalBytes - usedBytes,
    };
  }

  // Get network speed configuration
  getNetworkSpeed(throttling) {
    const speeds = {
      'slow3G': { download: 500 * 1024 / 8, upload: 500 * 1024 / 8, latency: 400 },
      'regular3G': { download: 750 * 1024 / 8, upload: 250 * 1024 / 8, latency: 300 },
      'good3G': { download: 1.5 * 1024 * 1024 / 8, upload: 750 * 1024 / 8, latency: 200 },
      'regular4G': { download: 4 * 1024 * 1024 / 8, upload: 3 * 1024 * 1024 / 8, latency: 100 },
      'DSL': { download: 2 * 1024 * 1024 / 8, upload: 1 * 1024 * 1024 / 8, latency: 50 },
      'WiFi': { download: 30 * 1024 * 1024 / 8, upload: 15 * 1024 * 1024 / 8, latency: 20 },
    };
    
    return speeds[throttling] || speeds['regular3G'];
  }

  // Evaluate performance against thresholds
  evaluatePerformance(metrics) {
    const webVitals = metrics.webVitals;
    
    for (const [metric, threshold] of Object.entries(PERFORMANCE_THRESHOLDS)) {
      const value = webVitals[this.camelCase(metric)];
      if (value && value > threshold) {
        return false;
      }
    }
    
    return true;
  }

  // Convert string to camelCase
  camelCase(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  // Print individual test result
  printTestResult(result) {
    if (result.error) {
      console.log(`❌ ${result.testName}: ${result.error}`);
      return;
    }
    
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.testName}: ${result.loadTime}ms`);
    
    if (result.metrics.webVitals) {
      const vitals = result.metrics.webVitals;
      console.log(`   FCP: ${vitals.firstContentfulPaint?.toFixed(0)}ms`);
      console.log(`   LCP: ${vitals.largestContentfulPaint?.toFixed(0)}ms`);
      console.log(`   CLS: ${vitals.cumulativeLayoutShift?.toFixed(3)}`);
      console.log(`   FID: ${vitals.firstInputDelay?.toFixed(0)}ms`);
      console.log(`   TTI: ${vitals.timeToInteractive?.toFixed(0)}ms`);
    }
    
    console.log(`   JS Coverage: ${result.jsCoverage.coveragePercentage.toFixed(1)}%`);
    console.log(`   CSS Coverage: ${result.cssCoverage.coveragePercentage.toFixed(1)}%`);
    console.log();
  }

  // Generate comprehensive report
  async generateReport() {
    console.log('📊 Generating Performance Report...\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      detailedResults: this.results,
      recommendations: this.generateRecommendations(),
      thresholds: PERFORMANCE_THRESHOLDS,
    };
    
    // Save report to file
    const reportPath = path.join(__dirname, 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${reportPath}`);
    
    // Print summary
    this.printSummary(report.summary);
  }

  // Generate performance summary
  generateSummary() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    const averageLoadTime = this.results
      .filter(r => r.loadTime)
      .reduce((sum, r) => sum + r.loadTime, 0) / (totalTests || 1);
    
    const averageJSCoverage = this.results
      .filter(r => r.jsCoverage)
      .reduce((sum, r) => sum + r.jsCoverage.coveragePercentage, 0) / (totalTests || 1);
    
    const averageCSSCoverage = this.results
      .filter(r => r.cssCoverage)
      .reduce((sum, r) => sum + r.cssCoverage.coveragePercentage, 0) / (totalTests || 1);
    
    return {
      totalTests,
      passedTests,
      failedTests,
      passRate: (passedTests / totalTests) * 100,
      averageLoadTime: Math.round(averageLoadTime),
      averageJSCoverage: Math.round(averageJSCoverage * 10) / 10,
      averageCSSCoverage: Math.round(averageCSSCoverage * 10) / 10,
    };
  }

  // Generate performance recommendations
  generateRecommendations() {
    const recommendations = [];
    
    // Analyze load times
    const slowTests = this.results.filter(r => r.loadTime && r.loadTime > 3000);
    if (slowTests.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Optimize Page Load Times',
        description: `${slowTests.length} pages have load times over 3 seconds`,
        actions: [
          'Implement code splitting',
          'Optimize images and assets',
          'Use lazy loading for non-critical resources',
          'Enable compression (gzip/brotli)',
        ],
      });
    }
    
    // Analyze coverage
    const lowJSCoverage = this.results.filter(r => r.jsCoverage && r.jsCoverage.coveragePercentage < 50);
    if (lowJSCoverage.length > 0) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Reduce Unused JavaScript',
        description: `${lowJSCoverage.length} pages have less than 50% JS coverage`,
        actions: [
          'Remove unused code and dependencies',
          'Implement tree shaking',
          'Use dynamic imports for conditional features',
          'Consider smaller alternatives for large libraries',
        ],
      });
    }
    
    // Analyze CLS
    const highCLS = this.results.filter(r => 
      r.metrics?.webVitals?.cumulativeLayoutShift > 0.1
    );
    if (highCLS.length > 0) {
      recommendations.push({
        type: 'ux',
        priority: 'high',
        title: 'Reduce Cumulative Layout Shift',
        description: `${highCLS.length} pages have CLS above 0.1`,
        actions: [
          'Set explicit dimensions for images and videos',
          'Reserve space for dynamic content',
          'Avoid inserting content above existing content',
          'Use transform animations instead of changing layout properties',
        ],
      });
    }
    
    return recommendations;
  }

  // Print performance summary
  printSummary(summary) {
    console.log('📈 Performance Summary:');
    console.log(`  Total Tests: ${summary.totalTests}`);
    console.log(`  Passed: ${summary.passedTests} (${summary.passRate.toFixed(1)}%)`);
    console.log(`  Failed: ${summary.failedTests}`);
    console.log(`  Average Load Time: ${summary.averageLoadTime}ms`);
    console.log(`  Average JS Coverage: ${summary.averageJSCoverage}%`);
    console.log(`  Average CSS Coverage: ${summary.averageCSSCoverage}%`);
    console.log();
    
    if (summary.failedTests > 0) {
      console.log('⚠️  Some tests failed. See detailed report for recommendations.');
    } else {
      console.log('🎉 All tests passed! Performance is within acceptable thresholds.');
    }
  }

  // Cleanup resources
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Lighthouse CI integration
class LighthouseCITester {
  constructor() {
    this.lighthouse = require('lighthouse');
    this.chromeLauncher = require('chrome-launcher');
  }

  // Run Lighthouse audit
  async runLighthouseAudit(url, options = {}) {
    const chrome = await this.chromeLauncher.launch({ chromeFlags: ['--headless'] });
    const opts = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
      ...options,
    };
    
    const runnerResult = await this.lighthouse(url, opts);
    await chrome.kill();
    
    return runnerResult;
  }

  // Run Lighthouse for all test configurations
  async runAllLighthouseTests() {
    console.log('🔦 Running Lighthouse audits...\n');
    
    for (const config of TEST_CONFIGURATIONS) {
      try {
        console.log(`🔦 Auditing ${config.name}...`);
        const result = await this.runLighthouseAudit(config.url, {
          settings: {
            formFactor: config.viewport.width < 768 ? 'mobile' : 'desktop',
            throttling: {
              rttMs: this.getNetworkSpeed(config.networkThrottling).latency,
              throughputKbps: this.getNetworkSpeed(config.networkThrottling).download * 8 / 1024,
              cpuSlowdownMultiplier: config.cpuThrottling,
            },
          },
        });
        
        const score = result.lhr.categories.performance.score * 100;
        console.log(`   Performance Score: ${score.toFixed(0)}`);
        
        // Save Lighthouse report
        const reportPath = path.join(__dirname, `lighthouse-${config.name.toLowerCase().replace(/\s+/g, '-')}.html`);
        fs.writeFileSync(reportPath, result.report);
        console.log(`   Report saved: ${reportPath}`);
        
      } catch (error) {
        console.error(`❌ Lighthouse audit failed for ${config.name}:`, error.message);
      }
    }
  }
}

// Main execution
async function runPerformanceTests() {
  const tester = new FrontendPerformanceTester();
  await tester.initialize();
  await tester.runAllTests();
  
  // Run Lighthouse tests if available
  try {
    const lighthouseTester = new LighthouseCITester();
    await lighthouseTester.runAllLighthouseTests();
  } catch (error) {
    console.log('⚠️  Lighthouse not available, skipping Lighthouse tests');
  }
}

// CLI interface
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = {
  FrontendPerformanceTester,
  LighthouseCITester,
  PERFORMANCE_THRESHOLDS,
  TEST_CONFIGURATIONS,
};
