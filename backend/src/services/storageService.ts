import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { storageConfig, StorageProvider } from '../config/storage'
import { AuthorizationError, NotFoundError } from '../utils/errors'
import { contentHash, createStorageKey, generateThumbnail, optimizeImage, safeLocalPath, scanForViruses, validateFile } from '../utils/fileUtils'
import { s3Service } from './s3Service'

export interface FileAccess { ownerId?: string; isPublic?: boolean; allowedUserIds?: string[] }
export interface StoredFileMetadata extends FileAccess {
  key: string
  provider: StorageProvider
  originalName: string
  mimeType: string
  size: number
  checksum: string
  version: string
  createdAt: string
  updatedAt: string
  thumbnailKey?: string
  custom?: Record<string, string>
}
export interface UploadInput extends FileAccess {
  key?: string
  buffer: Buffer
  originalName: string
  mimeType: string
  customMetadata?: Record<string, string>
  optimize?: boolean
  thumbnail?: boolean
}
export interface StorageAdapter {
  upload(key: string, body: Buffer, metadata: StoredFileMetadata): Promise<void>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  signedUrl?(key: string, expiresIn?: number): Promise<string>
}

const metaSuffix = '.metadata.json'

export class StorageService {
  private readonly adapters = new Map<StorageProvider, StorageAdapter>()

  constructor(adapters: Partial<Record<StorageProvider, StorageAdapter>> = {}) {
    this.adapters.set('local', this.localAdapter())
    this.adapters.set('s3', {
      upload: (key, body, metadata) => s3Service.upload(key, body, { contentType: metadata.mimeType, metadata: this.s3Metadata(metadata), cacheControl: storageConfig.cacheControl }),
      download: (key) => s3Service.download(key),
      delete: (key) => s3Service.delete(key),
      signedUrl: (key, expiresIn) => s3Service.signedDownloadUrl(key, expiresIn),
    })
    for (const [provider, adapter] of Object.entries(adapters)) if (adapter) this.adapters.set(provider as StorageProvider, adapter)
  }

  registerProvider(provider: 'gcs' | 'azure', adapter: StorageAdapter): void { this.adapters.set(provider, adapter) }

  async upload(input: UploadInput): Promise<StoredFileMetadata> {
    validateFile({ buffer: input.buffer, mimetype: input.mimeType, size: input.buffer.length })
    await scanForViruses(input.buffer)
    const key = input.key ?? createStorageKey(input.originalName, input.ownerId)
    const previous = input.key ? await this.readMetadataWithoutAccess(key) : undefined
    if (previous && previous.ownerId !== input.ownerId) throw new AuthorizationError('Only the owner can create a new file version')
    const body = input.optimize === false ? input.buffer : await optimizeImage(input.buffer, input.mimeType)
    const now = new Date().toISOString()
    const metadata: StoredFileMetadata = {
      key, provider: storageConfig.provider, originalName: input.originalName, mimeType: input.mimeType,
      size: body.length, checksum: contentHash(body), version: crypto.randomUUID(), createdAt: previous?.createdAt ?? now, updatedAt: now,
      ownerId: input.ownerId, isPublic: input.isPublic ?? false, allowedUserIds: input.allowedUserIds ?? [], custom: input.customMetadata,
    }
    await this.adapter(storageConfig.provider).upload(key, body, metadata)
    await this.writeMetadata(metadata)
    for (const provider of storageConfig.mirrorProviders) {
      if (provider !== storageConfig.provider) await this.adapter(provider).upload(key, body, { ...metadata, provider })
    }
    if (input.thumbnail && input.mimeType.startsWith('image/')) {
      const thumbnail = await generateThumbnail(body)
      metadata.thumbnailKey = `${key}.thumbnail.webp`
      const thumbMeta = { ...metadata, key: metadata.thumbnailKey, mimeType: 'image/webp', size: thumbnail.length, checksum: contentHash(thumbnail) }
      await this.adapter(storageConfig.provider).upload(metadata.thumbnailKey, thumbnail, thumbMeta)
      await this.writeMetadata(metadata)
    }
    return metadata
  }

  async download(key: string, userId?: string): Promise<{ body: Buffer; metadata: StoredFileMetadata }> {
    const metadata = await this.getMetadata(key, userId)
    return { body: await this.adapter(metadata.provider).download(key), metadata }
  }

  async delete(key: string, userId?: string): Promise<void> {
    const metadata = await this.getMetadata(key, userId, true)
    await this.adapter(metadata.provider).delete(key)
    if (metadata.thumbnailKey) await this.adapter(metadata.provider).delete(metadata.thumbnailKey)
    for (const provider of storageConfig.mirrorProviders) if (provider !== metadata.provider) await this.adapter(provider).delete(key)
    await fs.promises.rm(this.metadataPath(key), { force: true })
  }

