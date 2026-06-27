import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import {
  HealthStatus,
  CheckStatus,
  TrendDirection,
  MemorySnapshot,
  CpuSnapshot,
  DiskSnapshot,
  HealthTrend,
  HealthScoreBreakdown,
  HealthHistoryEntry,
} from '../models/HealthCheck';
import { HealthCheckThresholds } from '../config/health';

// ---------------------------------------------------------------------------
// Unique ID generator (avoids uuid dependency)
// ---------------------------------------------------------------------------

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/**
 * Capture a snapshot of the current Node.js process memory usage.
 */
export function captureMemorySnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  const heapUsedMb = toMb(mem.heapUsed);
  const heapTotalMb = toMb(mem.heapTotal);
  const usagePercent =
    heapTotalMb > 0 ? Math.round((heapUsedMb / heapTotalMb) * 10000) / 100 : 0;

  return {
    heapUsedMb,
    heapTotalMb,
    externalMb: toMb(mem.external),
    rssMb: toMb(mem.rss),
    usagePercent,
  };
}

/**
 * Derive a CheckStatus from a memory snapshot against configured thresholds.
 */
export function memoryCheckStatus(
  snapshot: MemorySnapshot,
  thresholds: HealthCheckThresholds
): CheckStatus {
  const pct = snapshot.usagePercent;
  if (pct >= thresholds.memoryUsagePercent) return 'down';
  if (pct >= thresholds.memoryUsagePercent * 0.85) return 'degraded';
  return 'up';
}

// ---------------------------------------------------------------------------
// CPU
// ---------------------------------------------------------------------------

/** Previous CPU usage sample for delta calculation */
let _prevCpuUsage: ReturnType<typeof process.cpuUsage> | null = null;
let _prevCpuTime = 0;

export function captureCpuSnapshot(): CpuSnapshot {
  const now = Date.now();
  const usage = process.cpuUsage();

  let usagePercent = 0;
  if (_prevCpuUsage !== null) {
    const elapsedMs = now - _prevCpuTime;
    const userDelta = (usage.user - _prevCpuUsage.user) / 1000; // µs → ms
    const systemDelta = (usage.system - _prevCpuUsage.system) / 1000;
    const cpuMs = userDelta + systemDelta;
    usagePercent =
      elapsedMs > 0 ? Math.min(100, Math.round((cpuMs / elapsedMs) * 10000) / 100) : 0;
  }

  _prevCpuUsage = { ...usage };
  _prevCpuTime = now;

  const loadAvg = os.loadavg();

  return {
    usagePercent,
    userMs: Math.round(usage.user / 1000),
    systemMs: Math.round(usage.system / 1000),
    loadAvg1m: Math.round(loadAvg[0] * 100) / 100,
    loadAvg5m: Math.round(loadAvg[1] * 100) / 100,
    loadAvg15m: Math.round(loadAvg[2] * 100) / 100,
  };
}

/**
 * Derive a CheckStatus from a CPU snapshot against configured thresholds.
 * Uses load average relative to logical CPU count as a stable signal.
 */
export function cpuCheckStatus(
  snapshot: CpuSnapshot,
  thresholds: HealthCheckThresholds
): CheckStatus {
  const cpuCount = os.cpus().length || 1;
  const normalizedLoad = (snapshot.loadAvg1m / cpuCount) * 100;

  if (normalizedLoad >= thresholds.cpuUsagePercent) return 'down';
  if (normalizedLoad >= thresholds.cpuUsagePercent * 0.85) return 'degraded';
  return 'up';
}

// ---------------------------------------------------------------------------
// Disk
// ---------------------------------------------------------------------------

/**
 * Capture disk usage for a given path (defaults to cwd).
 * Falls back gracefully on platforms where `df` is unavailable.
 */
