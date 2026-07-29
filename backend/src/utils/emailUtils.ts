/**
 * Lightweight email utilities — formatting, sanitisation, and address helpers.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(address: string): boolean {
  return EMAIL_RE.test(address.trim());
}

/**
 * Format a display name + address pair, e.g. `"Alice" <alice@example.com>`.
 */
export function formatAddress(name: string, address: string): string {
  const clean = name.replace(/"/g, '\\"');
  return `"${clean}" <${address}>`;
}

/**
 * Very small HTML sanitiser: strips script tags and on* attributes so
 * plain-text values injected into templates cannot XSS.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Interpolate `{{key}}` placeholders in a template string.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{{${key}}}`
  );
}

/**
 * Convert plain text to a minimal HTML paragraph block for multi-part emails.
 */
export function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => `<p>${sanitizeHtml(line)}</p>`)
    .join('\n');
}
