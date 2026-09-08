/**
 * Configurable Static/Simulated Data Source Adapter for testing and baseline feeds.
 */

import { DataSourceAdapter, FeedDataPoint } from "./types.js";

export interface StaticAdapterOptions {
  name?: string;
  feedId: string;
  initialValue: bigint;
  driftBps?: number;
}

export class StaticFeedAdapter implements DataSourceAdapter {
  public readonly name: string;
  public readonly feedId: string;
  private currentValue: bigint;
  private readonly driftBps: number;

  constructor(options: StaticAdapterOptions) {
    this.name = options.name ?? `static-${options.feedId}`;
    this.feedId = options.feedId;
    this.currentValue = options.initialValue;
    this.driftBps = options.driftBps ?? 0;
  }

  public setValue(value: bigint): void {
    this.currentValue = value;
  }

  public async fetchData(): Promise<FeedDataPoint> {
    if (this.driftBps > 0) {
      const delta = (this.currentValue * BigInt(this.driftBps)) / 10000n;
      this.currentValue = this.currentValue + delta;
    }

    return {
      feedId: this.feedId,
      value: this.currentValue,
      timestamp: Math.floor(Date.now() / 1000),
      source: this.name,
    };
  }
}
