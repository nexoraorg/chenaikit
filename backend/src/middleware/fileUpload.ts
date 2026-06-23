/**
 * File Upload Middleware
 * Handles multipart/form-data file uploads using multer
 */

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ValidationError } from '../utils/errors';

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// File filter to validate file types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  // Allow all file types by default - validation happens in the service
  callback(null, true);
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB default limit
    files: 10, // Max 10 files at once
  },
});

/**
 * Middleware to handle single file upload
 */
export const uploadSingle = (fieldName: string = 'file') => {
  return upload.single(fieldName);
};

/**
 * Middleware to handle multiple file uploads
 */
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 10) => {
  return upload.array(fieldName, maxCount);
};

/**
 * Middleware to handle file upload with dynamic field name
 */
export const uploadFile = uploadSingle('file');

/**
 * Middleware to handle multiple files upload
 */
export const uploadFiles = uploadMultiple('files', 10);

/**
 * Validate that a file was uploaded
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    throw new ValidationError('No file uploaded');
  }
  next();
};

/**
 * Validate that files were uploaded
 */
export const validateFilesUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
    throw new ValidationError('No files uploaded');
  }
  next();
};
