const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function isObject(value: any): value is object {
    const type = typeof value;
    return value != null && (type === 'object' || type === 'function');
}

/**
 * Parses and handles Stellar errors.
 *
 * @param {any} error - The error to parse.
 * @returns {string}
 */
export function handleStellarError(error: any): string {
  if (isObject(error) && error.hasOwnProperty('response')) {
    const response = (error as any).response;
    if (response && response.data && response.data.extras && response.data.extras.result_codes) {
      const { result_codes } = response.data.extras;
      return `Transaction failed with error codes: ${JSON.stringify(result_codes)}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred.';
}

/**
 * Retries a function with a delay.
 *
 * @param {() => Promise<T>} fn - The function to retry.
 * @returns {Promise<T>}
 */
export async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw lastError;
}
