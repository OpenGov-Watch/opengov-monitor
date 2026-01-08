/**
 * User authentication database queries.
 *
 * Uses the main database (polkadot.db) for user storage.
 * The Users table is created by the migration script or backend sync.
 */

import { getDatabase, getWritableDatabase } from "./index.js";

export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface PublicUser {
  id: number;
  username: string;
  created_at: string;
}

/**
 * Ensures the Users table exists. Called on startup.
 */
export function ensureUsersTable(): void {
  const db = getWritableDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON Users (username);
  `);
}

/**
 * Get a user by username (for login).
 */
export function getUserByUsername(username: string): User | undefined {
  const db = getDatabase();
  return db
    .prepare("SELECT id, username, password_hash, created_at FROM Users WHERE username = ?")
    .get(username) as User | undefined;
}

/**
 * Get a user by ID (for session lookup).
 */
export function getUserById(id: number): User | undefined {
  const db = getDatabase();
  return db
    .prepare("SELECT id, username, password_hash, created_at FROM Users WHERE id = ?")
    .get(id) as User | undefined;
}

/**
 * Get all users (without password hashes, for admin listing).
 */
export function getAllUsers(): PublicUser[] {
  const db = getDatabase();
  return db
    .prepare("SELECT id, username, created_at FROM Users ORDER BY created_at DESC")
    .all() as PublicUser[];
}

/**
 * Create a new user.
 */
export function createUser(username: string, passwordHash: string): User {
  const db = getWritableDatabase();
  const result = db
    .prepare("INSERT INTO Users (username, password_hash) VALUES (?, ?)")
    .run(username, passwordHash);

  return {
    id: result.lastInsertRowid as number,
    username,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
  };
}

/**
 * Delete a user by ID.
 */
export function deleteUserById(id: number): boolean {
  const db = getWritableDatabase();
  const result = db.prepare("DELETE FROM Users WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Delete a user by username.
 */
export function deleteUserByUsername(username: string): boolean {
  const db = getWritableDatabase();
  const result = db.prepare("DELETE FROM Users WHERE username = ?").run(username);
  return result.changes > 0;
}

/**
 * Check if any users exist (for initial setup detection).
 */
export function hasUsers(): boolean {
  const db = getDatabase();
  const result = db.prepare("SELECT COUNT(*) as count FROM Users").get() as { count: number };
  return result.count > 0;
}
