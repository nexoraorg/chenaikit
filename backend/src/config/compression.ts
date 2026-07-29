import { constants as zlibConstants } from 'zlib';

export interface CompressionConfig {
  enabled: boolean; level: number; brotliQuality: number; threshold: number;
  excludedContentTypes: string[]; requestLogging: boolean;
}
function bool(value: string | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : value.toLowerCase() === 'true';
}
function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
function threshold(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = value.trim().toLowerCase().match(/^(\d+)(b|kb|mb)?$/);
  if (!match) return fallback;
  return Number(match[1]) * (match[2] === 'mb' ? 1024 ** 2 : match[2] === 'kb' ? 1024 : 1);
}
const production = process.env.NODE_ENV === 'production';
export const compressionConfig: CompressionConfig = {
  enabled: bool(process.env.COMPRESSION_ENABLED, true),
  level: int(process.env.COMPRESSION_LEVEL, production ? 6 : 4, -1, 9),
  brotliQuality: int(process.env.COMPRESSION_BROTLI_QUALITY, production ? 5 : 4, 0, 11),
  threshold: threshold(process.env.COMPRESSION_THRESHOLD, 1024),
  excludedContentTypes: (process.env.COMPRESSION_EXCLUDED_TYPES ||
    'image/,audio/,video/,application/zip,application/gzip,application/pdf')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
  requestLogging: bool(process.env.COMPRESSION_REQUEST_LOGGING, true),
};
export const responseCompressionOptions = {
  level: compressionConfig.level,
  threshold: compressionConfig.threshold,
  brotli: { params: {
    [zlibConstants.BROTLI_PARAM_QUALITY]: compressionConfig.brotliQuality,
  } },
};
