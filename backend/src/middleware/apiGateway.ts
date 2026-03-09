import { Request, Response, NextFunction } from 'express';
import { ApiKey, ApiTier } from '../models/ApiKey';
import { ApiKeyService } from '../services/apiKeyService';
import { UsageTrackingService } from '../services/usageTrackingService';
import { AdvancedRateLimiter } from './advancedRateLimiter';
import { log } from '../utils/logger';

export interface TransformOptions {
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBodyTransform?: (body: any) => any;
  responseBodyTransform?: (body: any) => any;
  pathRewrite?: Record<string, string>;
  queryTransform?: (query: any) => any;
}

export interface CircuitBreakerOptions {
  threshold: number; // Number of failures before opening
  timeout: number; // Time in milliseconds to wait before trying again
  resetTimeout: number; // Time in milliseconds before moving to half-open state
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === CircuitBreakerState.OPEN) {
      if (now < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.failures = 0;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.threshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
  }
}

export class ApiGateway {
  private rateLimiter: AdvancedRateLimiter;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(
    private apiKeyService: ApiKeyService,
    private usageTrackingService: UsageTrackingService,
    rateLimiter?: AdvancedRateLimiter
  ) {
    this.rateLimiter = rateLimiter || new AdvancedRateLimiter();
  }

  /**
   * API key authentication middleware
   */
  authenticateApiKey() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const apiKeyHeader = req.headers['x-api-key'] as string;
        const apiKeyQuery = req.query.api_key as string;
        const apiKey = apiKeyHeader || apiKeyQuery;

