/**
 * Performance Testing Utilities for Frontend
 * 
 * This module provides utilities for measuring and testing frontend performance
 * including Core Web Vitals, bundle size analysis, and render performance.
 */

// Performance thresholds from performance-guidelines.md
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  fcp: 1500, // 1.5s
  lcp: 2500, // 2.5s
  cls: 0.1,
  fid: 100, // 100ms
  ttfb: 200, // 200ms
  
  // Bundle size
  maxBundleSize: 1024 * 1024, // 1MB
  
  // API response times
  apiResponseTime: 200, // 200ms
  apiP95ResponseTime: 500, // 500ms
} as const;

// Performance test result interface
export interface PerformanceTestResult {
  name: string;
  value: number;
  threshold: number;
  status: 'pass' | 'fail' | 'warning';
  unit: string;
}

// Run performance tests and return results
export const runPerformanceTests = async (): Promise<PerformanceTestResult[]> => {
  const results: PerformanceTestResult[] = [];

  // Test Core Web Vitals
  if (typeof window !== 'undefined' && 'performance' in window) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      // TTFB
      const ttfb = navigation.responseStart - navigation.fetchStart;
      results.push({
        name: 'Time to First Byte (TTFB)',
        value: ttfb,
        threshold: PERFORMANCE_THRESHOLDS.ttfb,
        status: ttfb <= PERFORMANCE_THRESHOLDS.ttfb ? 'pass' : 'fail',
        unit: 'ms',
      });

      // DOM Content Loaded
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
      results.push({
        name: 'DOM Content Loaded',
        value: domContentLoaded,
        threshold: 1000,
        status: domContentLoaded <= 1000 ? 'pass' : 'warning',
        unit: 'ms',
      });
    }
  }

  return results;
};

// Check if performance meets thresholds
export const checkPerformanceThreshold = (
  value: number,
  threshold: number,
  inverse: boolean = false
): 'pass' | 'fail' | 'warning' => {
  const ratio = value / threshold;
  if (inverse) {
    if (ratio >= 1) return 'pass';
    if (ratio >= 0.8) return 'warning';
    return 'fail';
  }
  if (ratio <= 1) return 'pass';
  if (ratio <= 1.25) return 'warning';
  return 'fail';
};

// Get performance score based on results
export const getPerformanceScore = (results: PerformanceTestResult[]): number => {
  if (results.length === 0) return 0;
  
  const totalScore = results.reduce((sum, result) => {
    if (result.status === 'pass') return sum + 100;
    if (result.status === 'warning') return sum + 50;
    return sum;
  }, 0);
  
  return Math.round(totalScore / results.length);
};

// Performance budget check
export const checkPerformanceBudget = (
  bundleSize: number,
  metrics: Partial<Record<keyof typeof PERFORMANCE_THRESHOLDS, number>>
): { passed: boolean; violations: string[] } => {
  const violations: string[] = [];

  if (bundleSize > PERFORMANCE_THRESHOLDS.maxBundleSize) {
    violations.push(`Bundle size ${bundleSize} exceeds limit ${PERFORMANCE_THRESHOLDS.maxBundleSize}`);
  }

  Object.entries(metrics).forEach(([key, value]) => {
    if (value !== undefined && key in PERFORMANCE_THRESHOLDS) {
      const threshold = PERFORMANCE_THRESHOLDS[key as keyof typeof PERFORMANCE_THRESHOLDS];
      if (value > threshold) {
        violations.push(`${key} value ${value} exceeds threshold ${threshold}`);
      }
    }
  });

  return {
    passed: violations.length === 0,
    violations,
  };
};

export default {
  runPerformanceTests,
  checkPerformanceThreshold,
  getPerformanceScore,
  checkPerformanceBudget,
  PERFORMANCE_THRESHOLDS,
};