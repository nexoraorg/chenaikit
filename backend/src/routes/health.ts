import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { log } from '../utils/logger';
import { getHealthService } from '../services/healthService';

const router: Router = Router();

// Rate limiter for on-demand check trigger — prevents probe spam
const onDemandRunLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many on-demand health check requests. Try again later.' } },
});

// ---------------------------------------------------------------------------
// Re-export the registerHealthCheck helper for backward-compat with server.ts
// ---------------------------------------------------------------------------

/**
 * @deprecated Use getHealthService().runChecks() directly.
 * Kept for backward compatibility with existing server.ts registrations.
 * The provided check callback is forwarded into HealthService so it still
 * runs as part of every health check cycle.
 */
export function registerHealthCheck(
  name: string,
  check: () => Promise<{ status: 'up' | 'down' | 'degraded'; message?: string }>,
  _critical = false
): void {
  const service = getHealthService();
  // Adapt the legacy callback signature to the CheckResult shape HealthService uses
  (service as any)._legacyChecks = (service as any)._legacyChecks ?? {};
  (service as any)._legacyChecks[name] = check;

  log.info(`registerHealthCheck: "${name}" registered via legacy shim`, { name });
}

// ---------------------------------------------------------------------------
// Helper: wrap async route handlers and forward errors
// ---------------------------------------------------------------------------

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

function asyncRoute(fn: AsyncHandler) {
  return (req: Request, res: Response): void => {
    fn(req, res).catch((err: unknown) => {
      log.error('Health route error', err as Error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'HEALTH_CHECK_ERROR', message: (err as Error).message },
        });
      }
    });
  };
}

// ---------------------------------------------------------------------------
// GET /health
// Full health snapshot — used by monitoring services and CI/CD pipelines.
// Returns 200 (healthy), 207 (degraded), or 503 (unhealthy).
// ---------------------------------------------------------------------------

router.get(
  '/health',
  asyncRoute(async (_req, res) => {
    const service = getHealthService();
    const healthCheck = await service.runChecks();

    res.status(healthCheck.httpStatusCode()).json({
      success: healthCheck.isHealthy() || healthCheck.isDegraded(),
      data: healthCheck.toJSON(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /health/liveness
// Kubernetes liveness probe — only verifies the process is alive.
// Should almost never fail; failure causes k8s to restart the pod.
// ---------------------------------------------------------------------------

router.get('/health/liveness', (_req: Request, res: Response) => {
  const service = getHealthService();
  const result = service.livenessCheck();
  res.status(200).json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// GET /health/readiness
// Kubernetes / load-balancer readiness probe.
// Checks DB and Redis only.  Returns 503 if either is down.
// ---------------------------------------------------------------------------

router.get(
  '/health/readiness',
  asyncRoute(async (_req, res) => {
    const service = getHealthService();
    const result = await service.readinessCheck();
    const statusCode = result.ready ? 200 : 503;

    res.status(statusCode).json({
      success: result.ready,
      data: {
        ready: result.ready,
        checks: result.checks,
      },
    });
  })
);

// ---------------------------------------------------------------------------
// GET /health/history
// Recent health check history.
// Query params:
//   limit  – number of entries to return (default 20, max 100)
// ---------------------------------------------------------------------------

router.get(
  '/health/history',
  asyncRoute(async (req, res) => {
    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = isNaN(rawLimit) ? 20 : Math.max(1, Math.min(rawLimit, 100));

    const service = getHealthService();
    const history = service.getHistory(limit);

    res.status(200).json({
      success: true,
      data: history,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /health/trend
// Health trend analysis over a sliding window of history entries.
// Query params:
//   window – number of history entries to include (default 20, max 100)
// ---------------------------------------------------------------------------

router.get(
  '/health/trend',
  asyncRoute(async (req, res) => {
    const rawWindow = parseInt(req.query.window as string, 10);
    const windowSize = isNaN(rawWindow) ? 20 : Math.max(1, Math.min(rawWindow, 100));

    const service = getHealthService();
    const trend = service.getTrend(windowSize);

    res.status(200).json({
      success: true,
      data: trend,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /health/metrics
// Lightweight dashboard metrics snapshot — no fresh check is triggered.
// ---------------------------------------------------------------------------

router.get('/health/metrics', (_req: Request, res: Response) => {
  const service = getHealthService();
  const metrics = service.getDashboardMetrics();

  res.status(200).json({
    success: true,
    data: metrics,
  });
});

// ---------------------------------------------------------------------------
// GET /health/report
// Full health report with trend, per-check summary, alerts, recommendations.
// Query params:
//   window – number of history entries to include in analysis (default 50)
// ---------------------------------------------------------------------------

router.get(
  '/health/report',
  asyncRoute(async (req, res) => {
    const rawWindow = parseInt(req.query.window as string, 10);
    const windowSize = isNaN(rawWindow) ? 50 : Math.max(1, Math.min(rawWindow, 100));

    const service = getHealthService();
    const report = await service.generateReport(windowSize);

    res.status(200).json({
      success: true,
      data: report,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /health/alerts
// Returns active (unresolved) alerts and the recent alert log.
// Query params:
//   log_limit – max number of historical alerts to return (default 50)
// ---------------------------------------------------------------------------

router.get(
  '/health/alerts',
  asyncRoute(async (req, res) => {
    const rawLimit = parseInt(req.query.log_limit as string, 10);
    const logLimit = isNaN(rawLimit) ? 50 : Math.max(1, Math.min(rawLimit, 200));

    const service = getHealthService();
    const active = service.getActiveAlerts();
    const alertLog = service.getAlertLog(logLimit);

    res.status(200).json({
      success: true,
      data: {
        activeCount: active.length,
        active,
        logCount: alertLog.length,
        log: alertLog,
      },
    });
  })
);

// ---------------------------------------------------------------------------
// POST /health/checks/run
// Trigger an on-demand health check run outside the background interval.
// Useful for CI/CD pipelines and monitoring dashboards.
// ---------------------------------------------------------------------------

router.post(
  '/health/checks/run',
  onDemandRunLimiter,
  asyncRoute(async (_req, res) => {
    const service = getHealthService();
    const healthCheck = await service.runChecks();

    res.status(healthCheck.httpStatusCode()).json({
      success: healthCheck.isHealthy() || healthCheck.isDegraded(),
      data: healthCheck.toJSON(),
    });
  })
);

export default router;
