import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { PerformanceMetrics } from '../hooks/usePerformance';

interface PerformanceContextValue {
  metrics: PerformanceMetrics | null;
  setMetrics: (metrics: PerformanceMetrics) => void;
  isPerformanceMonitoringEnabled: boolean;
  setPerformanceMonitoringEnabled: (enabled: boolean) => void;
}

const PerformanceContext = createContext<PerformanceContextValue | undefined>(undefined);

export const usePerformanceContext = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformanceContext must be used within a PerformanceProvider');
  }
  return context;
};

interface PerformanceProviderProps {
  children: ReactNode;
}

export const PerformanceProvider: React.FC<PerformanceProviderProps> = ({ children }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isPerformanceMonitoringEnabled, setPerformanceMonitoringEnabled] = useState(true);

  const handleSetMetrics = useCallback((newMetrics: PerformanceMetrics) => {
    setMetrics(newMetrics);
  }, []);

  const handleSetPerformanceMonitoringEnabled = useCallback((enabled: boolean) => {
    setPerformanceMonitoringEnabled(enabled);
  }, []);

  return (
    <PerformanceContext.Provider
      value={{
        metrics,
        setMetrics: handleSetMetrics,
        isPerformanceMonitoringEnabled,
        setPerformanceMonitoringEnabled: handleSetPerformanceMonitoringEnabled,
      }}
    >
      {children}
    </PerformanceContext.Provider>
  );
};

export default PerformanceProvider;