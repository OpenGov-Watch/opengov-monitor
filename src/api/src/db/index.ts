import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database paths relative to project root (api is in root/api)
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(PROJECT_ROOT, "data", "polkadot.db");

// Singleton pattern for database connections
let db: Database.Database | null = null;
let writeDb: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

export function getWritableDatabase(): Database.Database {
  if (!writeDb) {
    writeDb = new Database(DB_PATH, { readonly: false });
    writeDb.pragma("journal_mode = WAL");
  }
  return writeDb;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
  if (writeDb) {
    writeDb.close();
    writeDb = null;
  }
}

export { DB_PATH };
