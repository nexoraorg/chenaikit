/**
 * Validation configuration.
 *
 * Central place for validation tuning knobs — strictness, maximum sizes,
 * logging behaviour, etc. All values are sourced from environment variables
 * with sensible defaults so they can be tweaked per deployment without
 * code changes.
 */

export interface ValidationConfig {
  /** Throw on the first error (`true`) or collect all errors (`false`). */
  abortEarly: boolean;
  /** Maximum allowed request body size in bytes (handled elsewhere, mirrored here). */
  maxBodySize: number;
  /** When true, validation errors are logged at warn level. */
  logValidationErrors: boolean;
  /** When true, the validation middleware strips unknown keys from objects. */
  stripUnknown: boolean;
}

export const getValidationConfig = (): ValidationConfig => ({
  abortEarly: process.env.VALIDATION_ABORT_EARLY === 'true',
  maxBodySize: Number(process.env.MAX_BODY_SIZE) || 10 * 1024 * 1024, // 10 MB
  logValidationErrors: process.env.VALIDATION_LOG_ERRORS !== 'false',
  stripUnknown: process.env.VALIDATION_STRIP_UNKNOWN !== 'false',
});
