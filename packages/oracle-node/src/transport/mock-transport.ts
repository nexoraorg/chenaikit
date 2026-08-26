/**
 * @chenaikit/oracle-node - Testable Mock Transport for Deterministic Simulation
 */

import { OracleHttpError, OracleNetworkError, OracleRateLimitError, OracleTimeoutError } from "../errors.js";
import { Transport, TransportRequest, TransportResponse } from "../types.js";
import { sleep } from "../utils/sleep.js";

export type MockHandler = (request: TransportRequest) => Promise<TransportResponse> | TransportResponse;

export interface QueuedMockResponse {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: unknown;
  delayMs?: number;
  error?: Error;
  timeout?: boolean;
}

/**
 * Mock Transport enabling deterministic unit testing, fault injection, and latency simulation
 */
export class MockTransport implements Transport {
  public history: TransportRequest[] = [];
  private queuedResponses: QueuedMockResponse[] = [];
  private customHandler?: MockHandler;

  constructor(queuedResponses: QueuedMockResponse[] = []) {
    this.queuedResponses = [...queuedResponses];
  }

  /**
   * Queue a simulated response or failure
   */
  public enqueue(response: QueuedMockResponse): this {
    this.queuedResponses.push(response);
    return this;
  }

  /**
   * Queue multiple simulated responses
   */
  public enqueueSequence(responses: QueuedMockResponse[]): this {
    this.queuedResponses.push(...responses);
    return this;
  }

  /**
   * Set a dynamic request handler
   */
  public setHandler(handler: MockHandler): this {
    this.customHandler = handler;
    return this;
  }

  /**
   * Clear request history and queued responses
   */
  public reset(): void {
    this.history = [];
    this.queuedResponses = [];
    this.customHandler = undefined;
  }

  public async send<T = unknown>(request: TransportRequest): Promise<TransportResponse<T>> {
    this.history.push({ ...request, headers: { ...request.headers } });

    // Handle dynamic handler if set
    if (this.customHandler) {
      return (await this.customHandler(request)) as TransportResponse<T>;
    }

    if (this.queuedResponses.length === 0) {
      // Default fallback response if queue is empty
      return {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        data: { message: "ok" } as unknown as T,
      };
    }

    const mock = this.queuedResponses.shift()!;

    if (mock.delayMs && mock.delayMs > 0) {
      await sleep(mock.delayMs, request.signal);
    }

    if (request.signal?.aborted) {
      if (request.signal.reason instanceof OracleTimeoutError) {
        throw request.signal.reason;
      }
      throw new OracleTimeoutError("Request aborted due to timeout", {
        timeoutMs: request.timeoutMs ?? 0,
        url: request.url,
      });
    }

    if (mock.timeout) {
      throw new OracleTimeoutError(`Request to ${request.url} timed out in mock`, {
        timeoutMs: request.timeoutMs ?? 5000,
        url: request.url,
      });
    }

    if (mock.error) {
      throw mock.error;
    }

    const status = mock.status ?? 200;
    const statusText = mock.statusText ?? (status >= 200 && status < 300 ? "OK" : "Error");
    const headers = mock.headers ?? { "content-type": "application/json" };
    const data = mock.data as T;

    if (status >= 400) {
      if (status === 429) {
        const retryAfterStr = headers["retry-after"] || headers["Retry-After"];
        const retryAfterMs = retryAfterStr ? parseInt(retryAfterStr, 10) * 1000 : undefined;
        throw new OracleRateLimitError(`Rate limited (HTTP 429)`, {
          status: 429,
          statusText,
          headers,
          responseBody: data,
          url: request.url,
          retryAfterMs,
        });
      }

      throw new OracleHttpError(`HTTP ${status} ${statusText}`, {
        status,
        statusText,
        headers,
        responseBody: data,
        url: request.url,
      });
    }

    return {
      status,
      statusText,
      headers,
      data,
    };
  }
}
