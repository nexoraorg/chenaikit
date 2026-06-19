import crypto from 'node:crypto'
import zlib from 'node:zlib'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'

const IV_LENGTH = 12   // AES-GCM recommended IV size
const TAG_LENGTH = 16  // GCM auth tag

/**
 * Compress a file with gzip and write the result to destPath.
 */
export async function compressFile(srcPath: string, destPath: string): Promise<void> {
  await pipeline(
    fs.createReadStream(srcPath),
    zlib.createGzip(),
    fs.createWriteStream(destPath),
  )
}

/**
 * Decompress a gzip file and write the result to destPath.
 */
export async function decompressFile(srcPath: string, destPath: string): Promise<void> {
  await pipeline(
    fs.createReadStream(srcPath),
    zlib.createGunzip(),
    fs.createWriteStream(destPath),
  )
}

/**
 * Encrypt a file using AES-256-GCM.
 * Output format: [iv (12 bytes)][auth tag (16 bytes)][ciphertext]
 *
 * @param srcPath     Plaintext input file path
 * @param destPath    Encrypted output file path
 * @param hexKey      32-byte encryption key as a 64-char hex string
 */
export async function encryptFile(srcPath: string, destPath: string, hexKey: string): Promise<void> {
  const key = Buffer.from(hexKey, 'hex')
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (64 hex chars)')

  const plaintext = await fs.promises.readFile(srcPath)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  // Layout: [iv][tag][ciphertext]
  await fs.promises.writeFile(destPath, Buffer.concat([iv, tag, ciphertext]))
}

/**
 * Decrypt a file that was encrypted with encryptFile.
 */
export async function decryptFile(srcPath: string, destPath: string, hexKey: string): Promise<void> {
  const key = Buffer.from(hexKey, 'hex')
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (64 hex chars)')

  const data = await fs.promises.readFile(srcPath)
  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  await fs.promises.writeFile(destPath, plaintext)
}

/**
 * Build a timestamped backup filename.
 * Pattern: backup-YYYY-MM-DDTHH-mm-ssZ[.enc].gz
 */
export function buildBackupFilename(encrypted: boolean): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  return encrypted ? `backup-${ts}.enc.gz` : `backup-${ts}.gz`
}

/**
 * Upload a file to S3 using a plain HTTPS PUT request signed with AWS Sig V4.
 * Does not require @aws-sdk — uses only Node.js built-ins.
 */
export async function uploadToS3(params: {
  filePath: string
  bucket: string
  key: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}): Promise<void> {
  const { filePath, bucket, key, region, accessKeyId, secretAccessKey } = params
  const body = await fs.promises.readFile(filePath)
  const host = `${bucket}.s3.${region}.amazonaws.com`
  const url = `https://${host}/${key}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)

  const contentHash = crypto.createHash('sha256').update(body).digest('hex')
  const contentType = 'application/octet-stream'

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${contentHash}\n` +
    `x-amz-date:${amzDate}\n`

  const canonicalRequest = [
    'PUT',
    `/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    contentHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest()

  const signingKey = hmac(
    hmac(
      hmac(
        hmac(`AWS4${secretAccessKey}`, dateStamp),
        region,
      ),
      's3',
    ),
    'aws4_request',
  )

  const signature = hmac(signingKey, stringToSign).toString('hex')

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'x-amz-content-sha256': contentHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`S3 upload failed (${response.status}): ${text}`)
  }
}

/**
 * Download an object from S3 to a local file using AWS Sig V4.
 */
export async function downloadFromS3(params: {
  destPath: string
  bucket: string
  key: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}): Promise<void> {
  const { destPath, bucket, key, region, accessKeyId, secretAccessKey } = params
  const host = `${bucket}.s3.${region}.amazonaws.com`
  const url = `https://${host}/${key}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)

  const contentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'  // sha256('')

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${contentHash}\n` +
    `x-amz-date:${amzDate}\n`

  const canonicalRequest = ['GET', `/${key}`, '', canonicalHeaders, signedHeaders, contentHash].join('\n')

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest()

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), 's3'),
    'aws4_request',
  )

  const signature = hmac(signingKey, stringToSign).toString('hex')
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Host: host,
      'x-amz-content-sha256': contentHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`S3 download failed (${response.status}): ${text}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  await fs.promises.writeFile(destPath, Buffer.from(arrayBuffer))
}