        if (!apiKey) {
          res.status(401).json({
            success: false,
            error: {
              code: 'API_KEY_REQUIRED',
              message: 'API key is required',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        const keyData = await this.apiKeyService.validateApiKey(apiKey);
        if (!keyData) {
          res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_API_KEY',
              message: 'Invalid or expired API key',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        // Check IP restrictions
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        if (!keyData.isIpAllowed(clientIp)) {
          res.status(403).json({
            success: false,
            error: {
              code: 'IP_NOT_ALLOWED',
              message: 'IP address not allowed for this API key',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        // Check path restrictions
        if (!keyData.isPathAllowed(req.path)) {
          res.status(403).json({
            success: false,
            error: {
              code: 'PATH_NOT_ALLOWED',
              message: 'Path not allowed for this API key',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        // Check quota
        if (keyData.hasQuotaExceeded()) {
          res.status(429).json({
            success: false,
            error: {
              code: 'QUOTA_EXCEEDED',
              message: 'API quota exceeded',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        // Attach API key to request
        (req as any).apiKey = keyData;
        next();
      } catch (error: any) {
        log.error('API key authentication error', error as Error);
        res.status(500).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_ERROR',
            message: 'Authentication failed',
            timestamp: new Date().toISOString(),
          },
        });
      }
    };
  }

  /**
   * Request transformation middleware
   */
  transformRequest(options: TransformOptions) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Transform headers
        if (options.requestHeaders) {
          Object.assign(req.headers, options.requestHeaders);
        }

        // Transform query parameters
        if (options.queryTransform) {
          req.query = options.queryTransform(req.query);
        }

        // Transform request body
        if (options.requestBodyTransform && req.body) {
          req.body = options.requestBodyTransform(req.body);
        }

        // Path rewriting
        if (options.pathRewrite) {
          for (const [pattern, replacement] of Object.entries(options.pathRewrite)) {
            const regex = new RegExp(pattern);
            if (regex.test(req.path)) {
              const newPath = req.path.replace(regex, replacement);
              req.url = newPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
              break;
            }
          }
        }

        next();
      } catch (error: any) {
        log.error('Request transformation error', error as Error);
        res.status(400).json({
          success: false,
          error: {
            code: 'TRANSFORMATION_ERROR',
            message: 'Request transformation failed',
            timestamp: new Date().toISOString(),
          },
        });
      }
    };
  }

  /**
   * Response transformation middleware
   */
  transformResponse(options: TransformOptions) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (options.responseHeaders) {
        Object.entries(options.responseHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }

      if (options.responseBodyTransform) {
        const originalSend = res.send;
        res.send = function (data: any): Response {
          try {
            if (typeof data === 'string') {
              data = JSON.parse(data);
            }
            data = options.responseBodyTransform!(data);
            return originalSend.call(this, JSON.stringify(data));
          } catch (error) {
            return originalSend.call(this, data);
          }
        };
      }

      next();
    };
  }

  /**
   * Usage tracking middleware
   */
  trackUsage() {
    const self = this;
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      const apiKey = (req as any).apiKey as ApiKey;

      // Override res.send to track response
      const originalSend = res.send;
      res.send = function (data: any): Response {
        const responseTime = Date.now() - startTime;
        const responseSize = JSON.stringify(data).length || 0;

        // Track usage asynchronously
        if (apiKey) {
          setImmediate(async () => {
            try {
              await Promise.all([
                self.apiKeyService.incrementUsage(apiKey.id),
                self.usageTrackingService.recordUsage(
                  self.usageTrackingService.extractUsageFromRequest(
                    req,
                    apiKey.id,
                    responseTime,
                    res.statusCode,
                    responseSize
                  )
                ),
              ]);
            } catch (error: any) {
              log.error('Usage tracking error', error as Error);
            }
          });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Circuit breaker middleware
   */
  circuitBreaker(serviceName: string, options: CircuitBreakerOptions) {
    // Get or create circuit breaker for this service
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(options));
    }

    const breaker = this.circuitBreakers.get(serviceName)!;

    return (req: Request, res: Response, next: NextFunction): void => {
      const state = breaker.getState();
      
      // Add circuit breaker status headers
      res.set('X-Circuit-Breaker-State', state);
      res.set('X-Circuit-Breaker-Failures', breaker.getFailures().toString());

      if (state === CircuitBreakerState.OPEN) {
        res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service temporarily unavailable due to high error rate',
            circuitBreakerState: state,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Wrap the next function in circuit breaker
      breaker.execute(async () => {
        return new Promise<void>((resolve, reject) => {
          const originalNext = next;
          next = (error?: any) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          };
          originalNext();
        });
      }).catch((error) => {
        log.error('Circuit breaker caught error', {
          serviceName,
          state: breaker.getState(),
          error,
        });

        if (breaker.getState() === CircuitBreakerState.OPEN) {
          res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Service temporarily unavailable due to high error rate',
              circuitBreakerState: breaker.getState(),
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          next(error);
        }
      });
    };
  }

  /**
   * Combined API gateway middleware
   */
  gateway(options: {
    enableAuth?: boolean;
    enableRateLimit?: boolean;
    enableUsageTracking?: boolean;
    transform?: TransformOptions;
    circuitBreaker?: { serviceName: string; options: CircuitBreakerOptions };
  } = {}) {
    const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

    // Add authentication
    if (options.enableAuth !== false) {
      middlewares.push(this.authenticateApiKey());
    }

    // Add rate limiting
    if (options.enableRateLimit !== false) {
      middlewares.push(this.rateLimiter.middleware());
    }

    // Add request transformation
    if (options.transform) {
      middlewares.push(this.transformRequest(options.transform));
    }

    // Add circuit breaker
    if (options.circuitBreaker) {
      middlewares.push(this.circuitBreaker(options.circuitBreaker.serviceName, options.circuitBreaker.options));
    }

    // Add response transformation
    if (options.transform) {
      middlewares.push(this.transformResponse(options.transform));
    }

    // Add usage tracking
    if (options.enableUsageTracking !== false) {
      middlewares.push(this.trackUsage());
    }

    return middlewares;
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Record<string, { state: string; failures: number }> {
    const status: Record<string, { state: string; failures: number }> = {};
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      status[name] = {
        state: breaker.getState(),
        failures: breaker.getFailures(),
      };
    }

    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
    log.info('All circuit breakers reset');
  }

  /**
   * Health check for the API gateway
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    rateLimiter: boolean;
    circuitBreakers: Record<string, string>;
    timestamp: string;
  }> {
    const circuitBreakerStatus = this.getCircuitBreakerStatus();
    const openBreakers = Object.values(circuitBreakerStatus).filter(cb => cb.state === 'OPEN');
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (openBreakers.length > 0) {
      status = openBreakers.length > 2 ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      rateLimiter: true, // Could implement actual health check
      circuitBreakers: Object.fromEntries(
        Object.entries(circuitBreakerStatus).map(([name, status]) => [name, status.state])
      ),
      timestamp: new Date().toISOString(),
    };
  }
}
