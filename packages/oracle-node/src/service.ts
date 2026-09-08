/**
 * Main persistent daemon service for the Oracle Node runtime.
 */

import { BackendCreditScoreAdapter, BackendFraudAlertAdapter } from "./adapters/backend-adapter.js";
import { DataSourceAdapter } from "./adapters/types.js";
import { loadConfig, OracleNodeConfig } from "./config.js";
import { Logger } from "./logger.js";
import { OracleHttpServer } from "./server.js";
import { OracleSubmitter, TxExecutor } from "./submitter.js";

export interface OracleServiceOptions {
  config?: Partial<OracleNodeConfig>;
  adapters?: DataSourceAdapter[];
  txExecutor?: TxExecutor;
  logger?: Logger;
}

export class OracleNodeService {
  public readonly config: OracleNodeConfig;
  public readonly logger: Logger;
  public readonly submitter: OracleSubmitter;
  public readonly server: OracleHttpServer;
  private readonly adapters: DataSourceAdapter[];
  private pollTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(options: OracleServiceOptions = {}) {
    this.config = {
      ...loadConfig(),
      ...(options.config ?? {}),
    };

    this.logger = options.logger ?? new Logger({ level: this.config.logLevel });

    this.submitter = new OracleSubmitter({
      contractId: this.config.contractId,
      nodeAddress: this.config.nodeAddress,
      nodeSecretKey: this.config.nodeSecretKey,
      rpcUrl: this.config.rpcUrl,
      maxRetries: this.config.maxRetries,
      initialBackoffMs: this.config.initialBackoffMs,
      maxBackoffMs: this.config.maxBackoffMs,
      logger: this.logger,
      txExecutor: options.txExecutor,
    });

    this.adapters = options.adapters ?? [
      new BackendCreditScoreAdapter({ backendUrl: this.config.backendUrl }),
      new BackendFraudAlertAdapter({ backendUrl: this.config.backendUrl }),
    ];

    this.server = new OracleHttpServer({
      port: this.config.port,
      host: this.config.host,
      submitter: this.submitter,
      registeredFeeds: this.adapters.map((a) => a.feedId),
      logger: this.logger,
    });
  }

  /**
   * Boots the persistent service, starts HTTP server and scheduling loop.
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    this.logger.info("Starting Oracle Node daemon", {
      nodeAddress: this.config.nodeAddress,
      contractId: this.config.contractId,
      pollIntervalMs: this.config.pollIntervalMs,
      adapters: this.adapters.map((a) => a.name),
    });

    await this.server.start();

    await this.runOnce();

    this.pollTimer = setInterval(() => {
      void this.runOnce().catch((err) => {
        this.logger.error("Unhandled error during adapter polling loop", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.config.pollIntervalMs);

    this.pollTimer.unref?.();
  }

  /**
   * Executes one full cycle of data collection and submission across all active adapters.
   */
  public async runOnce(): Promise<void> {
    for (const adapter of this.adapters) {
      try {
        const point = await adapter.fetchData();
        await this.submitter.submitDataPoint(point);
      } catch (err) {
        this.logger.error("Failed to collect or submit feed data", {
          adapter: adapter.name,
          feedId: adapter.feedId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Cleanly stops the service, closes HTTP listener and terminates timers.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    await this.server.stop();
    this.logger.info("Oracle Node daemon stopped gracefully");
  }

  public getAdapters(): readonly DataSourceAdapter[] {
    return this.adapters;
  }
}
