/**
 * File Controller
 * Handles HTTP requests for file operations
 */

import { Request, Response } from 'express';
import { FileStorageService, FileMetadata } from '../services/fileStorageService';
import { ValidationError, NotFoundError } from '../utils/errors';

export class FileController {
  constructor(private fileStorageService: FileStorageService) {}

  /**
   * Upload a file
   */
  async uploadFile(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const file = req.file;

    if (!file) {
      throw new ValidationError('No file provided');
    }

    const options = {
      userId,
      isPublic: req.body.isPublic === 'true' || req.body.isPublic === true,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined,
      allowedMimeTypes: req.body.allowedMimeTypes 
        ? JSON.parse(req.body.allowedMimeTypes) 
        : undefined,
      maxSizeBytes: req.body.maxSizeBytes 
        ? parseInt(req.body.maxSizeBytes) 
        : undefined,
    };

    const metadata = await this.fileStorageService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      options
    );

    res.status(201).json({
      success: true,
      data: metadata,
    });
  }

  /**
   * Download a file
   */
  async downloadFile(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const { fileId } = req.params;

    const { file, metadata } = await this.fileStorageService.downloadFile(fileId, userId);

    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
    res.setHeader('Content-Length', metadata.size);
    res.send(file);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const { fileId } = req.params;

    const metadata = await this.fileStorageService.getFileMetadata(fileId, userId);

    res.json({
      success: true,
      data: metadata,
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const { fileId } = req.params;

    await this.fileStorageService.deleteFile(fileId, userId);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  }

  /**
   * List files
   */
  async listFiles(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await this.fileStorageService.listFiles(userId, { limit, offset });

    res.json({
      success: true,
      data: result.files,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  }

  /**
   * Get file stream (for streaming large files)
   */
  async streamFile(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const { fileId } = req.params;

    const metadata = await this.fileStorageService.getFileMetadata(fileId, userId);

    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${metadata.originalName}"`);
    res.setHeader('Content-Length', metadata.size);

    // For streaming, you would typically use a stream from the file system
    // For now, we'll use the download method
    const { file } = await this.fileStorageService.downloadFile(fileId, userId);
    res.send(file);
  }
}
