/**
 * Backend Data Source Adapter for Chenaikit ecosystem feeds.
 */

import { DataSourceAdapter, FeedDataPoint } from "./types.js";

export interface BackendAdapterOptions {
  backendUrl: string;
  feedId?: string;
  endpoint?: string;
  fetchFn?: typeof fetch;
  apiKey?: string;
}

export class BackendCreditScoreAdapter implements DataSourceAdapter {
  public readonly name = "backend-credit-score";
  public readonly feedId: string;
  private readonly backendUrl: string;
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly apiKey?: string;

  constructor(options: BackendAdapterOptions) {
    this.backendUrl = options.backendUrl.replace(/\/+$/, "");
    this.feedId = options.feedId ?? "credit_sc";
    this.endpoint = options.endpoint ?? "/api/v1/credit-scores/latest";
    this.fetchFn = options.fetchFn ?? fetch;
    this.apiKey = options.apiKey;
  }

  public async fetchData(): Promise<FeedDataPoint> {
    const url = `${this.backendUrl}${this.endpoint}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "@chenaikit/oracle-node/0.1.0",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const res = await this.fetchFn(url, { headers });
      if (!res.ok) {
        throw new Error(`Upstream returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as { score?: number | string; timestamp?: number; value?: number | string };
      const rawVal = data.score ?? data.value ?? 750;
      const numVal = typeof rawVal === "number" ? rawVal : parseInt(String(rawVal), 10);
      const timestamp = data.timestamp ? Math.floor(data.timestamp / 1000) : Math.floor(Date.now() / 1000);

      return {
        feedId: this.feedId,
        value: BigInt(Number.isNaN(numVal) ? 750 : numVal),
        timestamp,
        source: this.name,
        metadata: { upstreamUrl: url, raw: data },
      };
    } catch (err) {
      const now = Math.floor(Date.now() / 1000);
      return {
        feedId: this.feedId,
        value: 750n,
        timestamp: now,
        source: `${this.name}:fallback`,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}

export class BackendFraudAlertAdapter implements DataSourceAdapter {
  public readonly name = "backend-fraud-alert";
  public readonly feedId: string;
  private readonly backendUrl: string;
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly apiKey?: string;

  constructor(options: BackendAdapterOptions) {
    this.backendUrl = options.backendUrl.replace(/\/+$/, "");
    this.feedId = options.feedId ?? "fraud_flg";
    this.endpoint = options.endpoint ?? "/api/v1/fraud-alerts/status";
    this.fetchFn = options.fetchFn ?? fetch;
    this.apiKey = options.apiKey;
  }

  public async fetchData(): Promise<FeedDataPoint> {
    const url = `${this.backendUrl}${this.endpoint}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "@chenaikit/oracle-node/0.1.0",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const res = await this.fetchFn(url, { headers });
      if (!res.ok) {
        throw new Error(`Upstream returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as { flagLevel?: number | string; flagsCount?: number };
      const rawVal = data.flagLevel ?? data.flagsCount ?? 0;
      const numVal = typeof rawVal === "number" ? rawVal : parseInt(String(rawVal), 10);
      const timestamp = Math.floor(Date.now() / 1000);

      return {
        feedId: this.feedId,
        value: BigInt(Number.isNaN(numVal) ? 0 : numVal),
        timestamp,
        source: this.name,
        metadata: { upstreamUrl: url, raw: data },
      };
    } catch (err) {
      const now = Math.floor(Date.now() / 1000);
      return {
        feedId: this.feedId,
        value: 0n,
        timestamp: now,
        source: `${this.name}:fallback`,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
