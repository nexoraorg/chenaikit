import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DB_FILE = path.resolve(__dirname, "test-integration.db");
const PRISMA_SCHEMA_PATH = path.resolve(__dirname, "../../apps/backend/prisma/schema.prisma");

/**
 * Setup isolated test environment for backend API integration testing.
 * Configures DATABASE_URL to a test SQLite database and applies migrations/schema.
 */
export function setupTestEnvironment(): { dbUrl: string; dbPath: string } {
  process.env.NODE_ENV = "test";
  const dbUrl = `file:${TEST_DB_FILE}`;
  process.env.DATABASE_URL = dbUrl;

  // Clean up any existing test database file
  cleanupTestDatabase(TEST_DB_FILE);

  // Push backend Prisma schema onto isolated test DB
  execSync(`npx prisma db push --schema="${PRISMA_SCHEMA_PATH}" --skip-generate`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });

  return { dbUrl, dbPath: TEST_DB_FILE };
}

/**
 * Clean up test database file after test execution.
 */
export function cleanupTestDatabase(dbPath: string = TEST_DB_FILE): void {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const journalPath = `${dbPath}-journal`;
    if (fs.existsSync(journalPath)) {
      fs.unlinkSync(journalPath);
    }
  } catch (err) {
    console.warn("Failed to clean up test database file:", err);
  }
}
