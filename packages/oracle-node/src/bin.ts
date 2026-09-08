#!/usr/bin/env node
/**
 * CLI binary entrypoint for the Oracle Node persistent daemon.
 */

import { createGracefulShutdown, registerShutdownSignals } from "./lifecycle.js";
import { OracleNodeService } from "./service.js";

async function main(): Promise<void> {
  const service = new OracleNodeService();

  const shutdown = createGracefulShutdown({
    server: service.server.getRawServer(),
    onStop: async () => {
      await service.stop();
    },
    timeoutMs: 10_000,
    log: (msg) => service.logger.info(msg),
  });

  registerShutdownSignals(shutdown);

  await service.start();
}

main().catch((err) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`Fatal error starting oracle-node: ${message}\n`);
  process.exit(1);
});
