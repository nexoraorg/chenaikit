/**
 * File Storage Service
 * Handles file upload, download, and management operations
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { log } from '../utils/logger';
import { DatabaseError, ValidationError, NotFoundError, ConfigurationError } from '../utils/errors';

export interface FileUploadOptions {
  userId?: string;
  isPublic?: boolean;
  metadata?: Record<string, any>;
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
}

export interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  storageType: string;
  userId?: string;
  isPublic: boolean;
  checksum?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class FileStorageService {
  private uploadDir: string;
  private defaultMaxSize: number = 10 * 1024 * 1024; // 10MB
  private defaultAllowedMimeTypes: string[] = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/json',
  ];

  constructor(private prisma: PrismaClient, uploadDir?: string) {
    this.uploadDir = uploadDir || path.join(process.cwd(), 'uploads');
    this.ensureUploadDirectory();
  }

  /**
   * Ensure the upload directory exists
   */
  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      log.info('Upload directory ready', { path: this.uploadDir });
    } catch (error) {
      log.error('Failed to create upload directory', error as Error);
      throw new ConfigurationError('Failed to initialize file storage');
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(
    file: Buffer,
    originalName: string,
    mimeType: string,
    options: FileUploadOptions = {}
  ): Promise<FileMetadata> {
    const {
      userId,
      isPublic = false,
      metadata,
      allowedMimeTypes = this.defaultAllowedMimeTypes,
      maxSizeBytes = this.defaultMaxSize,
    } = options;

    // Validate file size
    if (file.length > maxSizeBytes) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${maxSizeBytes} bytes`
      );
    }

    // Validate MIME type
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new ValidationError(
        `File type ${mimeType} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`
      );
    }

    // Generate unique filename
    const filename = this.generateFilename(originalName);
    const filePath = path.join(this.uploadDir, filename);

    // Calculate checksum
    const checksum = this.calculateChecksum(file);

    try {
      // Save file to disk
      await fs.writeFile(filePath, file);

      // Save metadata to database
      const fileRecord = await this.prisma.file.create({
        data: {
          filename,
          originalName,
          mimeType,
          size: file.length,
          path: filePath,
          storageType: 'local',
          userId,
          isPublic,
          checksum,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      log.info('File uploaded successfully', {
        fileId: fileRecord.id,
        filename: fileRecord.filename,
        size: fileRecord.size,
        userId,
      });

      return this.toFileMetadata(fileRecord);
    } catch (error) {
      // Clean up file if database save fails
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        log.error('Failed to clean up file after error', cleanupError as Error);
      }
      throw new DatabaseError('Failed to save file metadata');
    }
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string, userId?: string): Promise<{ file: Buffer; metadata: FileMetadata }> {
    const fileRecord = await this.getFileRecord(fileId, userId);

    try {
      const file = await fs.readFile(fileRecord.path);
      
      log.info('File downloaded successfully', {
        fileId: fileRecord.id,
        filename: fileRecord.filename,
        userId,
      });

      return {
        file,
        metadata: this.toFileMetadata(fileRecord),
      };
    } catch (error) {
      log.error('Failed to read file from disk', error as Error);
      throw new DatabaseError('Failed to read file');
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, userId?: string): Promise<void> {
    const fileRecord = await this.getFileRecord(fileId, userId);

    try {
      // Delete from disk
      await fs.unlink(fileRecord.path);

      // Delete from database
      await this.prisma.file.update({
        where: { id: fileId },
        data: { deletedAt: new Date() },
      });

      log.info('File deleted successfully', {
        fileId: fileRecord.id,
        filename: fileRecord.filename,
        userId,
      });
    } catch (error) {
      log.error('Failed to delete file', error as Error);
      throw new DatabaseError('Failed to delete file');
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string, userId?: string): Promise<FileMetadata> {
    const fileRecord = await this.getFileRecord(fileId, userId);
    return this.toFileMetadata(fileRecord);
  }

  /**
   * List files for a user
   */
  async listFiles(userId?: string, options: { limit?: number; offset?: number } = {}): Promise<{
    files: FileMetadata[];
    total: number;
  }> {
    const { limit = 50, offset = 0 } = options;

    const whereClause: any = {
      deletedAt: null,
    };

    if (userId) {
      whereClause.userId = userId;
    } else {
      // If no userId specified, only return public files
      whereClause.isPublic = true;
    }

    try {
      const [files, total] = await Promise.all([
        this.prisma.file.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.file.count({ where: whereClause }),
      ]);

      return {
        files: files.map(this.toFileMetadata),
        total,
      };
    } catch (error) {
      log.error('Failed to list files', error as Error);
      throw new DatabaseError('Failed to list files');
    }
  }

  /**
   * Get file record with access control
   */
  private async getFileRecord(fileId: string, userId?: string) {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileRecord || fileRecord.deletedAt) {
      throw new NotFoundError('File not found', { fileId });
    }

    // Check access permissions
    if (!fileRecord.isPublic && fileRecord.userId !== userId) {
      throw new ValidationError('You do not have permission to access this file');
    }

    return fileRecord;
  }

  /**
   * Generate unique filename
   */
  private generateFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${baseName}-${timestamp}-${random}${ext}`;
  }

  /**
   * Calculate file checksum
   */
  private calculateChecksum(file: Buffer): string {
    return createHash('sha256').update(file).digest('hex');
  }

  /**
   * Convert Prisma file record to FileMetadata
   */
  private toFileMetadata(record: any): FileMetadata {
    return {
      id: record.id,
      filename: record.filename,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      path: record.path,
      storageType: record.storageType,
      userId: record.userId || undefined,
      isPublic: record.isPublic,
      checksum: record.checksum || undefined,
      metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Clean up old files (retention policy)
   */
  async cleanupOldFiles(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const oldFiles = await this.prisma.file.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          deletedAt: null,
        },
      });

      let deletedCount = 0;
      for (const file of oldFiles) {
        try {
          await fs.unlink(file.path);
          await this.prisma.file.update({
            where: { id: file.id },
            data: { deletedAt: new Date() },
          });
          deletedCount++;
        } catch (error) {
          log.error('Failed to delete old file', { fileId: file.id, error });
        }
      }

      log.info('Cleaned up old files', { count: deletedCount, cutoffDate });
      return deletedCount;
    } catch (error) {
      log.error('Failed to cleanup old files', error as Error);
      throw new DatabaseError('Failed to cleanup old files');
    }
  }
}
