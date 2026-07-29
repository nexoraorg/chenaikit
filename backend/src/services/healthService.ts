import http from 'http';
import https from 'https';
import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { createRedisClient } from '../config/redis';
import { getHealthConfig, HealthCheckConfig } from '../config/health';
import {
  HealthCheck,
  HealthSnapshot,
  HealthHistoryEntry,
  HealthHistory,
  HealthTrend,
  HealthReport,
  HealthAlert,
  CheckResult,
  CheckStatus,
  MemorySnapshot,
  CpuSnapshot,
  DiskSnapshot,
} from '../models/HealthCheck';
import {
  generateId,
  nowIso,
  captureMemorySnapshot,
  captureCpuSnapshot,
  captureDiskSnapshot,
  memoryCheckStatus,
  cpuCheckStatus,
  diskCheckStatus,
  responseTimeStatus,
  deriveOverallStatus,
  calculateHealthScore,
  calculateHealthTrend,
  generateRecommendations,
  formatUptime,
} from '../utils/healthUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthServiceOptions {
  prisma?: PrismaClient;
  config?: HealthCheckConfig;
}

// ---------------------------------------------------------------------------
// HealthService
// ---------------------------------------------------------------------------

export class HealthService {
  private readonly config: HealthCheckConfig;
  private readonly prisma: PrismaClient | null;

  /** Circular in-memory history buffer */
  private readonly history: HealthHistoryEntry[] = [];

  /** Active unresolved alerts keyed by checkName */
  private readonly activeAlerts = new Map<string, HealthAlert>();

  /** All alerts including resolved ones (capped at 200) */
  private readonly alertLog: HealthAlert[] = [];

  /** Timestamp of the last alert dispatch per check (for cooldown) */
  private readonly lastAlertDispatch = new Map<string, number>();

  /** Interval handle for the background monitoring loop */
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;

  /** Guard flag to prevent overlapping check cycles */
  private monitoringRunInFlight = false;

  constructor(options: HealthServiceOptions = {}) {
    this.config = options.config ?? getHealthConfig();
    this.prisma = options.prisma ?? null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Start the background health-monitoring loop. */
  startMonitoring(): void {
    if (!this.config.enabled) return;
    if (this.monitoringInterval) return; // already running

    log.info('HealthService: starting background monitoring', {
      intervalMs: this.config.intervalMs,
    });

    // Run once immediately, then on the interval
    void this.runMonitoringCycle('initial');

    this.monitoringInterval = setInterval(() => {
      void this.runMonitoringCycle('periodic');
    }, this.config.intervalMs);

    // Do not keep the process alive solely for this interval
    if (this.monitoringInterval.unref) {
      this.monitoringInterval.unref();
    }
  }

  /** Serialized wrapper — skips the cycle if the previous one is still running. */
  private async runMonitoringCycle(label: string): Promise<void> {
    if (this.monitoringRunInFlight) {
      log.warn(`HealthService: skipping ${label} check — previous cycle still running`);
      return;
    }
    this.monitoringRunInFlight = true;
    try {
      await this.runChecks();
    } catch (err) {
      log.error(`HealthService: ${label} check failed`, err as Error);
    } finally {
      this.monitoringRunInFlight = false;
    }
  }

  /** Stop the background monitoring loop. */
  stopMonitoring(): void {    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      log.info('HealthService: monitoring stopped');
    }
  }

  // -------------------------------------------------------------------------
  // Core check runner
  // -------------------------------------------------------------------------

