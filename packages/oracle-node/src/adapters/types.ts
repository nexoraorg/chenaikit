/**
 * Adapter interface and types for Oracle data ingestion.
 */

export interface FeedDataPoint {
  /** Target feed symbol identifier (e.g. credit_sc, fraud_flg) */
  feedId: string;
  /** Integer-scaled value (e.g. basis points, fixed-point integer) */
  value: bigint;
  /** Observation timestamp in Unix seconds */
  timestamp: number;
  /** Source adapter identifier */
  source: string;
  /** Optional metadata associated with reading */
  metadata?: Record<string, unknown>;
}

export interface DataSourceAdapter {
  /** Unique name of the adapter */
  readonly name: string;
  /** Feed symbol target */
  readonly feedId: string;
  /** Fetches the latest data point from the underlying upstream provider */
  fetchData(): Promise<FeedDataPoint>;
}
