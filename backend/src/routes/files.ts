/**
 * File Routes
 * API endpoints for file operations
 */

import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { FileController } from '../controllers/fileController';
import { FileStorageService } from '../services/fileStorageService';
import { uploadFile, validateFileUpload } from '../middleware/fileUpload';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router: ExpressRouter = Router();

// Rate limiting for file operations
const fileRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { message: 'Too many file requests, please try again later.' },
});

// Apply rate limiting to all file routes
router.use(fileRateLimit);

/**
 * POST /api/files/upload
 * Upload a single file (requires authentication)
 */
router.post(
  '/upload',
  authenticate,
  uploadFile,
  validateFileUpload,
  asyncHandler((req, res, next) => {
    const fileController = new FileController(req.app.get('fileStorageService'));
    return fileController.uploadFile(req, res, next);
  })
);

/**
 * GET /api/files/:fileId
 * Get file metadata (public files accessible without auth)
 */
router.get(
  '/:fileId',
  asyncHandler((req, res, next) => {
    const fileController = new FileController(req.app.get('fileStorageService'));
    return fileController.getFileMetadata(req, res, next);
  })
);

/**
 * GET /api/files/:fileId/download
 * Download a file (public files accessible without auth)
 */
router.get(
  '/:fileId/download',
  asyncHandler((req, res, next) => {
    const fileController = new FileController(req.app.get('fileStorageService'));
    return fileController.downloadFile(req, res, next);
  })
);

/**
 * GET /api/files/:fileId/stream
 * Stream a file (public files accessible without auth)
 */
router.get(
  '/:fileId/stream',
  asyncHandler((req, res, next) => {
    const fileController = new FileController(req.app.get('fileStorageService'));
    return fileController.streamFile(req, res, next);
  })
);

/**
 * DELETE /api/files/:fileId
 * Delete a file (requires authentication)
 */
router.delete(
  '/:fileId',
  authenticate,
  asyncHandler((req, res, next) => {
    const fileController = new FileController(req.app.get('fileStorageService'));
    return fileController.deleteFile(req, res, next);
  })
);

/**
 * GET /api/files
 * List files (requires authentication for user files, public files accessible without auth)
 */
router.get(
  '/',
  asyncHandler((req, res, next) => {
    const fileController = new FileController(req.app.get('fileStorageService'));
    return fileController.listFiles(req, res, next);
  })
);

export default router;
