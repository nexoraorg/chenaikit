import { redact, redactBody, redactHeaders } from '../../utils/logRedaction';

describe('logRedaction', () => {
  describe('redact', () => {
    it('returns primitives unchanged', () => {
      expect(redact(42)).toBe(42);
      expect(redact(true)).toBe(true);
      expect(redact(null)).toBeNull();
    });

    it('redacts sensitive keys', () => {
      const result = redact({ password: 'secret123', name: 'Alice' }) as any;
      expect(result.password).toBe('[REDACTED]');
      expect(result.name).toBe('Alice');
    });

    it('redacts nested sensitive keys', () => {
      const result = redact({ user: { token: 'abc', email: 'a@b.com' } }) as any;
      expect(result.user.token).toBe('[REDACTED]');
      expect(result.user.email).toBe('a@b.com');
    });

    it('redacts JWT strings', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature';
      const result = redact({ note: `token=${jwt}` }) as any;
      expect(result.note).not.toContain(jwt);
      expect(result.note).toContain('[JWT_REDACTED]');
    });

    it('redacts apiKey variants', () => {
      const obj = { apiKey: 'key123', api_key: 'key456' };
      const result = redact(obj) as any;
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.api_key).toBe('[REDACTED]');
    });

    it('handles arrays', () => {
      const result = redact([{ password: 'x' }, { name: 'y' }]) as any[];
      expect(result[0].password).toBe('[REDACTED]');
      expect(result[1].name).toBe('y');
    });

    it('redacts Bearer tokens in string values', () => {
      const result = redact('Bearer eyJhbGciOiJSUzI1NiJ9sometoken') as string;
      expect(result).toContain('[TOKEN_REDACTED]');
    });
  });

  describe('redactBody', () => {
    it('redacts sensitive body fields', () => {
      const body = { username: 'user', password: 'pass', creditCard: '4111111111111111' };
      const result = redactBody(body) as any;
      expect(result.username).toBe('user');
      expect(result.password).toBe('[REDACTED]');
      expect(result.creditCard).toBe('[REDACTED]');
    });
  });

  describe('redactHeaders', () => {
    it('redacts authorization header', () => {
      const headers = { authorization: 'Bearer token123', 'content-type': 'application/json' };
      const result = redactHeaders(headers);
      expect(result.authorization).toBe('[REDACTED]');
      expect(result['content-type']).toBe('application/json');
    });

    it('redacts cookie header', () => {
      const headers = { cookie: 'session=abc; other=val' };
      const result = redactHeaders(headers);
      expect(result.cookie).toBe('[REDACTED]');
    });
  });
});
