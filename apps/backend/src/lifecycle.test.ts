import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGracefulShutdown, registerShutdownSignals } from "./lifecycle.js";

describe("createGracefulShutdown", () => {
  it("closes the server, disconnects, and exits 0 on success", async () => {
    const close = vi.fn((cb: (err?: Error) => void) => cb());
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();
    const log = vi.fn();

    const shutdown = createGracefulShutdown({
      server: { close },
      disconnect,
      onExit,
      log,
    });

    await shutdown("SIGTERM");

    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(0);
    // disconnect must run only after the server has finished closing
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(
      disconnect.mock.invocationCallOrder[0],
    );
  });

  it("closes resources exactly once when signalled multiple times concurrently", async () => {
    const close = vi.fn((cb: (err?: Error) => void) => cb());
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();

    const shutdown = createGracefulShutdown({
      server: { close },
      disconnect,
      onExit,
      log: () => {},
    });

    await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT"), shutdown("SIGTERM")]);

    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("exits 1 if the server fails to close", async () => {
    const close = vi.fn((cb: (err?: Error) => void) => cb(new Error("boom")));
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();

    const shutdown = createGracefulShutdown({
      server: { close },
      disconnect,
      onExit,
      log: () => {},
    });

    await shutdown("SIGTERM");

    expect(disconnect).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledWith(1);
  });

  it("exits 1 if disconnecting the database fails", async () => {
    const close = vi.fn((cb: (err?: Error) => void) => cb());
    const disconnect = vi.fn().mockRejectedValue(new Error("db down"));
    const onExit = vi.fn();

    const shutdown = createGracefulShutdown({
      server: { close },
      disconnect,
      onExit,
      log: () => {},
    });

    await shutdown("SIGTERM");

    expect(onExit).toHaveBeenCalledWith(1);
  });

  it("forces exit 1 once the timeout elapses without the server closing", async () => {
    vi.useFakeTimers();
    try {
      const close = vi.fn(); // never invokes its callback
      const disconnect = vi.fn().mockResolvedValue(undefined);
      const onExit = vi.fn();

      const shutdown = createGracefulShutdown({
        server: { close },
        disconnect,
        onExit,
        log: () => {},
        timeoutMs: 5_000,
      });

      void shutdown("SIGTERM");
      await vi.advanceTimersByTimeAsync(5_000);

      expect(onExit).toHaveBeenCalledWith(1);
      expect(disconnect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("registerShutdownSignals", () => {
  const originalOn = process.on;
  let onSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSpy = vi.fn().mockReturnValue(process);
    process.on = onSpy as unknown as typeof process.on;
  });

  afterEach(() => {
    process.on = originalOn;
  });

  it("registers a listener for SIGTERM and SIGINT by default", () => {
    const shutdown = vi.fn().mockResolvedValue(undefined);

    registerShutdownSignals(shutdown);

    const registeredSignals = onSpy.mock.calls.map(([signal]) => signal);
    expect(registeredSignals).toContain("SIGTERM");
    expect(registeredSignals).toContain("SIGINT");
  });

  it("invokes the shutdown handler with the received signal", () => {
    const shutdown = vi.fn().mockResolvedValue(undefined);

    registerShutdownSignals(shutdown, ["SIGTERM"]);

    const [, handler] = onSpy.mock.calls[0];
    (handler as () => void)();

    expect(shutdown).toHaveBeenCalledWith("SIGTERM");
  });
});
