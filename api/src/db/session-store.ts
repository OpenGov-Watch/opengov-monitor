/**
 * Custom session store for express-session using better-sqlite3.
 *
 * Uses a separate sessions.db file in the data directory to store session data.
 * This avoids conflicts with the main database and allows for easy cleanup.
 */

import type { SessionData, Store } from "express-session";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

const SESSIONS_DB_PATH =
  process.env.SESSIONS_DATABASE_PATH ||
  path.join(PROJECT_ROOT, "data", "sessions.db");

/**
 * Creates a session store compatible with express-session.
 *
 * The store uses better-sqlite3's synchronous API wrapped in the
 * callback-style interface that express-session expects.
 */
export function createSessionStore(): Store {
  // Initialize database and create table
  const db = new Database(SESSIONS_DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);
  `);

  // Prepared statements for efficiency
  const getStmt = db.prepare("SELECT sess FROM sessions WHERE sid = ? AND expires > ?");
  const setStmt = db.prepare(
    "INSERT OR REPLACE INTO sessions (sid, sess, expires) VALUES (?, ?, ?)"
  );
  const destroyStmt = db.prepare("DELETE FROM sessions WHERE sid = ?");
  const touchStmt = db.prepare("UPDATE sessions SET expires = ? WHERE sid = ?");
  const clearStmt = db.prepare("DELETE FROM sessions");
  const lengthStmt = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE expires > ?");
  const allStmt = db.prepare("SELECT sid, sess FROM sessions WHERE expires > ?");
  const cleanupStmt = db.prepare("DELETE FROM sessions WHERE expires <= ?");

  // Cleanup expired sessions periodically (every 15 minutes)
  const cleanupInterval = setInterval(() => {
    try {
      cleanupStmt.run(Date.now());
    } catch {
      // Ignore cleanup errors
    }
  }, 15 * 60 * 1000);
  cleanupInterval.unref(); // Don't prevent process exit

  // Return store object implementing express-session Store interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store: Store = {
    get(sid: string, callback: (err: Error | null, session?: SessionData | null) => void): void {
      try {
        const row = getStmt.get(sid, Date.now()) as { sess: string } | undefined;
        if (row) {
          callback(null, JSON.parse(row.sess) as SessionData);
        } else {
          callback(null, null);
        }
      } catch (err) {
        callback(err as Error);
      }
    },

    set(sid: string, session: SessionData, callback?: (err?: Error) => void): void {
      try {
        const maxAge = session.cookie?.maxAge ?? 24 * 60 * 60 * 1000; // Default 24 hours
        const expires = Date.now() + maxAge;
        setStmt.run(sid, JSON.stringify(session), expires);
        callback?.();
      } catch (err) {
        callback?.(err as Error);
      }
    },

    destroy(sid: string, callback?: (err?: Error) => void): void {
      try {
        destroyStmt.run(sid);
        callback?.();
      } catch (err) {
        callback?.(err as Error);
      }
    },

    touch(sid: string, session: SessionData, callback?: (err?: Error) => void): void {
      try {
        const maxAge = session.cookie?.maxAge ?? 24 * 60 * 60 * 1000;
        const expires = Date.now() + maxAge;
        touchStmt.run(expires, sid);
        callback?.();
      } catch (err) {
        callback?.(err as Error);
      }
    },

    clear(callback?: (err?: Error) => void): void {
      try {
        clearStmt.run();
        callback?.();
      } catch (err) {
        callback?.(err as Error);
      }
    },

    length(callback: (err: Error | null, length?: number) => void): void {
      try {
        const row = lengthStmt.get(Date.now()) as { count: number };
        callback(null, row.count);
      } catch (err) {
        callback(err as Error);
      }
    },

    all(
      callback: (err: Error | null, sessions?: { [sid: string]: SessionData } | null) => void
    ): void {
      try {
        const rows = allStmt.all(Date.now()) as Array<{ sid: string; sess: string }>;
        const sessions: { [sid: string]: SessionData } = {};
        for (const row of rows) {
          sessions[row.sid] = JSON.parse(row.sess) as SessionData;
        }
        callback(null, sessions);
      } catch (err) {
        callback(err as Error);
      }
    },

    // These methods are required by the Store interface but rarely used
    // Using type assertions because the complex generic types are hard to satisfy
    regenerate: ((_req, callback) => {
      callback();
    }) as Store["regenerate"],

    load: ((sid, callback) => {
      store.get(sid, callback as Parameters<typeof store.get>[1]);
    }) as Store["load"],

    createSession: ((_req, session) => {
      return session;
    }) as Store["createSession"],

    // EventEmitter methods (required by Store interface but we use minimal implementation)
    on: () => store,
    once: () => store,
    emit: () => false,
    addListener: () => store,
    removeListener: () => store,
    removeAllListeners: () => store,
    listeners: () => [],
    listenerCount: () => 0,
    prependListener: () => store,
    prependOnceListener: () => store,
    eventNames: () => [],
    off: () => store,
    setMaxListeners: () => store,
    getMaxListeners: () => 10,
    rawListeners: () => [],
  };

  return store;
}
