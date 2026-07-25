import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { storageConfig } from '../config/storage'
import { ValidationError } from './errors'

const execFileAsync = promisify(execFile)

const signatures: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
]

export const sanitizeFilename = (name: string): string => {
  const extension = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '')
  const base = path.basename(name, path.extname(name)).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base || 'file'}${extension}`
}

export const createStorageKey = (filename: string, ownerId?: string): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
  const owner = (ownerId ?? 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '') || 'anonymous'
  return `${owner}/${date}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`
}

export const detectMimeType = (buffer: Buffer): string | undefined => {
  const signature = signatures.find(({ bytes }) => bytes.every((byte, index) => buffer[index] === byte))
  if (signature) return signature.mime
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return undefined
}

export const validateFile = (file: { buffer: Buffer; mimetype: string; size: number }): void => {
  if (file.size <= 0 || file.size > storageConfig.maxFileSize) throw new ValidationError(`File must be between 1 and ${storageConfig.maxFileSize} bytes`)
  const declared = file.mimetype.toLowerCase()
  if (!storageConfig.allowedMimeTypes.includes(declared)) throw new ValidationError(`File type ${declared} is not allowed`)
  const detected = detectMimeType(file.buffer)
  const requiresSignature = /^(image\/|application\/(pdf|zip))/.test(declared)
  if (requiresSignature && detected !== declared) throw new ValidationError('File content does not match its declared type')
}

export const scanForViruses = async (buffer: Buffer): Promise<void> => {
  if (!storageConfig.virusScanCommand) return
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'chenaikit-scan-'))
  const temporaryFile = path.join(temporaryDirectory, 'upload')
  try {
    await fs.promises.writeFile(temporaryFile, buffer, { mode: 0o600 })
    const result = await execFileAsync(storageConfig.virusScanCommand, [temporaryFile], { maxBuffer: 1024 * 1024 })
    if (result.stdout.toLowerCase().includes('found')) throw new ValidationError('Malware detected in uploaded file')
  } catch (error) {
    if (error instanceof ValidationError) throw error
    const scanError = error as { code?: number; stdout?: string }
    if (scanError.code === 1 || scanError.stdout?.toLowerCase().includes('found')) throw new ValidationError('Malware detected in uploaded file')
    throw new Error('Virus scanner failed; upload rejected')
  } finally {
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true })
  }
}

export const optimizeImage = async (buffer: Buffer, mimeType: string): Promise<Buffer> => {
  if (!mimeType.startsWith('image/') || mimeType === 'image/gif') return buffer
  let pipeline = sharp(buffer).rotate().resize({ width: storageConfig.image.maxWidth, height: storageConfig.image.maxHeight, fit: 'inside', withoutEnlargement: true })
  if (mimeType === 'image/png') pipeline = pipeline.png({ compressionLevel: 9 })
  else if (mimeType === 'image/webp') pipeline = pipeline.webp({ quality: storageConfig.image.quality })
  else pipeline = pipeline.jpeg({ quality: storageConfig.image.quality, mozjpeg: true })
  return pipeline.toBuffer()
}

export const generateThumbnail = (buffer: Buffer): Promise<Buffer> =>
  sharp(buffer).rotate().resize(storageConfig.image.thumbnailWidth, storageConfig.image.thumbnailHeight, { fit: 'cover' }).webp({ quality: 78 }).toBuffer()

export const contentHash = (buffer: Buffer): string => crypto.createHash('sha256').update(buffer).digest('hex')

export const safeLocalPath = (root: string, key: string): string => {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, key)
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new ValidationError('Invalid storage key')
  return resolved
}
