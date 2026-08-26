/**
 * @chenaikit/core - Oracle Core Abstractions and Types
 */

export interface OraclePricePoint {
  feedId: string;
  symbol: string;
  price: string;
  decimals: number;
  updatedAt: number;
  roundId: number;
  confidence?: number;
}

export interface OracleNodeHealthSummary {
  nodeId: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastHeartbeat: number;
  activeFeeds: string[];
}

export interface OracleNetworkConfig {
  nodes: Array<{
    id: string;
    endpoint: string;
    weight: number;
  }>;
  consensusThreshold: number;
  feedIds: string[];
}
