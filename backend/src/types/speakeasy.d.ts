declare module 'speakeasy' {
  export interface Secret {
    base32: string;
    otpauth_url?: string;
    [key: string]: string | boolean | undefined;
  }

  export interface TOTPOptions {
    secret: string;
    encoding?: string;
    token?: string;
    window?: number;
    step?: number;
  }

  export function generateSecret(options?: {
    name?: string;
    issuer?: string;
    length?: number;
  }): Secret;

  export namespace totp {
    export function verify(options: TOTPOptions): boolean;
    export function generate(options: TOTPOptions): string;
  }

  export namespace hotp {
    export function verify(options: TOTPOptions & { counter?: number }): boolean;
    export function generate(options: TOTPOptions & { counter?: number }): string;
  }
}