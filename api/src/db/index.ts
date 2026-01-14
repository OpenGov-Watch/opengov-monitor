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
    // Check if database exists before opening in readonly mode
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(
        `Database not found at ${DB_PATH}. ` +
        `In production, ensure migrations have run successfully. ` +
        `In development, run: cd backend && source .venv/bin/activate && python scripts/run_sqlite.py --db ${DB_PATH}`
      );
    }
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

export function getWritableDatabase(): Database.Database {
  if (!writeDb) {
    // Check if database exists before opening
    // Note: readonly: false will create the database if it doesn't exist,
    // but in production we want migrations to create it
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(
        `Database not found at ${DB_PATH}. ` +
        `In production, ensure migrations have run successfully. ` +
        `In development, run: cd backend && source .venv/bin/activate && python scripts/run_sqlite.py --db ${DB_PATH}`
      );
    }
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
