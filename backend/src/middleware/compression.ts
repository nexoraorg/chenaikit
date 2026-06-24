/**
 * Compression Middleware Configuration
 * Configures response compression using gzip/deflate
 */

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Compression middleware configuration
 */
export const compressionMiddleware = compression({
  // Compress all responses
  filter: (req: Request, res: Response) => {
    // Don't compress if the response is already compressed
    if (res.headersSent) {
      return false;
    }

    // Don't compress if the client doesn't accept compression
    const acceptEncoding = req.headers['accept-encoding'];
    if (!acceptEncoding || !acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
      return false;
    }

    // Don't compress certain content types
    const contentType = res.getHeader('Content-Type') as string;
    if (contentType) {
      const shouldNotCompress = [
        'image/',
        'video/',
        'audio/',
        'application/octet-stream',
        'application/pdf',
      ];
      if (shouldNotCompress.some(type => contentType.includes(type))) {
        return false;
      }
    }

    return true;
  },

  // Compression level (0-9, where 9 is maximum compression)
  level: 6,

  // Threshold in bytes - only compress responses larger than this
  threshold: 1024, // 1KB

  // Chunk size for compression
  chunkSize: 16 * 1024, // 16KB

  // Window size for compression
  windowBits: 15,

  // Memory level (1-9, where 9 uses more memory)
  memLevel: 8,
});

/**
 * Middleware to add compression headers
 */
export function addCompressionHeaders(req: Request, res: Response, next: NextFunction): void {
  // Add Vary header to inform caches that compression varies by Accept-Encoding
  res.setHeader('Vary', 'Accept-Encoding');
  next();
}
