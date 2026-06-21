// Types for monitoring and health checks

export interface LogContext {
  requestId?: string;
  userId?: string;
  service?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      message?: string;
      responseTime?: number;
      details?: any;
    };
  };
}

export interface MetricLabels {
  [key: string]: string | number;
}

export interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels?: string[];
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface ErrorContext {
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

export interface MonitoringConfig {
  logging: {
    level: string;
    format: 'json' | 'simple';
    console: boolean;
    file: boolean;
    filePath?: string;
    maxFiles?: number;
    maxSize?: string;
  };
  metrics: {
    enabled: boolean;
    prefix: string;
    port: number;
    defaultLabels?: MetricLabels;
  };
  tracing: {
    enabled: boolean;
    serviceName: string;
    endpoint?: string;
    sampleRate: number;
  };
  healthCheck: {
    enabled: boolean;
    timeout: number;
    interval: number;
  };
  alerting: {
    enabled: boolean;
    errorThreshold: number;
    latencyThreshold: number;
    webhookUrl?: string;
  };
}

export interface AlertPayload {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
