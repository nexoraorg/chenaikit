import { useEffect, useRef, useCallback, useMemo, useState } from 'react';

// Performance metrics interface
export interface PerformanceMetrics {
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  fid: number | null;
  ttfb: number | null;
  domContentLoaded: number | null;
  loadTime: number | null;
}

// Web Vitals thresholds (from performance-guidelines.md)
const THRESHOLDS = {
  fcp: 1500, // 1.5s
  lcp: 2500, // 2.5s
  cls: 0.1,
  fid: 100, // 100ms
  ttfb: 200, // 200ms
} as const;

// Performance observer callback type
type PerformanceCallback = (metrics: PerformanceMetrics) => void;

// Custom hook for measuring and monitoring performance
export const usePerformance = (
  onMetricsChange?: PerformanceCallback,
  enabled: boolean = true
) => {
  const metricsRef = useRef<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    cls: null,
    fid: null,
    ttfb: null,
    domContentLoaded: null,
    loadTime: null,
  });

  const getMetricStatus = useCallback((metric: keyof typeof THRESHOLDS, value: number | null) => {
    if (value === null) return 'unknown';
    const threshold = THRESHOLDS[metric];
    const ratio = value / threshold;
    if (ratio <= 1) return 'good';
    if (ratio <= 1.25) return 'needs-improvement';
    return 'poor';
  }, []);

  const reportMetrics = useCallback(() => {
    if (onMetricsChange) {
      onMetricsChange(metricsRef.current);
    }
  }, [onMetricsChange]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Measure navigation timing
    const measureNavigationTiming = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        metricsRef.current = {
          ...metricsRef.current,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          ttfb: navigation.responseStart - navigation.fetchStart,
        };
      }
    };

    // Measure Core Web Vitals
    const measureWebVitals = () => {
      // FCP (First Contentful Paint)
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcp = entries[entries.length - 1];
        if (fcp) {
          metricsRef.current.fcp = fcp.startTime;
          reportMetrics();
        }
      });
      fcpObserver.observe({ entryTypes: ['paint'] });

      // LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries[entries.length - 1];
        if (lcp) {
          metricsRef.current.lcp = lcp.startTime;
          reportMetrics();
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // CLS (Cumulative Layout Shift)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEntryList) {
          const layoutShift = entry as any;
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        }
        metricsRef.current.cls = clsValue;
        reportMetrics();
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

      // FID (First Input Delay)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fid = entries[entries.length - 1] as any;
        if (fid) {
          metricsRef.current.fid = fid.processingStart - fid.startTime;
          reportMetrics();
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      return () => {
        fcpObserver.disconnect();
        lcpObserver.disconnect();
        clsObserver.disconnect();
        fidObserver.disconnect();
      };
    };

    // Initial measurement
    measureNavigationTiming();

    // Set up observers
    const cleanup = measureWebVitals();

    // Report initial metrics
    reportMetrics();

    return cleanup;
  }, [enabled, reportMetrics]);

  return {
    metrics: metricsRef.current,
    getMetricStatus,
  };
};

// Hook for measuring component render performance
export const useRenderPerformance = (componentName: string) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = performance.now();
    const renderTime = now - lastRenderTime.current;
    lastRenderTime.current = now;

    // eslint-disable-next-line no-console
    console.debug(`[${componentName}] Render #${renderCount.current} took ${renderTime.toFixed(2)}ms`);
  });

  return {
    renderCount: renderCount.current,
  };
};

// Hook for measuring API call performance
export const useApiPerformance = () => {
  const measureRequest = useCallback(async <T,>(
    request: () => Promise<T>,
    endpoint: string
  ): Promise<T> => {
    const start = performance.now();
    try {
      const result = await request();
      const duration = performance.now() - start;
      
      // eslint-disable-next-line no-console
      console.debug(`[API] ${endpoint} took ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`[API] ${endpoint} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }, []);

  return { measureRequest };
};

// Memoization utilities for performance
export const useDeepMemo = <T,>(factory: () => T, deps: unknown[]): T => {
  return useMemo(factory, deps);
};

// Debounce hook for performance optimization
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debounced;
};

// Throttle hook for performance optimization
export const useThrottle = <T,>(value: T, delay: number): T => {
  const [throttled, setThrottled] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setThrottled(value);
    }, delay, true);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return throttled;
};

export default usePerformance;