export function captureDiskSnapshot(targetPath = process.cwd()): DiskSnapshot {
  try {
    // Works on Linux/macOS; on Windows inside WSL this also works.
    const output = execSync(`df -k "${targetPath}" 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    // Last line is the data row
    const parts = lines[lines.length - 1].trim().split(/\s+/);

    // df -k columns: Filesystem  1K-blocks  Used  Available  Use%  Mounted on
    const totalKb = parseInt(parts[1], 10);
    const usedKb = parseInt(parts[2], 10);
    const freeKb = parseInt(parts[3], 10);

    const toGb = (kb: number) => Math.round((kb / 1024 / 1024) * 100) / 100;
    const totalGb = toGb(totalKb);
    const usedGb = toGb(usedKb);
    const freeGb = toGb(freeKb);
    const usagePercent = totalGb > 0 ? Math.round((usedGb / totalGb) * 10000) / 100 : 0;

    return { totalGb, usedGb, freeGb, usagePercent, path: targetPath };
  } catch {
    // Fallback: estimate from available fs stats if statvfs-like API available
    try {
      const stats = fs.statfsSync ? fs.statfsSync(targetPath) : null;
      if (stats) {
        const blockSize = (stats as any).bsize ?? 4096;
        const totalGb = Math.round(((stats as any).blocks * blockSize) / 1e9 * 100) / 100;
        const freeGb = Math.round(((stats as any).bfree * blockSize) / 1e9 * 100) / 100;
        const usedGb = Math.round((totalGb - freeGb) * 100) / 100;
        const usagePercent = totalGb > 0 ? Math.round((usedGb / totalGb) * 10000) / 100 : 0;
        return { totalGb, usedGb, freeGb, usagePercent, path: targetPath };
      }
    } catch {
      // ignore
    }

    // Last resort: return unknown values
    return { totalGb: 0, usedGb: 0, freeGb: 0, usagePercent: 0, path: targetPath };
  }
}

/**
 * Derive a CheckStatus from a disk snapshot against configured thresholds.
 */
export function diskCheckStatus(
  snapshot: DiskSnapshot,
  thresholds: HealthCheckThresholds
): CheckStatus {
  const pct = snapshot.usagePercent;
  if (pct >= thresholds.diskUsagePercent) return 'down';
  if (pct >= thresholds.diskUsagePercent * 0.9) return 'degraded';
  return 'up';
}

// ---------------------------------------------------------------------------
// Overall status derivation
// ---------------------------------------------------------------------------

/**
 * Determine the aggregate HealthStatus from a map of individual check statuses.
 * Any 'down' check makes the overall status 'unhealthy'; any 'degraded' makes
 * it 'degraded' (unless already unhealthy).
 */
export function deriveOverallStatus(
  checks: Record<string, CheckStatus>
): HealthStatus {
  const statuses = Object.values(checks);
  if (statuses.length === 0) return 'degraded';
  if (statuses.includes('down')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  return 'healthy';
}

// ---------------------------------------------------------------------------
// Health score calculation
// ---------------------------------------------------------------------------

const SCORE_WEIGHTS: Record<string, number> = {
  database: 0.30,
  redis: 0.20,
  memory: 0.15,
  cpu: 0.15,
  disk: 0.10,
  // remaining weight split evenly among external services
  _externalDefault: 0.10,
};

function checkStatusToScore(status: CheckStatus): number {
  switch (status) {
    case 'up':
      return 100;
    case 'degraded':
      return 50;
    case 'down':
      return 0;
  }
}

/**
 * Calculate an overall health score (0–100) from a map of check statuses.
 * Returns a full breakdown for dashboard display.
 */
export function calculateHealthScore(
  checks: Record<string, CheckStatus>
): HealthScoreBreakdown {
  const knownKeys = Object.keys(SCORE_WEIGHTS).filter((k) => k !== '_externalDefault');
  const externalKeys = Object.keys(checks).filter((k) => !knownKeys.includes(k));

  const externalWeight =
    externalKeys.length > 0 ? SCORE_WEIGHTS._externalDefault / externalKeys.length : 0;

  // Compute the sum of configured weights for only the checks that are present,
  // then normalize so the total always reaches 100 regardless of which checks
  // are enabled.
  const rawWeights = Object.keys(checks).map((name) =>
    knownKeys.includes(name) ? (SCORE_WEIGHTS[name] ?? 0) : externalWeight
  );
  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);

  const components: HealthScoreBreakdown['components'] = [];
  let total = 0;

  for (const [name, status] of Object.entries(checks)) {
    const configuredWeight = knownKeys.includes(name)
      ? (SCORE_WEIGHTS[name] ?? 0)
      : externalWeight;
    const weight = totalWeight > 0 ? configuredWeight / totalWeight : 0;
    const rawScore = checkStatusToScore(status);
    const weightedScore = rawScore * weight;
    total += weightedScore;
    components.push({ name, weight, rawScore, weightedScore: Math.round(weightedScore * 100) / 100 });
  }

  return {
    total: Math.round(Math.min(100, Math.max(0, total))),
    components,
  };
}

// ---------------------------------------------------------------------------
// Trend calculation
// ---------------------------------------------------------------------------

/**
 * Derive a health trend from a window of historical entries (newest last).
 * Requires at least 2 entries to produce a meaningful direction.
 */
export function calculateHealthTrend(entries: HealthHistoryEntry[]): HealthTrend {
  if (entries.length === 0) {
    return {
      direction: 'stable',
      scoreChange: 0,
      windowEntries: 0,
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      percentageHealthy: 0,
      percentageDegraded: 0,
      percentageUnhealthy: 0,
    };
  }

  const scores = entries.map((e) => e.score);
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const healthyCount = entries.filter((e) => e.status === 'healthy').length;
  const degradedCount = entries.filter((e) => e.status === 'degraded').length;
  const unhealthyCount = entries.filter((e) => e.status === 'unhealthy').length;
  const total = entries.length;

  let direction: TrendDirection = 'stable';
  let scoreChange = 0;

  if (entries.length >= 2) {
    // Compare the average of the first half vs second half
    const mid = Math.floor(entries.length / 2);
    const olderAvg =
      scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const newerAvg =
      scores.slice(mid).reduce((a, b) => a + b, 0) / (entries.length - mid);

    scoreChange = Math.round((newerAvg - olderAvg) * 100) / 100;

    if (scoreChange > 5) direction = 'improving';
    else if (scoreChange < -5) direction = 'degrading';
    else direction = 'stable';
  }

  return {
    direction,
    scoreChange,
    windowEntries: entries.length,
    averageScore,
    minScore,
    maxScore,
    percentageHealthy: Math.round((healthyCount / total) * 100),
    percentageDegraded: Math.round((degradedCount / total) * 100),
    percentageUnhealthy: Math.round((unhealthyCount / total) * 100),
  };
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

/**
 * Generate human-readable recommendations based on current check results and
 * system snapshots.
 */
export function generateRecommendations(
  checks: Record<string, CheckStatus>,
  trend: HealthTrend,
  thresholds: HealthCheckThresholds,
  memSnapshot?: MemorySnapshot,
  diskSnapshot?: DiskSnapshot,
  cpuSnapshot?: CpuSnapshot
): string[] {
  const recs: string[] = [];

  if (checks.database === 'down') {
    recs.push('Database is unreachable. Check DATABASE_URL and verify the database server is running.');
  } else if (checks.database === 'degraded') {
    recs.push('Database is responding slowly. Consider reviewing slow queries and connection pool settings.');
  }

  if (checks.redis === 'down') {
    recs.push('Redis is unreachable. Check REDIS_URL and ensure the Redis server is running.');
  } else if (checks.redis === 'degraded') {
    recs.push('Redis is responding slowly. Consider reviewing memory usage and eviction policies.');
  }

  if (memSnapshot) {
    if (memSnapshot.usagePercent >= thresholds.memoryUsagePercent) {
      recs.push(
        `Heap usage is critically high (${memSnapshot.usagePercent}%). Investigate memory leaks or increase heap limit via --max-old-space-size.`
      );
    } else if (memSnapshot.usagePercent >= thresholds.memoryUsagePercent * 0.85) {
      recs.push(
        `Heap usage is elevated (${memSnapshot.usagePercent}%). Monitor for upward trends.`
      );
    }
  }

  if (diskSnapshot && diskSnapshot.usagePercent > 0) {
    if (diskSnapshot.usagePercent >= thresholds.diskUsagePercent) {
      recs.push(
        `Disk usage is critically high (${diskSnapshot.usagePercent}% on ${diskSnapshot.path}). Free space immediately to avoid write failures.`
      );
    } else if (diskSnapshot.usagePercent >= thresholds.diskUsagePercent * 0.9) {
      recs.push(
        `Disk usage is elevated (${diskSnapshot.usagePercent}% on ${diskSnapshot.path}). Plan capacity expansion or clean up old data.`
      );
    }
  }

  if (cpuSnapshot && cpuSnapshot.loadAvg1m > 0) {
    const cpuCount = os.cpus().length || 1;
    if (cpuSnapshot.loadAvg1m > cpuCount) {
      recs.push(
        `1-minute load average (${cpuSnapshot.loadAvg1m}) exceeds CPU count (${cpuCount}). The system is CPU-saturated; consider scaling horizontally.`
      );
    }
  }

  if (trend.direction === 'degrading' && trend.scoreChange < -10) {
    recs.push(
      `Health score has dropped ${Math.abs(trend.scoreChange)} points recently. Investigate the root cause before further degradation.`
    );
  }

  if (recs.length === 0) {
    recs.push('All systems are operating normally. No action required.');
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Response-time check helper
// ---------------------------------------------------------------------------

/**
 * Convert a raw response time (ms) to a CheckStatus based on thresholds.
 */
export function responseTimeStatus(
  responseTimeMs: number,
  thresholds: HealthCheckThresholds
): CheckStatus {
  if (responseTimeMs >= thresholds.responseTimeMs * 2) return 'down';
  if (responseTimeMs >= thresholds.responseTimeMs) return 'degraded';
  return 'up';
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format uptime seconds into a human-readable string, e.g. "2d 3h 15m 42s" */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/** Return the current ISO-8601 timestamp string */
export function nowIso(): string {
  return new Date().toISOString();
}
