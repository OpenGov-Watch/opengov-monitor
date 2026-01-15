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
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<User | null> {
  const user = getUserByUsername(username);
  if (!user) {
    return null;
  }

  const valid = await verifyPassword(password, user.password_hash);
  return valid ? user : null;
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
