export function canonicalize(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Cannot canonicalize non-finite numbers');
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue)
      .filter((key) => objectValue[key] !== undefined)
      .sort((a, b) => a.localeCompare(b));
    const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`);
    return `{${entries.join(',')}}`;
  }

  throw new TypeError(`Unsupported canonicalization type: ${typeof value}`);
}

export function canonicalizeReceipt(receipt: unknown): string {
  return canonicalize(receipt);
}
