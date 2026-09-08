/**
 * Graceful lifecycle and shutdown handling for Oracle Node process.
 */

export interface ClosableServer {
  close(callback?: (err?: Error) => void): unknown;
}

export interface OracleShutdownDeps {
  /** The HTTP server to stop accepting new health/metrics connections on */
  server: ClosableServer;
  /** Teardown callback for oracle runner (e.g. stopping timers, pending tasks) */
  onStop: () => Promise<void>;
  /** Timeout before forcing exit */
  timeoutMs?: number;
  /** Process exit hook */
  onExit?: (code: number) => void;
  /** Logger function */
  log?: (message: string) => void;
}

export type ShutdownHandler = (signal: string) => Promise<void>;

/**
 * Builds an idempotent shutdown handler ensuring resources are released cleanly once.
 */
export function createGracefulShutdown({
  server,
  onStop,
  timeoutMs = 10_000,
  onExit = (code) => process.exit(code),
  log = (msg) => console.log(msg),
}: OracleShutdownDeps): ShutdownHandler {
  let shuttingDown = false;

  return async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      log(`[oracle-node] received ${signal} while already shutting down, ignoring`);
      return;
    }
    shuttingDown = true;
    log(`[oracle-node] received ${signal}, starting graceful shutdown`);

    const forceExitTimer = setTimeout(() => {
      log(`[oracle-node] graceful shutdown timed out after ${timeoutMs}ms, forcing exit`);
      onExit(1);
    }, timeoutMs);
    forceExitTimer.unref?.();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });

      await onStop();

      clearTimeout(forceExitTimer);
      log("[oracle-node] graceful shutdown complete");
      onExit(0);
    } catch (err) {
      clearTimeout(forceExitTimer);
      const message = err instanceof Error ? err.message : String(err);
      log(`[oracle-node] error during graceful shutdown: ${message}`);
      onExit(1);
    }
  };
}

/**
 * Registers OS termination signal handlers against the graceful shutdown handler.
 */
export function registerShutdownSignals(
  shutdown: ShutdownHandler,
  signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"],
): void {
  for (const signal of signals) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }
}
