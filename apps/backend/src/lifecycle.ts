// Graceful shutdown handling for the backend process.
//
// Wires OS termination signals (SIGTERM/SIGINT) to a shutdown sequence that:
//   1. stops the HTTP server from accepting new connections, while letting
//      in-flight requests finish;
//   2. closes the database connection;
//   3. exits the process — forcibly, with a non-zero code, if the sequence
//      doesn't complete within a timeout.
//
// The signal handlers themselves aren't easily unit-testable (they mutate
// global process state), so the sequencing logic lives here as a plain
// function that takes its dependencies as arguments.

/** The minimal shape of an HTTP server needed to shut it down. */
export interface ClosableServer {
  close(callback?: (err?: Error) => void): unknown;
}

export interface ShutdownDeps {
  /** The HTTP server to stop accepting new connections on. */
  server: ClosableServer;
  /** Closes the database connection (e.g. `prisma.$disconnect`). */
  disconnect: () => Promise<void>;
  /** Milliseconds to wait before forcing an exit. Defaults to 10s. */
  timeoutMs?: number;
  /** Defaults to `process.exit`; overridable for testing. */
  onExit?: (code: number) => void;
  /** Defaults to `console.log`; overridable for testing. */
  log?: (message: string) => void;
}

export type ShutdownHandler = (signal: string) => Promise<void>;

/**
 * Builds an idempotent shutdown handler: the first call runs the sequence,
 * any call received while it's already in progress is a no-op so resources
 * are closed exactly once.
 */
export function createGracefulShutdown({
  server,
  disconnect,
  timeoutMs = 10_000,
  onExit = (code) => process.exit(code),
  log = (message) => console.log(message),
}: ShutdownDeps): ShutdownHandler {
  let shuttingDown = false;

  return async function shutdown(signal: string) {
    if (shuttingDown) {
      log(`[backend] received ${signal} while already shutting down, ignoring`);
      return;
    }
    shuttingDown = true;
    log(`[backend] received ${signal}, starting graceful shutdown`);

    const forceExitTimer = setTimeout(() => {
      log(`[backend] graceful shutdown timed out after ${timeoutMs}ms, forcing exit`);
      onExit(1);
    }, timeoutMs);
    forceExitTimer.unref?.();

    try {
      // Stop accepting new connections; existing requests get to finish.
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });

      await disconnect();

      clearTimeout(forceExitTimer);
      log("[backend] graceful shutdown complete");
      onExit(0);
    } catch (err) {
      clearTimeout(forceExitTimer);
      const message = err instanceof Error ? err.message : String(err);
      log(`[backend] error during graceful shutdown: ${message}`);
      onExit(1);
    }
  };
}

/** Registers the shutdown handler against the process's termination signals. */
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
