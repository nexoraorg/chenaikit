import path from 'node:path'

export type StorageProvider = 'local' | 's3' | 'gcs' | 'azure'

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const listFromEnv = (name: string, fallback: string[]): string[] =>
  (process.env[name] ?? fallback.join(','))
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

export const storageConfig = {
  provider: (process.env.STORAGE_PROVIDER ?? 'local') as StorageProvider,
  mirrorProviders: listFromEnv('STORAGE_MIRROR_PROVIDERS', []) as StorageProvider[],
  localRoot: path.resolve(process.env.STORAGE_LOCAL_ROOT ?? path.join(process.cwd(), 'uploads')),
  maxFileSize: numberFromEnv('STORAGE_MAX_FILE_SIZE', 10 * 1024 * 1024),
  allowedMimeTypes: listFromEnv('STORAGE_ALLOWED_MIME_TYPES', [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
    'text/plain', 'text/csv', 'application/json', 'application/zip',
  ]),
  signedUrlTtlSeconds: numberFromEnv('STORAGE_SIGNED_URL_TTL_SECONDS', 900),
  signedUrlSecret: process.env.STORAGE_SIGNED_URL_SECRET ?? process.env.ACCESS_TOKEN_SECRET ?? '',
  cdnBaseUrl: (process.env.STORAGE_CDN_BASE_URL ?? '').replace(/\/$/, ''),
  cacheControl: process.env.STORAGE_CACHE_CONTROL ?? 'public, max-age=31536000, immutable',
  image: {
    maxWidth: numberFromEnv('STORAGE_IMAGE_MAX_WIDTH', 2048),
    maxHeight: numberFromEnv('STORAGE_IMAGE_MAX_HEIGHT', 2048),
    quality: numberFromEnv('STORAGE_IMAGE_QUALITY', 82),
    thumbnailWidth: numberFromEnv('STORAGE_THUMBNAIL_WIDTH', 320),
    thumbnailHeight: numberFromEnv('STORAGE_THUMBNAIL_HEIGHT', 320),
  },
  virusScanCommand: process.env.STORAGE_VIRUS_SCAN_COMMAND ?? '',
  s3: {
    bucket: process.env.STORAGE_S3_BUCKET ?? process.env.S3_BUCKET ?? '',
    region: process.env.STORAGE_S3_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
    forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
} as const

export const assertStorageConfig = (): void => {
  const providers = [storageConfig.provider, ...storageConfig.mirrorProviders]
  const supported: StorageProvider[] = ['local', 's3', 'gcs', 'azure']
  if (providers.some((provider) => !supported.includes(provider))) throw new Error('Unsupported storage provider')
  if (providers.includes('s3') && !storageConfig.s3.bucket) throw new Error('STORAGE_S3_BUCKET is required for S3 storage')
  if (!storageConfig.signedUrlSecret) throw new Error('STORAGE_SIGNED_URL_SECRET is required for local signed URLs')
}
