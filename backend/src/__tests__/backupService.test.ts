import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'

// -----------------------------------------------------------------------
// Temporary filesystem space for each test run
// -----------------------------------------------------------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chenaikit-backup-test-'))
const testDbPath = path.join(tmpDir, 'test.db')
const testBackupDir = path.join(tmpDir, 'backups')
const testEncKey = crypto.randomBytes(32).toString('hex')

// -----------------------------------------------------------------------
// Mock backupConfig before any module that imports it is loaded
// -----------------------------------------------------------------------
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

jest.mock('../config/backup', () => ({
  backupConfig: {
    dir: testBackupDir,
    encryptionKey: testEncKey,
    retentionCount: 3,
    s3Region: 'us-east-1',
    s3Bucket: '',
    s3Prefix: 'chenaikit/db/',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    dbPath: testDbPath,
  },
}))

// Import after the mock is in place
import { BackupService } from '../services/backupService'
import { backupConfig } from '../config/backup'

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function createTestDb(dbPath: string): void {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT);
    INSERT INTO users (name) VALUES ('Alice'), ('Bob');
  `)
  db.close()
}

function countUsers(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true })
  const result = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }
  db.close()
  return result.cnt
}

// -----------------------------------------------------------------------
// Test lifecycle
// -----------------------------------------------------------------------

beforeEach(() => {
  createTestDb(testDbPath)
  fs.mkdirSync(testBackupDir, { recursive: true })
})

afterEach(() => {
  fs.rmSync(testDbPath, { force: true })
  fs.rmSync(testBackupDir, { recursive: true, force: true })
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// -----------------------------------------------------------------------
// BackupService.createBackup
// -----------------------------------------------------------------------

describe('BackupService.createBackup', () => {
  it('creates an encrypted gzip backup file in the backup directory', async () => {
    const service = new BackupService()
    const result = await service.createBackup()

    expect(result.filename).toMatch(/^backup-.+\.enc\.gz$/)
    expect(result.encrypted).toBe(true)
    expect(result.uploadedToS3).toBe(false)
    expect(result.sizeBytes).toBeGreaterThan(0)
    expect(fs.existsSync(result.localPath)).toBe(true)
  })

  it('backup contains a valid restorable snapshot of the database', async () => {
    const service = new BackupService()
    const result = await service.createBackup()

    // Wipe the live database to simulate data loss
    const db = new Database(testDbPath)
    db.exec('DELETE FROM users')
    db.close()
    expect(countUsers(testDbPath)).toBe(0)

    await service.restore(result.localPath)

    expect(countUsers(testDbPath)).toBe(2)
  })

  it('prunes oldest backups when retention limit is exceeded', async () => {
    const service = new BackupService()

    for (let i = 0; i < 5; i++) {
      await service.createBackup()
      // Timestamps must differ so filenames are unique
      await new Promise((r) => setTimeout(r, 20))
    }

    const files = fs.readdirSync(testBackupDir)
    expect(files).toHaveLength(3)  // retention = 3
  })
})

// -----------------------------------------------------------------------
// BackupService.restore
// -----------------------------------------------------------------------

describe('BackupService.restore', () => {
  it('restores from a local encrypted backup file', async () => {
    const service = new BackupService()
    const { localPath } = await service.createBackup()

    const db = new Database(testDbPath)
    db.exec('DROP TABLE users')
    db.close()

    await service.restore(localPath)
    expect(countUsers(testDbPath)).toBe(2)
  })

  it('throws when restoring an encrypted backup without the encryption key', async () => {
    const service = new BackupService()
    const { localPath } = await service.createBackup()

    const originalKey = backupConfig.encryptionKey
    Object.assign(backupConfig, { encryptionKey: '' })

    await expect(service.restore(localPath)).rejects.toThrow(/encryption/i)

    Object.assign(backupConfig, { encryptionKey: originalKey })
  })

  it('throws when the backup source file does not exist', async () => {
    const service = new BackupService()
    await expect(service.restore('/nonexistent/backup.enc.gz')).rejects.toThrow()
  })
})

// -----------------------------------------------------------------------
// BackupService.listLocalBackups
// -----------------------------------------------------------------------

describe('BackupService.listLocalBackups', () => {
  it('returns backup files sorted newest-first', async () => {
    const service = new BackupService()

    await service.createBackup()
    await new Promise((r) => setTimeout(r, 20))
    await service.createBackup()

    const list = await service.listLocalBackups()
    expect(list).toHaveLength(2)
    expect(list[0].createdAt.getTime()).toBeGreaterThanOrEqual(list[1].createdAt.getTime())
    for (const entry of list) {
      expect(entry.sizeBytes).toBeGreaterThan(0)
      expect(entry.filename).toBeTruthy()
    }
  })

  it('returns an empty array when no backup files exist', async () => {
    fs.rmSync(testBackupDir, { recursive: true, force: true })
    const service = new BackupService()
    await expect(service.listLocalBackups()).resolves.toEqual([])
  })
})
