/**
 * @chenaikit/oracle-node - Idempotency & Operation Safety Classifier
 */

import { HttpMethod, IdempotencyClassification, RequestOptions } from "../types.js";

/**
 * Standard HTTP methods that are inherently safe and read-only
 */
export const SAFE_HTTP_METHODS: ReadonlySet<HttpMethod> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Standard HTTP methods that are idempotent according to RFC 7231
 */
export const IDEMPOTENT_HTTP_METHODS: ReadonlySet<HttpMethod> = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

/**
 * Known Oracle node read-only safe RPC / API operations
 */
export const SAFE_ORACLE_OPERATIONS: ReadonlySet<string> = new Set([
  "getHealth",
  "getNodeStatus",
  "getFeedData",
  "getLatestRound",
  "getRoundData",
  "getAttestation",
  "getAttestationStatus",
  "getRegisteredFeeds",
  "getPeers",
  "getConfig",
  "queryMetrics",
  "getRoundHistory",
  "validateProof",
]);

/**
 * Known Oracle node mutating / non-idempotent operations
 */
export const MUTATING_ORACLE_OPERATIONS: ReadonlySet<string> = new Set([
  "submitReport",
  "commitPrice",
  "signAttestation",
  "registerNode",
  "postOracleData",
  "broadcastMessage",
  "triggerAggregation",
  "updateConfig",
  "drainNode",
]);

/**
 * Header key used for idempotency keys
 */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/**
 * Classifier engine to determine if an operation is safe to retry
 */
export class IdempotencyClassifier {
  /**
   * Classifies an operation based on HTTP method, operation name, and request options
   */
  public static classify(
    method: HttpMethod,
    operationName?: string,
    options?: RequestOptions
  ): IdempotencyClassification {
    // 1. Explicit override in request options takes highest precedence
    if (options?.isIdempotent !== undefined) {
      return options.isIdempotent ? "idempotent" : "non-idempotent";
    }

    // 2. Presence of an idempotency key makes non-idempotent calls safely idempotent
    if (options?.idempotencyKey || options?.headers?.[IDEMPOTENCY_KEY_HEADER] || options?.headers?.["idempotency-key"]) {
      return "idempotent";
    }

    // 3. Known operation name classification
    if (operationName) {
      if (SAFE_ORACLE_OPERATIONS.has(operationName)) {
        return "read-only-safe";
      }
      if (MUTATING_ORACLE_OPERATIONS.has(operationName)) {
        return "non-idempotent";
      }
    }

    // 4. HTTP method standard classification
    if (SAFE_HTTP_METHODS.has(method)) {
      return "read-only-safe";
    }
    if (IDEMPOTENT_HTTP_METHODS.has(method)) {
      return "idempotent";
    }

    return "non-idempotent";
  }

  /**
   * Returns true if the operation is safe to retry on transient failure
   */
  public static isSafeToRetry(
    method: HttpMethod,
    operationName?: string,
    options?: RequestOptions
  ): boolean {
    const classification = this.classify(method, operationName, options);
    return classification === "read-only-safe" || classification === "idempotent";
  }

  /**
   * Generate a unique idempotency key (UUID-like token)
   */
  public static generateIdempotencyKey(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 12);
    const randomPart2 = Math.random().toString(36).substring(2, 12);
    return `idem_${timestamp}_${randomPart}_${randomPart2}`;
  }
}
