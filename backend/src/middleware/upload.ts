import { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { storageConfig } from '../config/storage'
import { ValidationError } from '../utils/errors'
import { validateFile } from '../utils/fileUtils'

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storageConfig.maxFileSize, files: 10 },
  fileFilter: (_request, file, callback) => {
    if (!storageConfig.allowedMimeTypes.includes(file.mimetype.toLowerCase())) return callback(new ValidationError(`File type ${file.mimetype} is not allowed`))
    callback(null, true)
  },
})

export const uploadSingle = (fieldName = 'file') => uploader.single(fieldName)
export const uploadMultiple = (fieldName = 'files', maxCount = 10) => uploader.array(fieldName, maxCount)

export const validateUploadedFile = (request: Request, _response: Response, next: NextFunction): void => {
  try {
    if (!request.file) throw new ValidationError('A file is required')
    validateFile(request.file)
    next()
  } catch (error) { next(error) }
}

export const handleUploadError = (error: unknown, _request: Request, _response: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    next(new ValidationError(error.code === 'LIMIT_FILE_SIZE' ? `File exceeds the ${storageConfig.maxFileSize} byte limit` : error.message))
    return
  }
  next(error)
}
