#!/usr/bin/env npx tsx
/**
 * CLI script for managing users in the OpenGov Monitor database.
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
import { hashPassword } from "../src/middleware/auth.js";
import {
  ensureUsersTable,
  createUser,
  getAllUsers,
  getUserByUsername,
  deleteUserByUsername,
} from "../src/db/auth-queries.js";

// Ensure Users table exists
ensureUsersTable();

/**
 * Prompt for password input (hidden).
 */
async function promptPassword(prompt: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Note: This doesn't actually hide input on all terminals,
    // but it's the best we can do without external dependencies
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

  const existing = getUserByUsername(username);
  if (existing) {
    console.error(`Error: User "${username}" already exists`);
    process.exit(1);
  }

  const password = await promptPassword("Enter password: ");
  if (!password || password.length < 8) {
    console.error("Error: Password must be at least 8 characters");
    process.exit(1);
  }

  const confirmPassword = await promptPassword("Confirm password: ");
  if (password !== confirmPassword) {
    console.error("Error: Passwords do not match");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const user = createUser(username, hash);

  console.log(`\nCreated user: ${user.username} (id: ${user.id})`);
}

/**
 * List all users.
 */
function listUsers(): void {
  const users = getAllUsers();

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
 * Delete a user.
 */
function removeUser(username: string): void {
  if (!username || username.trim() === "") {
    console.error("Error: Username is required");
    process.exit(1);
  }

  const user = getUserByUsername(username);
  if (!user) {
    console.error(`Error: User "${username}" not found`);
    process.exit(1);
  }

  const deleted = deleteUserByUsername(username);
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
  add <username>     Create a new user (will prompt for password)
  list               List all users
  delete <username>  Delete a user

Examples:
  npx tsx scripts/manage-users.ts add admin
  npx tsx scripts/manage-users.ts list
  npx tsx scripts/manage-users.ts delete olduser
`);
}

// Main CLI handler
async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);

  switch (command) {
    case "add":
      await addUser(arg);
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
