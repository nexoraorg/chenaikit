#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Performance thresholds
const THRESHOLDS = {
  api: {
    avgResponseTime: 200,      // ms
    p95ResponseTime: 500,      // ms
    errorRate: 0.1,            // percentage
    throughput: 1000,          // RPS
  },
  frontend: {
    lighthouseScore: 90,       // out of 100
    bundleSize: 1024 * 1024,   // 1MB in bytes
    fcp: 1500,                 // First Contentful Paint (ms)
    lcp: 2500,                 // Largest Contentful Paint (ms)
    cls: 0.1,                  // Cumulative Layout Shift
    fid: 100,                  // First Input Delay (ms)
  },
  database: {
    avgQueryTime: 100,         // ms
    p95QueryTime: 200,         // ms
    indexUsage: 95,            // percentage
    cacheHitRate: 90,          // percentage
  },
  contracts: {
    avgGasUsage: 50000,        // gas units
    maxGasUsage: 100000,       // gas units
    avgExecutionTime: 1000,    // ms
  },
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkApiPerformance(results) {
  log('blue', '🔍 Checking API Performance...');
  
  const metrics = results.metrics || {};
  const issues = [];
  
  // Check average response time
  if (metrics.http_req_duration && metrics.http_req_duration.avg > THRESHOLDS.api.avgResponseTime) {
    issues.push({
      type: 'avgResponseTime',
      actual: metrics.http_req_duration.avg,
      threshold: THRESHOLDS.api.avgResponseTime,
      severity: 'high',
    });
  }
  
  // Check 95th percentile response time
  if (metrics.http_req_duration && metrics.http_req_duration['p(95)'] > THRESHOLDS.api.p95ResponseTime) {
    issues.push({
      type: 'p95ResponseTime',
      actual: metrics.http_req_duration['p(95)'],
      threshold: THRESHOLDS.api.p95ResponseTime,
      severity: 'medium',
    });
  }
  
  // Check error rate
  if (metrics.http_req_failed && metrics.http_req_failed.rate > THRESHOLDS.api.errorRate) {
    issues.push({
      type: 'errorRate',
      actual: metrics.http_req_failed.rate * 100,
      threshold: THRESHOLDS.api.errorRate,
      severity: 'high',
    });
  }
  
  // Check throughput
  if (metrics.http_reqs && metrics.http_reqs.rate < THRESHOLDS.api.throughput) {
    issues.push({
      type: 'throughput',
      actual: metrics.http_reqs.rate,
      threshold: THRESHOLDS.api.throughput,
      severity: 'medium',
    });
  }
  
  if (issues.length === 0) {
    log('green', '✅ API performance is within thresholds');
  } else {
    log('red', '❌ API performance issues detected:');
    issues.forEach(issue => {
      const color = issue.severity === 'high' ? 'red' : 'yellow';
      log(color, `   ${issue.type}: ${issue.actual.toFixed(2)} (threshold: ${issue.threshold})`);
    });
  }
  
  return issues;
}

function checkFrontendPerformance(results) {
  log('blue', '🎨 Checking Frontend Performance...');
  
  const issues = [];
  
  // Check Lighthouse score
  if (results.lighthouse && results.lighthouse.categories && results.lighthouse.categories.performance) {
    const score = results.lighthouse.categories.performance.score * 100;
    if (score < THRESHOLDS.frontend.lighthouseScore) {
      issues.push({
        type: 'lighthouseScore',
        actual: score,
        threshold: THRESHOLDS.frontend.lighthouseScore,
        severity: 'medium',
      });
    }
  }
  
  // Check bundle size
  if (results.bundleSize && results.bundleSize > THRESHOLDS.frontend.bundleSize) {
    issues.push({
      type: 'bundleSize',
      actual: results.bundleSize,
      threshold: THRESHOLDS.frontend.bundleSize,
      severity: 'high',
    });
  }
  
  // Check Web Vitals
  if (results.webVitals) {
    const vitals = results.webVitals;
    
    if (vitals.firstContentfulPaint > THRESHOLDS.frontend.fcp) {
      issues.push({
        type: 'fcp',
        actual: vitals.firstContentfulPaint,
        threshold: THRESHOLDS.frontend.fcp,
        severity: 'medium',
      });
    }
    
    if (vitals.largestContentfulPaint > THRESHOLDS.frontend.lcp) {
      issues.push({
        type: 'lcp',
        actual: vitals.largestContentfulPaint,
        threshold: THRESHOLDS.frontend.lcp,
        severity: 'medium',
      });
    }
    
    if (vitals.cumulativeLayoutShift > THRESHOLDS.frontend.cls) {
      issues.push({
        type: 'cls',
        actual: vitals.cumulativeLayoutShift,
        threshold: THRESHOLDS.frontend.cls,
        severity: 'high',
      });
    }
    
    if (vitals.firstInputDelay > THRESHOLDS.frontend.fid) {
      issues.push({
        type: 'fid',
        actual: vitals.firstInputDelay,
        threshold: THRESHOLDS.frontend.fid,
        severity: 'medium',
      });
    }
  }
  
  if (issues.length === 0) {
    log('green', '✅ Frontend performance is within thresholds');
  } else {
    log('red', '❌ Frontend performance issues detected:');
    issues.forEach(issue => {
      const color = issue.severity === 'high' ? 'red' : 'yellow';
      log(color, `   ${issue.type}: ${issue.actual} (threshold: ${issue.threshold})`);
    });
  }
  
  return issues;
}

function checkDatabasePerformance(results) {
  log('blue', '🗄️ Checking Database Performance...');
  
  const issues = [];
  
  // Check average query time
  if (results.avgQueryTime && results.avgQueryTime > THRESHOLDS.database.avgQueryTime) {
    issues.push({
      type: 'avgQueryTime',
      actual: results.avgQueryTime,
      threshold: THRESHOLDS.database.avgQueryTime,
      severity: 'high',
    });
  }
  
  // Check 95th percentile query time
  if (results.p95QueryTime && results.p95QueryTime > THRESHOLDS.database.p95QueryTime) {
    issues.push({
      type: 'p95QueryTime',
      actual: results.p95QueryTime,
      threshold: THRESHOLDS.database.p95QueryTime,
      severity: 'medium',
    });
  }
  
  // Check index usage
  if (results.indexUsage && results.indexUsage < THRESHOLDS.database.indexUsage) {
    issues.push({
      type: 'indexUsage',
      actual: results.indexUsage,
      threshold: THRESHOLDS.database.indexUsage,
      severity: 'medium',
    });
  }
  
  // Check cache hit rate
  if (results.cacheHitRate && results.cacheHitRate < THRESHOLDS.database.cacheHitRate) {
    issues.push({
      type: 'cacheHitRate',
      actual: results.cacheHitRate,
      threshold: THRESHOLDS.database.cacheHitRate,
      severity: 'low',
    });
  }
  
  if (issues.length === 0) {
    log('green', '✅ Database performance is within thresholds');
  } else {
    log('red', '❌ Database performance issues detected:');
    issues.forEach(issue => {
      const color = issue.severity === 'high' ? 'red' : issue.severity === 'medium' ? 'yellow' : 'cyan';
      log(color, `   ${issue.type}: ${issue.actual} (threshold: ${issue.threshold})`);
    });
  }
  
  return issues;
}

function checkContractPerformance(results) {
  log('blue', '🔗 Checking Smart Contract Performance...');
  
  const issues = [];
  
  // Check average gas usage
  if (results.avgGasUsage && results.avgGasUsage > THRESHOLDS.contracts.avgGasUsage) {
    issues.push({
      type: 'avgGasUsage',
      actual: results.avgGasUsage,
      threshold: THRESHOLDS.contracts.avgGasUsage,
      severity: 'high',
    });
  }
  
  // Check maximum gas usage
  if (results.maxGasUsage && results.maxGasUsage > THRESHOLDS.contracts.maxGasUsage) {
    issues.push({
      type: 'maxGasUsage',
      actual: results.maxGasUsage,
      threshold: THRESHOLDS.contracts.maxGasUsage,
      severity: 'high',
    });
  }
  
  // Check average execution time
  if (results.avgExecutionTime && results.avgExecutionTime > THRESHOLDS.contracts.avgExecutionTime) {
    issues.push({
      type: 'avgExecutionTime',
      actual: results.avgExecutionTime,
      threshold: THRESHOLDS.contracts.avgExecutionTime,
      severity: 'medium',
    });
  }
  
  if (issues.length === 0) {
    log('green', '✅ Smart contract performance is within thresholds');
  } else {
    log('red', '❌ Smart contract performance issues detected:');
    issues.forEach(issue => {
      const color = issue.severity === 'high' ? 'red' : 'yellow';
      log(color, `   ${issue.type}: ${issue.actual} (threshold: ${issue.threshold})`);
    });
  }
  
  return issues;
}

function generateReport(allIssues) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: allIssues.length,
      highSeverity: allIssues.filter(i => i.severity === 'high').length,
      mediumSeverity: allIssues.filter(i => i.severity === 'medium').length,
      lowSeverity: allIssues.filter(i => i.severity === 'low').length,
    },
    issues: allIssues,
    thresholds: THRESHOLDS,
  };
  
  // Save report
  const reportPath = 'performance-threshold-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log('cyan', `📄 Report saved to: ${reportPath}`);
  
  return report;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('red', '❌ Please provide the path to performance results file');
    log('yellow', 'Usage: node check-performance-thresholds.js <results-file>');
    process.exit(1);
  }
  
  const resultsPath = args[0];
  
  if (!fs.existsSync(resultsPath)) {
    log('red', `❌ Results file not found: ${resultsPath}`);
    process.exit(1);
  }
  
  try {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    log('blue', '📊 Analyzing performance results...\n');
    
    const allIssues = [];
    
    // Check different performance areas based on available data
    if (results.metrics || results.http_req_duration) {
      allIssues.push(...checkApiPerformance(results));
    }
    
    if (results.lighthouse || results.webVitals || results.bundleSize) {
      allIssues.push(...checkFrontendPerformance(results));
    }
    
    if (results.avgQueryTime || results.indexUsage) {
      allIssues.push(...checkDatabasePerformance(results));
    }
    
    if (results.avgGasUsage || results.maxGasUsage) {
      allIssues.push(...checkContractPerformance(results));
    }
    
    // Generate comprehensive report
    const report = generateReport(allIssues);
    
    // Summary
    log('blue', '\n📈 Summary:');
    log(`Total Issues: ${report.summary.totalIssues}`);
    
    if (report.summary.highSeverity > 0) {
      log('red', `High Severity: ${report.summary.highSeverity}`);
    }
    if (report.summary.mediumSeverity > 0) {
      log('yellow', `Medium Severity: ${report.summary.mediumSeverity}`);
    }
    if (report.summary.lowSeverity > 0) {
      log('cyan', `Low Severity: ${report.summary.lowSeverity}`);
    }
    
    if (report.summary.highSeverity > 0) {
      log('red', '\n❌ Performance thresholds exceeded - action required!');
      process.exit(1);
    } else if (report.summary.mediumSeverity > 0) {
      log('yellow', '\n⚠️ Performance thresholds exceeded - consider optimization');
      process.exit(0);
    } else {
      log('green', '\n✅ All performance thresholds met!');
      process.exit(0);
    }
    
  } catch (error) {
    log('red', `❌ Error parsing results file: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkApiPerformance,
  checkFrontendPerformance,
  checkDatabasePerformance,
  checkContractPerformance,
  THRESHOLDS,
};
