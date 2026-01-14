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

// Check if database file exists
function checkDatabaseExists(): void {
  if (!fs.existsSync(DB_PATH)) {
    const errorMsg = [
      `Database file not found at: ${DB_PATH}`,
      '',
      'The database needs to be initialized first. Please run:',
      '  cd backend && source .venv/bin/activate',
      '  python scripts/run_sqlite.py --db ../data/polkadot.db',
      '',
      'This will fetch data from Subsquare and populate the database.',
    ].join('\n');
    throw new Error(errorMsg);
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    checkDatabaseExists();
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

export function getWritableDatabase(): Database.Database {
  if (!writeDb) {
    checkDatabaseExists();
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
