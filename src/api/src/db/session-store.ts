/**
 * Custom session store for express-session using better-sqlite3.
 *
 * Uses a separate sessions.db file in the data directory to store session data.
 * This avoids conflicts with the main database and allows for easy cleanup.
 */

import session from "express-session";
import type { SessionData } from "express-session";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

const SESSIONS_DB_PATH =
  process.env.SESSIONS_DATABASE_PATH ||
  path.join(PROJECT_ROOT, "data", "local", "sessions.db");

/**
 * SQLite-based session store that properly extends express-session's Store class.
 */
class SQLiteStore extends session.Store {
  private db: Database.Database;
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private destroyStmt: Database.Statement;
  private touchStmt: Database.Statement;
  private clearStmt: Database.Statement;
  private lengthStmt: Database.Statement;
  private allStmt: Database.Statement;
  private cleanupStmt: Database.Statement;

  constructor() {
    super();

    // Initialize database and create table
    this.db = new Database(SESSIONS_DB_PATH);
    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);
    `);

    // Prepared statements for efficiency
    this.getStmt = this.db.prepare("SELECT sess FROM sessions WHERE sid = ? AND expires > ?");
    this.setStmt = this.db.prepare(
      "INSERT OR REPLACE INTO sessions (sid, sess, expires) VALUES (?, ?, ?)"
    );
    this.destroyStmt = this.db.prepare("DELETE FROM sessions WHERE sid = ?");
    this.touchStmt = this.db.prepare("UPDATE sessions SET expires = ? WHERE sid = ?");
    this.clearStmt = this.db.prepare("DELETE FROM sessions");
    this.lengthStmt = this.db.prepare("SELECT COUNT(*) as count FROM sessions WHERE expires > ?");
    this.allStmt = this.db.prepare("SELECT sid, sess FROM sessions WHERE expires > ?");
    this.cleanupStmt = this.db.prepare("DELETE FROM sessions WHERE expires <= ?");

    // Cleanup expired sessions periodically (every 15 minutes)
    const cleanupInterval = setInterval(() => {
      try {
        this.cleanupStmt.run(Date.now());
      } catch {
        // Ignore cleanup errors
      }
    }, 15 * 60 * 1000);
    cleanupInterval.unref(); // Don't prevent process exit
  }

  get(sid: string, callback: (err: Error | null, session?: SessionData | null) => void): void {
    try {
      const row = this.getStmt.get(sid, Date.now()) as { sess: string } | undefined;
      if (row) {
        callback(null, JSON.parse(row.sess) as SessionData);
      } else {
        callback(null, null);
      }
    } catch (err) {
      callback(err as Error);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: Error) => void): void {
    try {
      const maxAge = session.cookie?.maxAge ?? 24 * 60 * 60 * 1000; // Default 24 hours
      const expires = Date.now() + maxAge;
      this.setStmt.run(sid, JSON.stringify(session), expires);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  destroy(sid: string, callback?: (err?: Error) => void): void {
    try {
      this.destroyStmt.run(sid);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  touch(sid: string, session: SessionData, callback?: (err?: Error) => void): void {
    try {
      const maxAge = session.cookie?.maxAge ?? 24 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      this.touchStmt.run(expires, sid);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  clear(callback?: (err?: Error) => void): void {
    try {
      this.clearStmt.run();
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  length(callback: (err: Error | null, length?: number) => void): void {
    try {
      const row = this.lengthStmt.get(Date.now()) as { count: number };
      callback(null, row.count);
    } catch (err) {
      callback(err as Error);
    }
  }

  all(
    callback: (err: Error | null, sessions?: { [sid: string]: SessionData } | null) => void
  ): void {
    try {
      const rows = this.allStmt.all(Date.now()) as Array<{ sid: string; sess: string }>;
      const sessions: { [sid: string]: SessionData } = {};
      for (const row of rows) {
        sessions[row.sid] = JSON.parse(row.sess) as SessionData;
      }
      callback(null, sessions);
    } catch (err) {
      callback(err as Error);
    }
  }

  close(): void {
    try {
      if (this.db) {
        this.db.close();
      }
    } catch (err) {
      console.error("Error closing session store:", err);
    }
  }
}

let sessionStoreInstance: SQLiteStore | null = null;

/**
 * Creates a session store compatible with express-session.
 * Uses singleton pattern to maintain reference for cleanup.
 */
export function createSessionStore(): session.Store {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new SQLiteStore();
  }
  return sessionStoreInstance;
}

/**
 * Closes the session store database connection.
 * Should be called during graceful shutdown.
 */
export function closeSessionStore(): void {
  if (sessionStoreInstance) {
    sessionStoreInstance.close();
    sessionStoreInstance = null;
  }
}
