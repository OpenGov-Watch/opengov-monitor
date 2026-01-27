/**
 * Authentication middleware and utilities.
 *
 * Provides password hashing, verification, and route protection.
 */

import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { getUserByUsername, type User } from "../db/auth-queries.js";

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
  }
}

const SALT_ROUNDS = 12;

/**
 * Hash a password for storage.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a stored hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Attempt to authenticate a user with username and password.
 * Returns the user if successful, null otherwise.
 *
 * Uses constant-time comparison to prevent timing attacks that could
 * be used for user enumeration.
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<User | null> {
  const user = getUserByUsername(username);

  // Always run bcrypt comparison to prevent timing-based user enumeration.
  // Use a dummy hash when user doesn't exist to maintain constant time.
  // This hash is valid bcrypt format but will never match any real password.
  const DUMMY_HASH = "$2b$12$K4G./.Xk5Y/hzj6kNnp5ru1GvZ8xJ1Qpz9NhXvX3w6H3QKv6hXZ3S";
  const hashToCompare = user?.password_hash ?? DUMMY_HASH;

  const valid = await verifyPassword(password, hashToCompare);
  return user && valid ? user : null;
}

/**
 * Middleware that requires authentication.
 * Returns 401 if no valid session exists.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

/**
 * Middleware that attaches user info to request if authenticated.
 * Does not block unauthenticated requests.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  // Session data is already available via req.session if authenticated
  next();
}

/**
 * Get the list of admin usernames from environment variable.
 * ADMIN_USERNAMES should be a comma-separated list of usernames.
 */
function getAdminUsernames(): Set<string> {
  const adminEnv = process.env.ADMIN_USERNAMES || "";
  return new Set(
    adminEnv
      .split(",")
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Track if we've already warned about missing admin config (to avoid log spam)
let hasWarnedAboutMissingAdmins = false;

/**
 * Middleware that requires admin privileges.
 * Returns 401 if not authenticated, 403 if not admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId || !req.session?.username) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const adminUsernames = getAdminUsernames();

  // If no admins configured, all authenticated users can access (backwards compatibility)
  // Log a warning once to alert operators
  if (adminUsernames.size === 0) {
    if (!hasWarnedAboutMissingAdmins) {
      console.warn(
        "WARNING: ADMIN_USERNAMES environment variable not configured. " +
        "All authenticated users have admin access. " +
        "Set ADMIN_USERNAMES to a comma-separated list of admin usernames to restrict access."
      );
      hasWarnedAboutMissingAdmins = true;
    }
    next();
    return;
  }

  // Check if current user is admin
  if (!adminUsernames.has(req.session.username.toLowerCase())) {
    res.status(403).json({ error: "Admin privileges required" });
    return;
  }

  next();
}
