/**
 * API Versioning Middleware
 *
 * Provides version negotiation and routing across three strategies (URL path,
 * Accept-Version header, query parameter), emits deprecation warnings, and
 * enforces the sunset policy. Designed to be mounted once at the API root.
 *
 * Usage (see index.ts):
 *   app.use('/api', detectVersion(), versionHeaders(),
 *     createVersionRouter({ v1: v1Router, v2: v2Router }));
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  API_VERSIONS,
  DEFAULT_VERSION,
  LATEST_VERSION,
  VERSION_HEADER,
  RESPONSE_VERSION_HEADER,
  VERSION_QUERY_PARAMS,
  getSupportedVersions,
  getVersionConfig,
  isSunset,
  normalizeVersion,
  isSupportedVersion,
} from '../utils/versionUtils';
import { log } from '../utils/logger';

export type VersionSource = 'path' | 'header' | 'query' | 'default';

/** Matches a leading "/v{n}" path segment (case-insensitive). */
const PATH_VERSION_RE = /^\/(v\d+)(?=\/|\?|$)/i;

/**
 * Resolve the requested API version and attach it to the request.
 *
 * Precedence: URL path > Accept-Version header > query parameter > default.
 * When the version comes from the URL path the version segment is stripped from
 * `req.url` so downstream version routers can match clean, version-agnostic
 * paths (e.g. `/accounts/:id`). An explicit but unsupported version yields a
 * 400 response.
 */
export function detectVersion(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    let raw: string | undefined;
    let source: VersionSource = 'default';

    // 1. URL path versioning: leading /v{n}
    const pathMatch = req.path.match(PATH_VERSION_RE);
    if (pathMatch) {
      raw = pathMatch[1];
      source = 'path';
      // Strip the version prefix from req.url (preserving any query string).
      req.url = req.url.replace(/^\/v\d+/i, '');
      if (!req.url.startsWith('/')) req.url = `/${req.url}`;
    }

    // 2. Header versioning: Accept-Version
    if (!raw) {
      const headerVal = req.header(VERSION_HEADER);
      if (headerVal) {
        raw = headerVal;
        source = 'header';
      }
    }

    // 3. Query parameter versioning: ?version / ?api-version / ?v
    if (!raw) {
      for (const param of VERSION_QUERY_PARAMS) {
        const value = req.query[param];
        if (typeof value === 'string' && value) {
          raw = value;
          source = 'query';
          break;
        }
      }
    }

    if (raw === undefined) {
      (req as any).apiVersion = DEFAULT_VERSION;
      (req as any).apiVersionSource = 'default';
      next();
      return;
    }

    const normalized = normalizeVersion(raw);
    if (!normalized || !isSupportedVersion(normalized)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_API_VERSION',
          message: `API version '${raw}' is not supported.`,
          supportedVersions: getSupportedVersions(),
          latestVersion: LATEST_VERSION,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    (req as any).apiVersion = normalized;
    (req as any).apiVersionSource = source;
    next();
  };
}

/**
 * Emit version metadata on every response and enforce the deprecation / sunset
 * policy:
 *   - Always sets X-API-Version and X-API-Version-Latest.
 *   - For versions past their sunset date: responds 410 Gone.
 *   - For deprecated versions: sets RFC 8594 `Deprecation` and `Sunset`
 *     headers, a `Warning` header and a `Link` to the migration guide.
 *
 * Requires `detectVersion()` to have run first.
 */
export function versionHeaders(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const version = (req as any).apiVersion || DEFAULT_VERSION;
    const cfg = getVersionConfig(version);

    res.setHeader(RESPONSE_VERSION_HEADER, version);
    res.setHeader('X-API-Version-Latest', LATEST_VERSION);

    if (!cfg) {
      next();
      return;
    }

    if (cfg.sunsetDate) {
      res.setHeader('Sunset', new Date(cfg.sunsetDate).toUTCString());
    }

    // Sunset enforcement: retired versions stop serving traffic.
    if (isSunset(version)) {
      log.warn('Sunset API version requested', {
        version,
        path: req.originalUrl,
        source: (req as any).apiVersionSource,
      });
      res.status(410).json({
        success: false,
        error: {
          code: 'API_VERSION_SUNSET',
          message: `API ${version} was retired${
            cfg.sunsetDate ? ` on ${cfg.sunsetDate}` : ''
          }. Please migrate to ${cfg.successor || LATEST_VERSION}.`,
          latestVersion: LATEST_VERSION,
          migrationGuide: cfg.docsUrl,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Deprecation warnings for versions still in service.
    if (cfg.status === 'deprecated') {
      res.setHeader(
        'Deprecation',
        cfg.deprecationDate ? new Date(cfg.deprecationDate).toUTCString() : 'true'
      );
      const sunsetMsg = cfg.sunsetDate ? ` It will be sunset on ${cfg.sunsetDate}.` : '';
      res.setHeader(
        'Warning',
        `299 - "Deprecated API version ${version}.${sunsetMsg} Migrate to ${
          cfg.successor || LATEST_VERSION
        }."`
      );
      if (cfg.docsUrl) {
        res.setHeader('Link', `<${cfg.docsUrl}>; rel="deprecation"; type="text/html"`);
      }
      log.warn('Deprecated API version used', {
        version,
        path: req.originalUrl,
        source: (req as any).apiVersionSource,
      });
    }

    next();
  };
}

/**
 * Dispatch the request to the router registered for the resolved version,
 * enabling header / query versioning to share a single, version-agnostic path
 * (e.g. `/api/accounts`). Falls back to the default version's router.
 *
 * Requires `detectVersion()` to have run first.
 */
export function createVersionRouter(routers: Record<string, RequestHandler>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = (req as any).apiVersion || DEFAULT_VERSION;
    const handler = routers[version] || routers[DEFAULT_VERSION];
    if (!handler) {
      next();
      return;
    }
    handler(req, res, next);
  };
}

/**
 * Guard that rejects requests for any version other than the ones supplied.
 * Useful for version-specific middleware on routes only available in newer
 * versions.
 */
export function requireVersion(...versions: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const version = (req as any).apiVersion || DEFAULT_VERSION;
    if (versions.includes(version)) {
      next();
      return;
    }
    res.status(404).json({
      success: false,
      error: {
        code: 'ENDPOINT_NOT_IN_VERSION',
        message: `This endpoint is not available in API ${version}. Available in: ${versions.join(
          ', '
        )}.`,
        latestVersion: LATEST_VERSION,
        timestamp: new Date().toISOString(),
      },
    });
  };
}

/** Convenience: the standard version negotiation chain. */
export function apiVersioning(): RequestHandler[] {
  return [detectVersion(), versionHeaders()];
}

/** Re-exported for callers that only need the registry summary. */
export { API_VERSIONS };
