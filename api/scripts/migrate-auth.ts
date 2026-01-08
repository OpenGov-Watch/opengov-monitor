#!/usr/bin/env npx tsx
/**
 * Database migration for authentication tables.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx tsx scripts/migrate-auth.ts
 *
 * This script:
 * 1. Creates the Users table in the main database
 * 2. Creates the sessions database for session storage
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "../../data/polkadot.db");
const SESSIONS_DB_PATH = path.join(path.dirname(DB_PATH), "sessions.db");

console.log("Running authentication migration...\n");

// 1. Create Users table in main database
console.log(`Main database: ${DB_PATH}`);
const mainDb = new Database(DB_PATH);
mainDb.pragma("journal_mode = WAL");

mainDb.exec(`
  CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_users_username ON Users (username);
`);

const userCount = mainDb.prepare("SELECT COUNT(*) as count FROM Users").get() as { count: number };
console.log(`✓ Users table ready (${userCount.count} existing users)`);
mainDb.close();

// 2. Create sessions database
console.log(`\nSessions database: ${SESSIONS_DB_PATH}`);
const sessionsDb = new Database(SESSIONS_DB_PATH);
sessionsDb.pragma("journal_mode = WAL");

sessionsDb.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);
`);

const sessionCount = sessionsDb.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
console.log(`✓ Sessions table ready (${sessionCount.count} active sessions)`);
sessionsDb.close();

// Summary
console.log("\n" + "=".repeat(50));
console.log("Migration complete!\n");
console.log("Next steps:");
console.log("1. Set SESSION_SECRET environment variable");
console.log("   Generate one with: openssl rand -base64 32");
console.log("");
console.log("2. Create initial user:");
console.log("   pnpm users add <username>");
console.log("");
console.log("3. Restart the API server");
