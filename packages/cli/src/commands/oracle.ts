/**
 * @chenaikit/cli - Oracle CLI Commands
 */

import { OracleNodeClient } from "@chenaikit/oracle-node";

export interface OracleCliConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export function createOracleClient(config: OracleCliConfig): OracleNodeClient {
  return new OracleNodeClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    timeout: {
      attemptTimeoutMs: config.timeoutMs ?? 5000,
    },
    retry: {
      maxRetries: config.maxRetries ?? 3,
    },
  });
}

export async function checkOracleHealth(config: OracleCliConfig): Promise<{ status: string; timestamp: number }> {
  const client = createOracleClient(config);
  return await client.getHealth();
}

export async function fetchOracleFeed(config: OracleCliConfig, feedId: string) {
  const client = createOracleClient(config);
  return await client.getFeedData(feedId);
}
