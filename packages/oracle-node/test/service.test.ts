import { afterEach, describe, expect, it } from "vitest";
import { StaticFeedAdapter } from "../src/adapters/static-adapter.js";
import { createGracefulShutdown } from "../src/lifecycle.js";
import { Logger } from "../src/logger.js";
import { OracleNodeService } from "../src/service.js";

describe("OracleNodeService & HTTP Server", () => {
  let activeService: OracleNodeService | undefined;

  afterEach(async () => {
    if (activeService) {
      await activeService.stop();
      activeService = undefined;
    }
  });

  const silentLogger = new Logger({
    level: "error",
    sink: () => {},
  });

  it("initializes and serves /health and /metrics endpoints", async () => {
    const testPort = 18545;
    const adapter = new StaticFeedAdapter({
      feedId: "test_health_feed",
      initialValue: 100n,
    });

    activeService = new OracleNodeService({
      config: {
        port: testPort,
        host: "127.0.0.1",
        pollIntervalMs: 60000,
      },
      adapters: [adapter],
      logger: silentLogger,
      txExecutor: async () => ({
        status: "success",
        transactionHash: "tx_init_hash",
      }),
    });

    await activeService.start();

    const healthRes = await fetch(`http://127.0.0.1:${testPort}/health`);
    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as Record<string, unknown>;
    expect(healthJson.status).toBe("healthy");
    expect(healthJson.service).toBe("@chenaikit/oracle-node");
    expect(Array.isArray(healthJson.registeredFeeds)).toBe(true);

    const metricsRes = await fetch(`http://127.0.0.1:${testPort}/metrics`);
    expect(metricsRes.status).toBe(200);
    const metricsJson = (await metricsRes.json()) as Record<string, unknown>;
    expect(metricsJson.submissionsSucceeded).toBe(1);

    const promRes = await fetch(`http://127.0.0.1:${testPort}/metrics`, {
      headers: { Accept: "text/plain" },
    });
    expect(promRes.status).toBe(200);
    const promText = await promRes.text();
    expect(promText).toContain("oracle_submissions_succeeded_total 1");
  });

  it("handles graceful shutdown sequence", async () => {
    let closedServer = false;
    let stoppedService = false;

    const mockServer = {
      close: (cb?: (err?: Error) => void) => {
        closedServer = true;
        if (cb) cb();
      },
    };

    let exitCode = -1;
    const shutdown = createGracefulShutdown({
      server: mockServer,
      onStop: async () => {
        stoppedService = true;
      },
      timeoutMs: 1000,
      onExit: (code) => {
        exitCode = code;
      },
      log: () => {},
    });

    await shutdown("SIGTERM");
    expect(closedServer).toBe(true);
    expect(stoppedService).toBe(true);
    expect(exitCode).toBe(0);
  });
});
