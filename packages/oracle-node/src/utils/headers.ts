/**
 * @chenaikit/oracle-node - HTTP Header Utilities
 */

/**
 * Normalizes headers object to lowercase keys for case-insensitive lookup
 */
export function normalizeHeaders(headers?: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key.toLowerCase()] = String(value);
    }
  }
  return result;
}

/**
 * Retrieves a header value case-insensitively
 */
export function getHeader(
  headers: Record<string, string | undefined> | undefined,
  headerName: string
): string | undefined {
  if (!headers) return undefined;
  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && value !== undefined) {
      return String(value);
    }
  }
  return undefined;
}

/**
 * Merges multiple header objects, preserving original case of the last defined key
 */
export function mergeHeaders(
  ...headerObjects: Array<Record<string, string | undefined> | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const headers of headerObjects) {
    if (!headers) continue;
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        // Remove any existing case-insensitive duplicate
        const targetLower = key.toLowerCase();
        for (const existingKey of Object.keys(merged)) {
          if (existingKey.toLowerCase() === targetLower) {
            delete merged[existingKey];
          }
        }
        merged[key] = String(value);
      }
    }
  }

  return merged;
}
