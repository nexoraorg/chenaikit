/**
 * @chenaikit/oracle-node - Standard Fetch Transport
 */

import { OracleHttpError, OracleNetworkError, OracleRateLimitError, OracleTimeoutError } from "../errors.js";
import { Transport, TransportRequest, TransportResponse } from "../types.js";
import { parseResponseBody } from "./transport.js";
import { RateLimitHandler } from "../policy/rate-limit.js";

/**
 * Production transport using global fetch API
 */
export class FetchTransport implements Transport {
  public async send<T = unknown>(request: TransportRequest): Promise<TransportResponse<T>> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...request.headers,
    };

    if (request.body !== undefined && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;

    try {
      response = await fetch(request.url, {
        method: request.method,
        headers,
        body: request.body,
        signal: request.signal,
      });
    } catch (err: unknown) {
      if (request.signal?.aborted) {
        if (request.signal.reason instanceof OracleTimeoutError) {
          throw request.signal.reason;
        }
        if (request.signal.reason instanceof Error) {
          throw request.signal.reason;
        }
        throw new OracleTimeoutError("Request timed out or was aborted", {
          timeoutMs: request.timeoutMs ?? 0,
          url: request.url,
        });
      }

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          throw new OracleTimeoutError("Request was aborted due to timeout", {
            timeoutMs: request.timeoutMs ?? 0,
            url: request.url,
          });
        }
      }

      throw new OracleNetworkError(
        `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
        {
          url: request.url,
          originalError: err,
        }
      );
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key.toLowerCase()] = val;
    });

    let rawText = "";
    try {
      rawText = await response.text();
    } catch (err) {
      throw new OracleNetworkError("Failed to read response stream from oracle node", {
        url: request.url,
        originalError: err,
      });
    }

    const data = parseResponseBody<T>(rawText, responseHeaders["content-type"]);

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterMs = RateLimitHandler.parseRetryAfter(responseHeaders);
        throw new OracleRateLimitError(
          `Oracle node rate limited (HTTP 429 Too Many Requests): ${rawText || response.statusText}`,
          {
            status: 429,
            statusText: response.statusText,
            headers: responseHeaders,
            responseBody: data,
            url: request.url,
            retryAfterMs,
          }
        );
      }

      throw new OracleHttpError(
        `Oracle node returned HTTP ${response.status} ${response.statusText}: ${rawText || ""}`,
        {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          responseBody: data,
          url: request.url,
        }
      );
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
    };
  }
}
