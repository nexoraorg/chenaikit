import compression from 'compression';
import { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import { compressionConfig, responseCompressionOptions } from '../config/compression';
import { byteLength, compressionStatistics } from '../utils/compressionUtils';
import { log } from '../utils/logger';

const SUPPORTED_ENCODINGS = new Set(['identity', 'gzip', 'deflate', 'br']);
export interface RouteCompressionOptions { enabled?: boolean; threshold?: number; }
type CompressionRequest = Request & { compressionOptions?: RouteCompressionOptions };
type ChunkEncoding = Parameters<typeof Buffer.byteLength>[1];

function filter(req: CompressionRequest, res: Response): boolean {
  if (req.compressionOptions?.enabled === false) return false;
  const length = Number(res.getHeader('Content-Length'));
  if (Number.isFinite(length)) res.locals.originalResponseBytes = length;
  const threshold = req.compressionOptions?.threshold ?? compressionConfig.threshold;
  if (Number.isFinite(length) && length < threshold) return false;
  const type = String(res.getHeader('Content-Type') || '').toLowerCase();
  if (compressionConfig.excludedContentTypes.some((excluded) => type.startsWith(excluded))) return false;
  return compression.filter(req, res);
}
export function configureRouteCompression(options: RouteCompressionOptions): RequestHandler {
  return (req: CompressionRequest, _res, next): void => { req.compressionOptions = options; next(); };
}
const validateRequest: RequestHandler = (req, res, next): void => {
  const encoding = (req.header('content-encoding') || 'identity').trim().toLowerCase();
  const compressed = encoding !== 'identity';
  compressionStatistics.recordRequest(compressed);
  if (!SUPPORTED_ENCODINGS.has(encoding) || encoding.includes(',')) {
    compressionStatistics.recordRequestError();
    log.warn('Unsupported request compression', { method: req.method, path: req.path, encoding });
    res.status(415).json({ success: false, error: {
      code: 'UNSUPPORTED_CONTENT_ENCODING', message: `Unsupported Content-Encoding: ${encoding}`,
    } });
    return;
  }
  if (compressed && compressionConfig.requestLogging) {
    log.debug('Compressed request received', { method: req.method, path: req.path, encoding });
  }
  next();
};
function countWrites(res: Response, counter: { bytes: number }): void {
  const write = res.write.bind(res); const end = res.end.bind(res);
  res.write = ((chunk: unknown, encoding?: ChunkEncoding, callback?: () => void) => {
    counter.bytes += byteLength(chunk, encoding);
    return write(chunk as never, encoding as never, callback);
  }) as typeof res.write;
  res.end = ((chunk?: unknown, encoding?: ChunkEncoding, callback?: () => void) => {
    counter.bytes += byteLength(chunk, encoding);
    return end(chunk as never, encoding as never, callback);
  }) as typeof res.end;
}
export function applyCompressionMiddleware(app: Application): void {
  if (!compressionConfig.enabled) return;
  app.use((_req, res, next) => {
    const transferred = { bytes: 0 }; countWrites(res, transferred);
    res.once('finish', () => compressionStatistics.recordResponse(
      Number(res.locals.originalResponseBytes || res.locals.uncompressedResponseCounter?.bytes || transferred.bytes), transferred.bytes,
      Boolean(res.getHeader('Content-Encoding'))
    ));
    next();
  });
  app.use(compression({
    ...responseCompressionOptions, filter,
    threshold: 0,
  }));
  app.use((req, res, next) => {
    const raw = { bytes: 0 }; countWrites(res, raw);
    res.once('finish', () => { res.locals.uncompressedResponseBytes = raw.bytes; });
    validateRequest(req, res, next);
  });
}
export const compressionRequestErrorHandler = (
  error: Error & { type?: string; status?: number; statusCode?: number },
  req: Request, res: Response, next: NextFunction
): void => {
  const compressed = Boolean(req.header('content-encoding'));
  if (!compressed || (!error.type?.startsWith('encoding.') && error.status !== 400 && error.statusCode !== 400)) {
    next(error); return;
  }
  compressionStatistics.recordRequestError();
  log.warn('Invalid compressed request body', {
    method: req.method, path: req.path, encoding: req.header('content-encoding'), errorMessage: error.message,
  });
  res.status(400).json({ success: false, error: {
    code: 'INVALID_COMPRESSED_BODY', message: 'The compressed request body is invalid',
  } });
};
