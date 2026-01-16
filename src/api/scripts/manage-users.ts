#!/usr/bin/env npx tsx
/**
 * CLI script for managing users in the OpenGov Monitor database.
 *
 * This script is standalone and doesn't depend on compiled app code,
 * so it works in both development and production containers.
 *
 * Usage:
 *   npx tsx scripts/manage-users.ts add <username>     # Create user (prompts for password)
 *   npx tsx scripts/manage-users.ts list               # List all users
 *   npx tsx scripts/manage-users.ts delete <username>  # Delete user
 *
 * Or via pnpm script:
 *   pnpm users add <username>
 *   pnpm users list
 *   pnpm users delete <username>
 */

import { createInterface } from "readline";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database path - check environment or use default relative path
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "../../../data/local/polkadot.db");

// Salt rounds for bcrypt
const SALT_ROUNDS = 12;

// User type
interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

/**
 * Get database connection.
 */
function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

/**
 * Ensure Users table exists.
 */
function ensureUsersTable(db: Database.Database): void {
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
 * Hash a password using bcrypt.
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Get user by username.
 */
function getUserByUsername(db: Database.Database, username: string): User | undefined {
  return db.prepare("SELECT * FROM Users WHERE username = ?").get(username) as User | undefined;
}

/**
 * Get all users.
 */
function getAllUsers(db: Database.Database): User[] {
  return db.prepare("SELECT id, username, created_at FROM Users ORDER BY id").all() as User[];
}

/**
 * Create a new user.
 */
function createUser(db: Database.Database, username: string, passwordHash: string): User {
  const result = db.prepare(
    "INSERT INTO Users (username, password_hash) VALUES (?, ?)"
  ).run(username, passwordHash);

  return {
    id: result.lastInsertRowid as number,
    username,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
  };
}

/**
 * Delete a user by username.
 */
function deleteUserByUsername(db: Database.Database, username: string): boolean {
  const result = db.prepare("DELETE FROM Users WHERE username = ?").run(username);
  return result.changes > 0;
}

/**
 * Prompt for password input.
 */
async function promptPassword(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Add a new user.
 */
async function addUser(username: string): Promise<void> {
  if (!username || username.trim() === "") {
    console.error("Error: Username is required");
    process.exit(1);
  }

  const db = getDb();
  ensureUsersTable(db);

  const existing = getUserByUsername(db, username);
  if (existing) {
    console.error(`Error: User "${username}" already exists`);
    db.close();
    process.exit(1);
  }

  const password = await promptPassword("Enter password: ");
  if (!password) {
    console.error("Error: Password is required");
    db.close();
    process.exit(1);
  }

  const confirmPassword = await promptPassword("Confirm password: ");
  if (password !== confirmPassword) {
    console.error("Error: Passwords do not match");
    db.close();
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const user = createUser(db, username, hash);
  db.close();

  console.log(`\nCreated user: ${user.username} (id: ${user.id})`);
}

/**
 * List all users.
 */
function listUsers(): void {
  const db = getDb();
  ensureUsersTable(db);

  const users = getAllUsers(db);
  db.close();

  if (users.length === 0) {
    console.log("No users found.");
    return;
  }

  console.log("\nUsers:");
  console.log("─".repeat(60));
  console.log("ID\tUsername\t\tCreated");
  console.log("─".repeat(60));

  for (const user of users) {
    const created = new Date(user.created_at).toLocaleString();
    console.log(`${user.id}\t${user.username}\t\t${created}`);
  }

  console.log("─".repeat(60));
  console.log(`Total: ${users.length} user(s)`);
}

/**
 * Update a user's password (non-interactive, for scripting).
 */
async function setPassword(username: string, password: string): Promise<void> {
  if (!username || username.trim() === "") {
    console.error("Error: Username is required");
    process.exit(1);
  }

  if (!password || password.trim() === "") {
    console.error("Error: Password is required");
    process.exit(1);
  }

  const db = getDb();
  ensureUsersTable(db);

  const user = getUserByUsername(db, username);
  if (!user) {
    console.error(`Error: User "${username}" not found`);
    db.close();
    process.exit(1);
  }

  const hash = await hashPassword(password);
  db.prepare("UPDATE Users SET password_hash = ? WHERE username = ?").run(hash, username);
  db.close();

  console.log(`Password updated for user: ${username}`);
}

/**
 * Delete a user.
 */
function removeUser(username: string): void {
  if (!username || username.trim() === "") {
    console.error("Error: Username is required");
    process.exit(1);
  }

  const db = getDb();
  ensureUsersTable(db);

  const user = getUserByUsername(db, username);
  if (!user) {
    console.error(`Error: User "${username}" not found`);
    db.close();
    process.exit(1);
  }

  const deleted = deleteUserByUsername(db, username);
  db.close();

  if (deleted) {
    console.log(`Deleted user: ${username}`);
  } else {
    console.error(`Error: Failed to delete user "${username}"`);
    process.exit(1);
  }
}

/**
 * Show usage help.
 */
function showHelp(): void {
  console.log(`
OpenGov Monitor User Management

Usage:
  npx tsx scripts/manage-users.ts <command> [options]

Commands:
  add <username>                  Create a new user (will prompt for password)
  set-password <username> <pass>  Set password (non-interactive)
  list                            List all users
  delete <username>               Delete a user

Examples:
  npx tsx scripts/manage-users.ts add admin
  npx tsx scripts/manage-users.ts set-password admin newpass123
  npx tsx scripts/manage-users.ts list
  npx tsx scripts/manage-users.ts delete olduser

Environment:
  DATABASE_PATH      Path to SQLite database (default: data/local/polkadot.db)
`);
}

// Main CLI handler
async function main(): Promise<void> {
  const [command, arg, arg2] = process.argv.slice(2);

  switch (command) {
    case "add":
      await addUser(arg);
      break;
    case "set-password":
      await setPassword(arg, arg2);
      break;
    case "list":
      listUsers();
      break;
    case "delete":
      removeUser(arg);
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      if (command) {
        console.error(`Unknown command: ${command}\n`);
      }
      showHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
