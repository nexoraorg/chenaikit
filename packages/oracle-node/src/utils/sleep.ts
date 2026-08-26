/**
 * @chenaikit/oracle-node - Cancellable Sleep Utility
 */

/**
 * Pause execution for `ms` milliseconds, respecting an optional AbortSignal.
 *
 * @param ms Delay duration in milliseconds
 * @param signal Optional AbortSignal to cancel delay early
 * @returns Promise that resolves after delay, or rejects if aborted
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  if (signal?.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new Error(typeof signal.reason === "string" ? signal.reason : "Operation aborted")
    );
  }

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onAbort = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      cleanup();
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new Error(typeof signal?.reason === "string" ? signal.reason : "Operation aborted")
      );
    };

    const onTimeout = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    timer = setTimeout(onTimeout, ms);
  });
}
