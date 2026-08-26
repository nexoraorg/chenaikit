/**
 * apps/backend - Oracle Service Relay
 *
 * Uses @chenaikit/oracle-node resilient client with retries, timeouts, and circuit breaking
 */

import { OracleNodeClient } from "@chenaikit/oracle-node";

export interface BackendOracleServiceConfig {
  oracleUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class BackendOracleService {
  private client: OracleNodeClient;

  constructor(config: BackendOracleServiceConfig = {}) {
    const baseUrl = config.oracleUrl ?? process.env.ORACLE_NODE_URL ?? "http://localhost:8545";
    this.client = new OracleNodeClient({
      baseUrl,
      apiKey: config.apiKey ?? process.env.ORACLE_API_KEY,
      timeout: {
        attemptTimeoutMs: config.timeoutMs ?? 3000,
        totalTimeoutMs: 10000,
      },
      retry: {
        maxRetries: config.maxRetries ?? 3,
        backoff: {
          initialDelayMs: 150,
          maxDelayMs: 3000,
          jitter: "full",
        },
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 4,
        cooldownPeriodMs: 15000,
      },
    });
  }

  public getClient(): OracleNodeClient {
    return this.client;
  }

  public async getHealth() {
    return this.client.getHealth();
  }

  public async getFeedPrice(feedId: string) {
    return this.client.getFeedData(feedId);
  }

  public async getLatestRound(feedId: string) {
    return this.client.getLatestRound(feedId);
  }
}