  async getMetadata(key: string, userId?: string, requireOwner = false): Promise<StoredFileMetadata> {
    const metadata = await this.readMetadataWithoutAccess(key)
    if (!metadata) throw new NotFoundError('File not found')
    this.assertAccess(metadata, userId, requireOwner)
    return metadata
  }

  async createSignedUrl(key: string, userId?: string, expiresIn = storageConfig.signedUrlTtlSeconds): Promise<string> {
    const metadata = await this.getMetadata(key, userId)
    if (storageConfig.cdnBaseUrl && metadata.isPublic) return `${storageConfig.cdnBaseUrl}/${encodeURI(key)}`
    const adapter = this.adapter(metadata.provider)
    if (adapter.signedUrl) return adapter.signedUrl(key, expiresIn)
    if (!storageConfig.signedUrlSecret) throw new Error('STORAGE_SIGNED_URL_SECRET is required')
    const expires = Math.floor(Date.now() / 1000) + expiresIn
    const signature = crypto.createHmac('sha256', storageConfig.signedUrlSecret).update(`${key}:${expires}`).digest('hex')
    return `/files/${encodeURI(key)}?expires=${expires}&signature=${signature}`
  }

  verifyLocalSignedUrl(key: string, expires: number, signature: string): boolean {
    if (!storageConfig.signedUrlSecret || expires <= Math.floor(Date.now() / 1000)) return false
    const expected = crypto.createHmac('sha256', storageConfig.signedUrlSecret).update(`${key}:${expires}`).digest('hex')
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }

  async downloadWithSignedUrl(key: string, expires: number, signature: string): Promise<{ body: Buffer; metadata: StoredFileMetadata }> {
    if (!this.verifyLocalSignedUrl(key, expires, signature)) throw new AuthorizationError('Invalid or expired file signature')
    const metadata = await this.readMetadataWithoutAccess(key)
    if (!metadata) throw new NotFoundError('File not found')
    return { body: await this.adapter(metadata.provider).download(key), metadata }
  }

  private adapter(provider: StorageProvider): StorageAdapter {
    const adapter = this.adapters.get(provider)
    if (!adapter) throw new Error(`${provider.toUpperCase()} storage requires a registered adapter`)
    return adapter
  }

  private assertAccess(metadata: StoredFileMetadata, userId?: string, requireOwner = false): void {
    const isOwner = Boolean(userId && metadata.ownerId === userId)
    const isAllowed = Boolean(userId && metadata.allowedUserIds?.includes(userId))
    if (requireOwner ? !isOwner : !(metadata.isPublic || isOwner || isAllowed)) throw new AuthorizationError('You do not have access to this file')
  }

  private metadataPath(key: string): string { return safeLocalPath(path.join(storageConfig.localRoot, '.metadata'), `${key}${metaSuffix}`) }
  private async readMetadataWithoutAccess(key: string): Promise<StoredFileMetadata | undefined> {
    try { return JSON.parse(await fs.promises.readFile(this.metadataPath(key), 'utf8')) as StoredFileMetadata }
    catch { return undefined }
  }
  private async writeMetadata(metadata: StoredFileMetadata): Promise<void> {
    const target = this.metadataPath(metadata.key)
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    const previous = await this.readMetadataWithoutAccess(metadata.key)
    if (previous) {
      const versionTarget = safeLocalPath(path.join(storageConfig.localRoot, '.versions'), `${metadata.key}/${previous.version}.json`)
      await fs.promises.mkdir(path.dirname(versionTarget), { recursive: true })
      await fs.promises.writeFile(versionTarget, JSON.stringify(previous), { encoding: 'utf8', mode: 0o600 })
    }
    await fs.promises.writeFile(target, JSON.stringify(metadata), { encoding: 'utf8', mode: 0o600 })
  }

  private s3Metadata(metadata: StoredFileMetadata): Record<string, string> {
    return { owner: metadata.ownerId ?? '', checksum: metadata.checksum, version: metadata.version, public: String(metadata.isPublic ?? false) }
  }

  private localAdapter(): StorageAdapter {
    return {
      upload: async (key, body, metadata) => {
        const target = safeLocalPath(storageConfig.localRoot, key)
        await fs.promises.mkdir(path.dirname(target), { recursive: true })
        try {
          await fs.promises.access(target)
          await fs.promises.copyFile(target, `${target}.version-${metadata.version}`)
        } catch { /* first version */ }
        await fs.promises.writeFile(target, body, { mode: 0o600 })
      },
      download: async (key) => {
        try { return await fs.promises.readFile(safeLocalPath(storageConfig.localRoot, key)) }
        catch { throw new NotFoundError('File not found') }
      },
      delete: async (key) => { await fs.promises.rm(safeLocalPath(storageConfig.localRoot, key), { force: true }) },
    }
  }
}

export const storageService = new StorageService()
