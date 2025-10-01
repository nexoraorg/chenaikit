import promClient from 'prom-client';
import { monitoringConfig } from '../config/monitoring';
import { MetricLabels, CustomMetric, PerformanceMetric } from '../types/monitoring';
import { log } from '../utils/logger';

class MetricsService {
  private registry: promClient.Registry;
  private metrics: Map<string, any>;
  private performanceBuffer: PerformanceMetric[];
  private readonly bufferSize = 1000;

  // Standard metrics
  public httpRequestDuration!: promClient.Histogram;
  public httpRequestTotal!: promClient.Counter;
  public httpRequestErrors!: promClient.Counter;
  public activeConnections!: promClient.Gauge;
  public dbQueryDuration!: promClient.Histogram;
  public cacheHitRate!: promClient.Counter;
  public businessMetrics!: promClient.Counter;

  constructor() {
    this.registry = new promClient.Registry();
    this.metrics = new Map();
    this.performanceBuffer = [];

    // Set default labels
    if (monitoringConfig.metrics.defaultLabels) {
      this.registry.setDefaultLabels(monitoringConfig.metrics.defaultLabels);
    }

    // Initialize standard metrics
    this.initializeStandardMetrics();

    // Collect default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({
      register: this.registry,
      prefix: `${monitoringConfig.metrics.prefix}_` ,
    });

    log.info('Metrics service initialized', {
      prefix: monitoringConfig.metrics.prefix,
      port: monitoringConfig.metrics.port,
    });
  }

  private initializeStandardMetrics(): void {
    const prefix = monitoringConfig.metrics.prefix;

    // HTTP request duration histogram
    this.httpRequestDuration = new promClient.Histogram({
      name: `${prefix}_http_request_duration_ms` ,
      help: 'Duration of HTTP requests in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      registers: [this.registry],
    });

    // HTTP request counter
    this.httpRequestTotal = new promClient.Counter({
      name: `${prefix}_http_requests_total` ,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP error counter
    this.httpRequestErrors = new promClient.Counter({
      name: `${prefix}_http_request_errors_total` ,
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'status_code', 'error_type'],
      registers: [this.registry],
    });

    // Active connections gauge
    this.activeConnections = new promClient.Gauge({
      name: `${prefix}_active_connections` ,
      help: 'Number of active connections',
      registers: [this.registry],
    });

    // Database query duration
    this.dbQueryDuration = new promClient.Histogram({
      name: `${prefix}_db_query_duration_ms` ,
      help: 'Duration of database queries in milliseconds',
      labelNames: ['operation', 'collection', 'status'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    // Cache hit rate
    this.cacheHitRate = new promClient.Counter({
      name: `${prefix}_cache_operations_total` ,
      help: 'Total cache operations',
      labelNames: ['operation', 'status'],
      registers: [this.registry],
    });

    // Business metrics counter
    this.businessMetrics = new promClient.Counter({
      name: `${prefix}_business_events_total` ,
      help: 'Business-specific events',
      labelNames: ['event_type', 'status'],
      registers: [this.registry],
    });
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString(),
    };

    this.httpRequestDuration.observe(labels, duration);
    this.httpRequestTotal.inc(labels);

    if (statusCode >= 400) {
      this.httpRequestErrors.inc({
        ...labels,
        error_type: statusCode >= 500 ? 'server_error' : 'client_error',
      });
    }
  }

  /**
   * Record database query metrics
   */
  recordDbQuery(
    operation: string,
    collection: string,
    duration: number,
    success: boolean
  ): void {
    this.dbQueryDuration.observe(
      {
        operation,
        collection,
        status: success ? 'success' : 'error',
      },
      duration
    );
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete'): void {
    this.cacheHitRate.inc({
      operation,
      status: operation === 'hit' ? 'success' : operation === 'miss' ? 'failure' : 'success',
    });
  }

  /**
   * Record business event
   */
  recordBusinessEvent(eventType: string, status: 'success' | 'failure' = 'success'): void {
    this.businessMetrics.inc({ event_type: eventType, status });
  }

  /**
   * Increment active connections
   */
  incrementConnections(): void {
    this.activeConnections.inc();
  }

  /**
   * Decrement active connections
   */
  decrementConnections(): void {
    this.activeConnections.dec();
  }

  /**
   * Create custom counter
   */
  createCounter(config: CustomMetric): promClient.Counter {
    const counter = new promClient.Counter({
      name: `${monitoringConfig.metrics.prefix}_${config.name}` ,
      help: config.help,
      labelNames: config.labels || [],
      registers: [this.registry],
    });

    this.metrics.set(config.name, counter);
    return counter;
  }

  /**
   * Create custom gauge
   */
  createGauge(config: CustomMetric): promClient.Gauge {
    const gauge = new promClient.Gauge({
      name: `${monitoringConfig.metrics.prefix}_${config.name}` ,
      help: config.help,
      labelNames: config.labels || [],
      registers: [this.registry],
    });

    this.metrics.set(config.name, gauge);
    return gauge;
  }

  /**
   * Create custom histogram
   */
  createHistogram(config: CustomMetric, buckets?: number[]): promClient.Histogram {
    const histogram = new promClient.Histogram({
      name: `${monitoringConfig.metrics.prefix}_${config.name}` ,
      help: config.help,
      labelNames: config.labels || [],
      buckets: buckets || [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.metrics.set(config.name, histogram);
    return histogram;
  }

  /**
   * Get custom metric
   */
  getMetric(name: string): any {
    return this.metrics.get(name);
  }

  /**
   * Record performance metric
   */
  recordPerformance(metric: PerformanceMetric): void {
    this.performanceBuffer.push(metric);

    // Keep buffer size limited
    if (this.performanceBuffer.length > this.bufferSize) {
      this.performanceBuffer.shift();
    }

    // Log slow operations
    if (metric.duration > 1000) {
      log.warn('Slow operation detected', {
        operation: metric.operation,
        duration: metric.duration,
        ...metric.metadata,
      });
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(operation?: string): any {
    const filtered = operation
      ? this.performanceBuffer.filter(m => m.operation === operation)
      : this.performanceBuffer;

    if (filtered.length === 0) {
      return null;
    }

    const durations = filtered.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);

    return {
      operation,
      count: filtered.length,
      avg: sum / filtered.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      successRate: (filtered.filter(m => m.success).length / filtered.length) * 100,
    };
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<any[]> {
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.registry.clear();
    this.metrics.clear();
    this.performanceBuffer = [];
    this.initializeStandardMetrics();
  }
}

// Export singleton instance
export const metricsService = new MetricsService();

// Middleware to track HTTP metrics
export const metricsMiddleware = (req: any, res: any, next: any): void => {
  const startTime = Date.now();

  metricsService.incrementConnections();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const route = req.route?.path || req.path || 'unknown';

    metricsService.recordHttpRequest(
      req.method,
      route,
      res.statusCode,
      duration
    );

    metricsService.decrementConnections();
  });

  next();
};
