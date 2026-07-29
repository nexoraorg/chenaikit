import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { storageConfig } from '../config/storage'

export interface S3PutOptions { contentType: string; metadata: Record<string, string>; cacheControl?: string }

export class S3Service {
  private readonly client: S3Client
  private readonly bucket: string

  constructor() {
    this.bucket = storageConfig.s3.bucket
    this.client = new S3Client({
      region: storageConfig.s3.region,
      endpoint: storageConfig.s3.endpoint,
      forcePathStyle: storageConfig.s3.forcePathStyle,
      credentials: storageConfig.s3.accessKeyId && storageConfig.s3.secretAccessKey
        ? { accessKeyId: storageConfig.s3.accessKeyId, secretAccessKey: storageConfig.s3.secretAccessKey }
        : undefined,
    })
  }

  private requireBucket(): void { if (!this.bucket) throw new Error('STORAGE_S3_BUCKET is required') }

  async upload(key: string, body: Buffer, options: S3PutOptions): Promise<void> {
    this.requireBucket()
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: options.contentType, Metadata: options.metadata, CacheControl: options.cacheControl, ServerSideEncryption: 'AES256' }))
  }

  async download(key: string): Promise<Buffer> {
    this.requireBucket()
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!result.Body) throw new Error('S3 object has no body')
    return Buffer.from(await result.Body.transformToByteArray())
  }

  async delete(key: string): Promise<void> {
    this.requireBucket()
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async metadata(key: string): Promise<{ size: number; contentType?: string; metadata: Record<string, string>; versionId?: string }> {
    this.requireBucket()
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
    return { size: result.ContentLength ?? 0, contentType: result.ContentType, metadata: result.Metadata ?? {}, versionId: result.VersionId }
  }

  async signedDownloadUrl(key: string, expiresIn = storageConfig.signedUrlTtlSeconds): Promise<string> {
    this.requireBucket()
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn })
  }
}

export const s3Service = new S3Service()