  /**
   * Run all configured health checks and return a HealthCheck instance.
   * Also persists the result to history and dispatches any alerts.
   */
  async runChecks(): Promise<HealthCheck> {
    const startedAt = Date.now();
    const checks: HealthSnapshot['checks'] = {};
    const checkStatuses: Record<string, CheckStatus> = {};

    // ---- Database --------------------------------------------------------
    if (this.config.checks.database) {
      const result = await this.checkDatabase();
      checks.database = result;
      checkStatuses.database = result.status;
    }

    // ---- Redis -----------------------------------------------------------
    if (this.config.checks.redis) {
      const result = await this.checkRedis();
      checks.redis = result;
      checkStatuses.redis = result.status;
    }

    // ---- Memory ----------------------------------------------------------
    if (this.config.checks.memory) {
      const { result, snapshot } = this.checkMemory();
      checks.memory = { ...result, snapshot };
      checkStatuses.memory = result.status;
    }

    // ---- CPU -------------------------------------------------------------
    if (this.config.checks.cpu) {
      const { result, snapshot } = this.checkCpu();
      checks.cpu = { ...result, snapshot };
      checkStatuses.cpu = result.status;
    }

    // ---- Disk ------------------------------------------------------------
    if (this.config.checks.disk) {
      const { result, snapshot } = this.checkDisk();
      checks.disk = { ...result, snapshot };
      checkStatuses.disk = result.status;
    }

    // ---- External services -----------------------------------------------
    if (this.config.checks.externalServices) {
      for (const svc of this.config.externalServices) {
        const result = await this.checkExternalService(svc.name, svc.url, svc.timeoutMs, svc.expectedStatus);
        checks[svc.name] = result;
        checkStatuses[svc.name] = result.status;
      }
    }

    // ---- Legacy registered callbacks ------------------------------------
    const legacyChecks: Record<string, () => Promise<{ status: 'up' | 'down' | 'degraded'; message?: string }>> =
      (this as any)._legacyChecks ?? {};
    for (const [name, fn] of Object.entries(legacyChecks)) {
      const start = Date.now();
      const checkedAt = nowIso();
      try {
        const raw = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Legacy check timed out')), this.config.timeoutMs)
          ),
        ]);
        const result = {
          status: raw.status,
          responseTimeMs: Date.now() - start,
          message: raw.message,
          checkedAt,
        };
        checks[name] = result;
        checkStatuses[name] = result.status;
      } catch (err) {
        checks[name] = { status: 'down', responseTimeMs: Date.now() - start, message: (err as Error).message, checkedAt };
        checkStatuses[name] = 'down';
      }
    }

    // ---- Aggregate -------------------------------------------------------
    const overallStatus = deriveOverallStatus(checkStatuses);
    const scoreBreakdown = calculateHealthScore(checkStatuses);

    const snapshot: HealthSnapshot = {
      id: generateId(),
      status: overallStatus,
      score: scoreBreakdown.total,
      timestamp: nowIso(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks,
      metadata: {
        scoreBreakdown: scoreBreakdown.components,
        uptimeFormatted: formatUptime(Math.floor(process.uptime())),
        nodeVersion: process.version,
        pid: process.pid,
      },
    };

    const healthCheck = HealthCheck.fromSnapshot(snapshot);
    const durationMs = Date.now() - startedAt;

    // Persist to history
    this.addToHistory(healthCheck.toHistoryEntry(durationMs));

    // Fire alerts if configured
    if (this.config.alerting.enabled) {
      await this.processAlerts(healthCheck, checkStatuses);
    }

    log.info('HealthService: checks complete', {
      status: overallStatus,
      score: scoreBreakdown.total,
      durationMs,
    });

    return healthCheck;
  }

  // -------------------------------------------------------------------------
  // Individual check implementations
  // -------------------------------------------------------------------------

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    const checkedAt = nowIso();

    if (!this.prisma) {
      return {
        status: 'degraded',
        responseTimeMs: 0,
        message: 'No Prisma client provided to HealthService',
        checkedAt,
      };
    }

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database check timed out')), this.config.timeoutMs)
        ),
      ]);

      const responseTimeMs = Date.now() - start;
      const status = responseTimeStatus(responseTimeMs, this.config.thresholds);

      return {
        status,
        responseTimeMs,
        message: status === 'up' ? 'Connected' : 'Responding slowly',
        checkedAt,
      };
    } catch (err) {
      const responseTimeMs = Date.now() - start;
      log.warn('HealthService: database check failed', { errorMessage: (err as Error).message });
      return {
        status: 'down',
        responseTimeMs,
        message: (err as Error).message,
        checkedAt,
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    const checkedAt = nowIso();

    try {
      const client = createRedisClient();

      await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis check timed out')), this.config.timeoutMs)
        ),
      ]);

      const responseTimeMs = Date.now() - start;
      const status = responseTimeStatus(responseTimeMs, this.config.thresholds);

      return {
        status,
        responseTimeMs,
        message: status === 'up' ? 'PONG' : 'Responding slowly',
        checkedAt,
      };
    } catch (err) {
      const responseTimeMs = Date.now() - start;
      log.warn('HealthService: Redis check failed', { errorMessage: (err as Error).message });
      return {
        status: 'down',
        responseTimeMs,
        message: (err as Error).message,
        checkedAt,
      };
    }
  }

  private checkMemory(): { result: CheckResult; snapshot: MemorySnapshot } {
    const snapshot = captureMemorySnapshot();
    const status = memoryCheckStatus(snapshot, this.config.thresholds);

    return {
      result: {
        status,
        responseTimeMs: 0,
        message:
          status === 'up'
            ? `Heap usage ${snapshot.usagePercent}%`
            : `High heap usage: ${snapshot.usagePercent}%`,
        checkedAt: nowIso(),
        details: {
          heapUsedMb: snapshot.heapUsedMb,
          heapTotalMb: snapshot.heapTotalMb,
          rssMb: snapshot.rssMb,
        },
      },
      snapshot,
    };
  }

  private checkCpu(): { result: CheckResult; snapshot: CpuSnapshot } {
    const snapshot = captureCpuSnapshot();
    const status = cpuCheckStatus(snapshot, this.config.thresholds);

    return {
      result: {
        status,
        responseTimeMs: 0,
        message:
          status === 'up'
            ? `Load avg 1m: ${snapshot.loadAvg1m}`
            : `High load avg 1m: ${snapshot.loadAvg1m}`,
        checkedAt: nowIso(),
        details: {
          loadAvg1m: snapshot.loadAvg1m,
          loadAvg5m: snapshot.loadAvg5m,
          loadAvg15m: snapshot.loadAvg15m,
          usagePercent: snapshot.usagePercent,
        },
      },
      snapshot,
    };
  }

  private checkDisk(): { result: CheckResult; snapshot: DiskSnapshot } {
    const snapshot = captureDiskSnapshot();
    const status = diskCheckStatus(snapshot, this.config.thresholds);

    return {
      result: {
        status,
        responseTimeMs: 0,
        message:
          status === 'up'
            ? `Disk usage ${snapshot.usagePercent}%`
            : `High disk usage: ${snapshot.usagePercent}%`,
        checkedAt: nowIso(),
        details: {
          path: snapshot.path,
          totalGb: snapshot.totalGb,
          usedGb: snapshot.usedGb,
          freeGb: snapshot.freeGb,
        },
      },
      snapshot,
    };
  }

  private async checkExternalService(
    name: string,
    url: string,
    timeoutMs: number,
    expectedStatus = 200
  ): Promise<CheckResult> {
    const start = Date.now();
    const checkedAt = nowIso();

    // Validate URL before attempting a connection
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        status: 'down',
        responseTimeMs: 0,
        message: `Invalid URL: ${url}`,
        details: { url },
        checkedAt,
      };
    }

    return new Promise((resolve) => {
      const transport = parsedUrl.protocol === 'https:' ? https : http;
      let req: ReturnType<typeof transport.get>;

      const timer = setTimeout(() => {
        // Destroy the in-flight request before resolving
        req?.destroy();
        resolve({
          status: 'down',
          responseTimeMs: Date.now() - start,
          message: `Timed out after ${timeoutMs}ms`,
          checkedAt,
        });
      }, timeoutMs);

      req = transport.get(url, { timeout: timeoutMs }, (res) => {
        clearTimeout(timer);
        const responseTimeMs = Date.now() - start;
        const ok = res.statusCode === expectedStatus;
        const status: CheckStatus = ok
          ? responseTimeStatus(responseTimeMs, this.config.thresholds)
          : 'down';

        resolve({
          status,
          responseTimeMs,
          message: ok ? `HTTP ${res.statusCode}` : `Unexpected HTTP ${res.statusCode}`,
          details: { statusCode: res.statusCode, url },
          checkedAt,
        });

        // Drain the response body to free the socket
        res.resume();
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        log.warn(`HealthService: external service check failed (${name})`, {
          errorMessage: err.message,
        });
        resolve({
          status: 'down',
          responseTimeMs: Date.now() - start,
          message: err.message,
          details: { url },
          checkedAt,
        });
      });
    });
  }

  // -------------------------------------------------------------------------
  // History management
  // -------------------------------------------------------------------------

  private addToHistory(entry: HealthHistoryEntry): void {
    if (!this.config.history.enabled) return;

    this.history.push(entry);

    // Trim to max entries
    if (this.history.length > this.config.history.maxEntries) {
      this.history.splice(0, this.history.length - this.config.history.maxEntries);
    }

    // Trim by retention age
    const cutoff = Date.now() - this.config.history.retentionMs;
    let i = 0;
    while (i < this.history.length && new Date(this.history[i].timestamp).getTime() < cutoff) {
      i++;
    }
    if (i > 0) this.history.splice(0, i);
  }

  getHistory(limit?: number): HealthHistory {
    const entries = limit ? this.history.slice(-limit) : [...this.history];
    return {
      entries,
      totalEntries: entries.length,
      oldestEntry: entries[0]?.timestamp,
      newestEntry: entries[entries.length - 1]?.timestamp,
    };
  }

  getTrend(windowSize = 20): HealthTrend {
    const window = this.history.slice(-windowSize);
    return calculateHealthTrend(window);
  }

  // -------------------------------------------------------------------------
  // Alert management
  // -------------------------------------------------------------------------

  private async processAlerts(
    healthCheck: HealthCheck,
    checkStatuses: Record<string, CheckStatus>
  ): Promise<void> {
    const { severityThresholds, cooldownMs } = this.config.alerting;

    for (const [name, status] of Object.entries(checkStatuses)) {
      if (status === 'down') {
        await this.maybeDispatchAlert(
          name,
          'critical',
          `${name} is DOWN`,
          `Health check for ${name} returned status: down`,
          healthCheck.score,
          cooldownMs
        );
      } else if (status === 'degraded') {
        await this.maybeDispatchAlert(
          name,
          'warning',
          `${name} is DEGRADED`,
          `Health check for ${name} returned status: degraded`,
          healthCheck.score,
          cooldownMs
        );
      } else {
        // Resolve any active alert for this check
        const active = this.activeAlerts.get(name);
        if (active) {
          active.resolved = true;
          active.resolvedAt = nowIso();
          this.activeAlerts.delete(name);
          log.info(`HealthService: alert resolved for ${name}`);
        }
      }
    }

    // Score-based alerts
    if (healthCheck.score <= severityThresholds.critical) {
      await this.maybeDispatchAlert(
        '_score',
        'critical',
        'Health score is critically low',
        `Overall health score dropped to ${healthCheck.score}/100`,
        healthCheck.score,
        cooldownMs
      );
    } else if (healthCheck.score <= severityThresholds.warning) {
      await this.maybeDispatchAlert(
        '_score',
        'warning',
        'Health score is low',
        `Overall health score is ${healthCheck.score}/100`,
        healthCheck.score,
        cooldownMs
      );
    }
  }

  private async maybeDispatchAlert(
    checkName: string,
    severity: HealthAlert['severity'],
    title: string,
    description: string,
    currentScore: number,
    cooldownMs: number
  ): Promise<void> {
    const lastDispatch = this.lastAlertDispatch.get(checkName) ?? 0;
    const now = Date.now();

    if (now - lastDispatch < cooldownMs) return; // within cooldown window

    const alert: HealthAlert = {
      id: generateId(),
      severity,
      title,
      description,
      checkName,
      currentScore,
      timestamp: nowIso(),
      resolved: false,
    };

    this.activeAlerts.set(checkName, alert);

    // Append to log, capping at 200 entries
    this.alertLog.push(alert);
    if (this.alertLog.length > 200) {
      this.alertLog.splice(0, this.alertLog.length - 200);
    }

    this.lastAlertDispatch.set(checkName, now);

    log.warn(`HealthService: alert dispatched [${severity}] ${title}`, {
      checkName,
      currentScore,
    });

    await this.sendWebhookAlert(alert);
  }

  private async sendWebhookAlert(alert: HealthAlert): Promise<void> {
    const { webhookUrl, webhookSecret } = this.config.alerting;
    if (!webhookUrl) return;

    try {
      const payload = JSON.stringify(alert);
      const parsedUrl = new URL(webhookUrl);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload).toString(),
        'User-Agent': 'ChenAIKit-HealthService/1.0',
      };

      if (webhookSecret) {
        headers['X-Webhook-Secret'] = webhookSecret;
      }

      await new Promise<void>((resolve, reject) => {
        const req = transport.request(
          { hostname: parsedUrl.hostname, port: parsedUrl.port, path: parsedUrl.pathname, method: 'POST', headers },
          (res) => {
            res.resume();
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`Webhook returned HTTP ${res.statusCode}`));
            }
          }
        );
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy(new Error('Webhook request timed out'));
        });
        req.write(payload);
        req.end();
      });

      log.info('HealthService: webhook alert sent', { alertId: alert.id });
    } catch (err) {
      log.warn('HealthService: failed to send webhook alert', { errorMessage: (err as Error).message });
    }
  }

  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertLog(limit = 50): HealthAlert[] {
    return this.alertLog.slice(-limit);
  }

  // -------------------------------------------------------------------------
  // Report generation
  // -------------------------------------------------------------------------

  async generateReport(windowSize = 50): Promise<HealthReport> {
    const window = this.history.slice(-windowSize);
    const trend = calculateHealthTrend(window);

    // Run a fresh check to get current snapshot for recommendations
    const latest = await this.runChecks();
    const snap = latest.toJSON();

    // Build per-check summary
    const checkSummary: HealthReport['checkSummary'] = {};

    for (const entry of window) {
      // We only have aggregate status per entry; use overall as a proxy
      // (per-check breakdown is available in snapshots but not stored in history)
    }

    // Use the latest snapshot checks for the summary keys
    for (const [name] of Object.entries(snap.checks)) {
      const checkEntries = window;
      const total = checkEntries.length;
      // We can't break down per-check from history entries alone, so summarise
      // from the overall status as a best-effort proxy
      const upCount = checkEntries.filter((e) => e.status === 'healthy').length;
      const degradedCount = checkEntries.filter((e) => e.status === 'degraded').length;
      const downCount = checkEntries.filter((e) => e.status === 'unhealthy').length;

      checkSummary[name] = {
        totalChecks: total,
        upCount,
        degradedCount,
        downCount,
        avgResponseTimeMs: 0, // response times not stored in history entries
        availability: total > 0 ? Math.round((upCount / total) * 10000) / 100 : 0,
      };
    }

    const memSnap = snap.checks.memory?.snapshot as MemorySnapshot | undefined;
    const diskSnap = snap.checks.disk?.snapshot as DiskSnapshot | undefined;
    const cpuSnap = snap.checks.cpu?.snapshot as CpuSnapshot | undefined;

    const checkStatuses: Record<string, CheckStatus> = {};
    for (const [name, check] of Object.entries(snap.checks)) {
      if (check) checkStatuses[name] = check.status;
    }

    const recommendations = generateRecommendations(
      checkStatuses,
      trend,
      this.config.thresholds,
      memSnap,
      diskSnap,
      cpuSnap
    );

    const periodStart = window[0]?.timestamp ?? nowIso();
    const periodEnd = window[window.length - 1]?.timestamp ?? nowIso();
    const scores = window.map((e) => e.score);
    const averageScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : latest.score;

    return {
      generatedAt: nowIso(),
      periodStart,
      periodEnd,
      overallStatus: latest.status,
      averageScore,
      trend,
      checkSummary,
      alerts: this.getAlertLog(20),
      recommendations,
    };
  }

  // -------------------------------------------------------------------------
  // Kubernetes / load-balancer probes
  // -------------------------------------------------------------------------

  /**
   * Liveness probe — returns true as long as the process is alive and the
   * event loop is not stuck.  Always succeeds unless the service itself is
   * fundamentally broken.
   */
  livenessCheck(): { alive: boolean; uptimeSeconds: number; pid: number } {
    return {
      alive: true,
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
    };
  }

  /**
   * Readiness probe — checks only the critical dependencies (DB + Redis).
   * Returns false if either is down, signalling to the load-balancer that
   * this instance should not receive traffic.
   */
  async readinessCheck(): Promise<{
    ready: boolean;
    checks: Record<string, CheckResult>;
  }> {
    const checks: Record<string, CheckResult> = {};

    if (this.config.checks.database) {
      checks.database = await this.checkDatabase();
    }

    if (this.config.checks.redis) {
      checks.redis = await this.checkRedis();
    }

    const ready = Object.values(checks).every((c) => c.status !== 'down');
    return { ready, checks };
  }

  // -------------------------------------------------------------------------
  // Dashboard metrics snapshot
  // -------------------------------------------------------------------------

  getDashboardMetrics(): {
    currentStatus: string;
    currentScore: number;
    trend: HealthTrend;
    activeAlerts: number;
    totalChecks: number;
    uptimeFormatted: string;
    recentHistory: HealthHistoryEntry[];
  } {
    const lastEntry = this.history[this.history.length - 1];
    const trend = this.getTrend(20);

    return {
      currentStatus: lastEntry?.status ?? 'unknown',
      currentScore: lastEntry?.score ?? 0,
      trend,
      activeAlerts: this.activeAlerts.size,
      totalChecks: this.history.length,
      uptimeFormatted: formatUptime(Math.floor(process.uptime())),
      recentHistory: this.history.slice(-10),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

let _healthServiceInstance: HealthService | null = null;

/**
 * Return the singleton HealthService.  On first call, instantiate it with
 * the provided Prisma client (if any).
 */
export function getHealthService(prisma?: PrismaClient): HealthService {
  if (!_healthServiceInstance) {
    _healthServiceInstance = new HealthService({ prisma });
  }
  return _healthServiceInstance;
}

/**
 * Replace the singleton — useful in tests.
 */
export function setHealthService(service: HealthService): void {
  _healthServiceInstance = service;
}
