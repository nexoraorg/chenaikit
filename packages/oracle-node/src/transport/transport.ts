/**
 * @chenaikit/oracle-node - Transport Abstractions
 */

import { Transport, TransportRequest, TransportResponse } from "../types.js";

export { Transport, TransportRequest, TransportResponse };

/**
 * Builds a complete URL with encoded query parameters
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const rawUrl = `${normalizedBase}${normalizedPath}`;

  if (!query || Object.keys(query).length === 0) {
    return rawUrl;
  }

  const url = new URL(rawUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Safely stringifies a request payload body
 */
export function serializeRequestBody(body: unknown): string | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === "string") {
    return body;
  }
  return JSON.stringify(body);
}

/**
 * Safely parses response body
 */
export function parseResponseBody<T = unknown>(rawText: string, contentType?: string): T {
  if (!rawText || rawText.trim() === "") {
    return undefined as unknown as T;
  }

  if (contentType && contentType.toLowerCase().includes("application/json")) {
    try {
      return JSON.parse(rawText) as T;
    } catch {
      return rawText as unknown as T;
    }
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    return rawText as unknown as T;
  }
}
