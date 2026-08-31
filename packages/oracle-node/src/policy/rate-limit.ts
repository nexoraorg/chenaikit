/**
 * @chenaikit/oracle-node - Rate Limit & Retry-After Parser
 */

import { getHeader } from "../utils/headers.js";

export const DEFAULT_MAX_RETRY_AFTER_MS = 30000;

/**
 * Helper to parse the HTTP Retry-After header
 */
export class RateLimitHandler {
  /**
   * Parses the Retry-After header from response headers
   *
   * @param headers HTTP response headers dictionary
   * @param maxAllowedMs Optional cap for the parsed duration
   * @returns Delay in milliseconds if found and valid, or undefined
   */
  public static parseRetryAfter(
    headers: Record<string, string | undefined> | undefined,
    maxAllowedMs = DEFAULT_MAX_RETRY_AFTER_MS
  ): number | undefined {
    const raw = getHeader(headers, "retry-after");
    if (!raw) return undefined;

    const trimmed = raw.trim();

    // Try parsing as integer seconds (e.g. "10")
    if (/^\d+$/.test(trimmed)) {
      const seconds = parseInt(trimmed, 10);
      if (!isNaN(seconds) && seconds >= 0) {
        const ms = seconds * 1000;
        return Math.min(ms, maxAllowedMs);
      }
    }

    // Try parsing as HTTP Date (e.g. "Wed, 21 Oct 2026 07:28:00 GMT")
    const parsedDate = Date.parse(trimmed);
    if (!isNaN(parsedDate)) {
      const deltaMs = parsedDate - Date.now();
      if (deltaMs > 0) {
        return Math.min(deltaMs, maxAllowedMs);
      }
      return 0;
    }

    return undefined;
  }
}
