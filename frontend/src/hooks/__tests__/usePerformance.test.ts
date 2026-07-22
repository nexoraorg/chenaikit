import { renderHook } from '@testing-library/react';
import { usePerformance, useRenderPerformance, useApiPerformance, useDebounce, useThrottle } from '../usePerformance';

describe('usePerformance hook', () => {
  it('should return initial metrics with null values', () => {
    const { result } = renderHook(() => usePerformance());
    
    expect(result.current.metrics).toEqual({
      fcp: null,
      lcp: null,
      cls: null,
      fid: null,
      ttfb: null,
      domContentLoaded: null,
      loadTime: null,
    });
  });

  it('should return correct status for good metrics', () => {
    const { result } = renderHook(() => usePerformance());
    
    expect(result.current.getMetricStatus('fcp', 1000)).toBe('good');
    expect(result.current.getMetricStatus('lcp', 2000)).toBe('good');
    expect(result.current.getMetricStatus('cls', 0.05)).toBe('good');
  });

  it('should return correct status for poor metrics', () => {
    const { result } = renderHook(() => usePerformance());
    
    expect(result.current.getMetricStatus('fcp', 3000)).toBe('poor');
    expect(result.current.getMetricStatus('lcp', 4000)).toBe('poor');
    expect(result.current.getMetricStatus('cls', 0.2)).toBe('poor');
  });
});

describe('useRenderPerformance hook', () => {
  it('should return initial render count', () => {
    const { result } = renderHook(() => useRenderPerformance('TestComponent'));
    
    expect(result.current.renderCount).toBe(0);
  });
});

describe('useApiPerformance hook', () => {
  it('should return measureRequest function', () => {
    const { result } = renderHook(() => useApiPerformance());
    
    expect(typeof result.current.measureRequest).toBe('function');
  });
});

describe('useDebounce hook', () => {
  it('should return initial value', () => {
    const { result } = renderHook(() => useDebounce('test', 500));
    
    expect(result.current).toBe('test');
  });
});

describe('useThrottle hook', () => {
  it('should return initial value', () => {
    const { result } = renderHook(() => useThrottle('test', 500));
    
    expect(result.current).toBe('test');
  });
});