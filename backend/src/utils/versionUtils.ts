/**
 * API Versioning Utilities
 *
 * Single source of truth for the supported API versions, their lifecycle
 * status (semantic versioning + deprecation policy), and the helpers used by
 * the versioning middleware to resolve and compare versions.
 *
 * Versioning strategies supported (resolved in this order of precedence):
 *   1. URL path versioning      -> /api/v1/...  /api/v2/...
 *   2. Header versioning        -> Accept-Version: v2  (or "2", "2.0.0")
 *   3. Query parameter          -> ?version=v2 (also ?api-version / ?v)
 *   4. Default version fallback
 */

export type VersionStatus = "active" | "deprecated" | "sunset";

export interface VersionConfig {
  /** Canonical version identifier, e.g. "v1". */
  version: string;
  /** Full semantic version this API version maps to. */
  semver: string;
  /** Lifecycle status. */
  status: VersionStatus;
  /** ISO date the version was released. */
  releaseDate: string;
  /** ISO date the version was (or will be) deprecated, if applicable. */
  deprecationDate?: string;
  /** ISO date after which the version stops serving requests (HTTP 410). */
  sunsetDate?: string;
  /** Recommended successor version clients should migrate to. */
  successor?: string;
  /** Link to version / migration documentation. */
  docsUrl?: string;
}

/** Request header clients use to negotiate a version. */
export const VERSION_HEADER = "Accept-Version";
/** Response header echoing the version that served the request. */
export const RESPONSE_VERSION_HEADER = "X-API-Version";
/** Query parameters accepted for query-string versioning. */
export const VERSION_QUERY_PARAMS = ["version", "api-version", "v"] as const;

/**
 * Registry of supported API versions and their lifecycle metadata.
 *
 * v1 is intentionally marked `deprecated` to demonstrate the deprecation /
 * sunset policy; v2 is the current, actively developed version.
 */
export const API_VERSIONS: Record<string, VersionConfig> = {
  v1: {
    version: "v1",
    semver: "1.0.0",
    status: "deprecated",
    releaseDate: "2025-01-01",
    deprecationDate: "2026-01-01",
    sunsetDate: "2026-12-31",
    successor: "v2",
    docsUrl: "/docs/api/migration/v1-to-v2.md",
  },
  v2: {
    version: "v2",
    semver: "2.0.0",
    status: "active",
    releaseDate: "2026-01-01",
    docsUrl: "/docs/api/versioning.md",
  },
};

/** Version served when a client does not request one explicitly. */
export const DEFAULT_VERSION = "v1";
/** Newest available version, advertised to clients on every response. */
export const LATEST_VERSION = "v2";

/** List of currently supported version identifiers. */
export function getSupportedVersions(): string[] {
  return Object.keys(API_VERSIONS);
}

/**
 * Normalize a raw version string from any source into a canonical "v{major}"
 * identifier. Accepts "v1", "V1", "1", "1.2", "1.0.0", etc. Returns null when
 * the value cannot be interpreted as a version.
 */
export function normalizeVersion(raw?: string | null): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return null;

  // "v1", "v1.2", "v2.0.0"
  const prefixed = trimmed.match(/^v(\d+)(?:\.\d+)*$/);
  if (prefixed) return `v${prefixed[1]}`;

  // Bare number / semver: "1", "1.0", "1.0.0"
  const bare = trimmed.match(/^(\d+)(?:\.\d+)*$/);
  if (bare) return `v${bare[1]}`;

  return null;
}

/** True when the given canonical version is registered. */
export function isSupportedVersion(version?: string | null): boolean {
  return (
    !!version && Object.prototype.hasOwnProperty.call(API_VERSIONS, version)
  );
}

/** Look up the config for a canonical version, if any. */
export function getVersionConfig(version: string): VersionConfig | undefined {
  return API_VERSIONS[version];
}

/** True when the version is flagged as deprecated. */
export function isDeprecated(version: string): boolean {
  return getVersionConfig(version)?.status === "deprecated";
}

/**
 * True when the version has reached its sunset date (and must therefore stop
 * serving traffic). A version with status `sunset` is always considered sunset.
 */
export function isSunset(version: string, now: Date = new Date()): boolean {
  const cfg = getVersionConfig(version);
  if (!cfg) return false;
  if (cfg.status === "sunset") return true;
  if (!cfg.sunsetDate) return false;
  return now.getTime() >= new Date(cfg.sunsetDate).getTime();
}

/**
 * Compare two semantic version strings.
 * Returns -1 if a < b, 1 if a > b, 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

/**
 * Resolve a canonical version from raw candidates in precedence order
 * (path > header > query). Returns the default version when nothing is
 * supplied, or null when an explicit value is supplied but invalid.
 */
export function resolveVersion(candidates: {
  path?: string | null;
  header?: string | null;
  query?: string | null;
}): {
  version: string;
  source: "path" | "header" | "query" | "default";
} | null {
  const ordered: Array<
    ["path" | "header" | "query", string | null | undefined]
  > = [
    ["path", candidates.path],
    ["header", candidates.header],
    ["query", candidates.query],
  ];

  for (const [source, raw] of ordered) {
    if (raw === undefined || raw === null || raw === "") continue;
    const normalized = normalizeVersion(raw);
    if (!normalized || !isSupportedVersion(normalized)) {
      return null; // explicit but unsupported version
    }
    return { version: normalized, source };
  }

  return { version: DEFAULT_VERSION, source: "default" };
}
