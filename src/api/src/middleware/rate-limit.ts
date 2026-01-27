/**
 * Rate limiting middleware for API endpoints.
 *
 * Provides different rate limits for:
 * - General read requests (high limit)
 * - Write operations (moderate limit)
 * - Authentication attempts (strict limit)
 */

import rateLimit from "express-rate-limit";
import type { Request } from "express";

/**
 * Custom key generator that validates IP format to prevent spoofing.
 * Falls back to socket address if req.ip looks suspicious.
 *
 * SECURITY: req.ip is derived from X-Forwarded-For when trust proxy is set.
 * Validate it looks like a valid IP to prevent malformed header injection.
 */
function getValidatedIp(req: Request): string {
  const ip = req.ip || "unknown";
  // Basic IP format validation (IPv4 or IPv6 characters only)
  // IPv4: digits and dots, IPv6: hex digits, colons, and dots (for mapped addresses)
  if (/^[\d.:a-fA-F]+$/.test(ip)) {
    return ip;
  }
  // Fallback to socket address if IP looks suspicious
  return req.socket.remoteAddress || "unknown";
}

// Shared validation config - disable keyGeneratorIpFallback since we do our own IP validation
const validateConfig = { keyGeneratorIpFallback: false };

/**
 * General rate limiter for all API requests.
 * 5000 requests per 15 minutes per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getValidatedIp,
  validate: validateConfig,
});

/**
 * Rate limiter for write operations (POST, PUT, PATCH, DELETE).
 * 500 requests per 15 minutes per IP.
 */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: "Too many write operations, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getValidatedIp,
  validate: validateConfig,
});

/**
 * Strict rate limiter for authentication endpoints.
 * 20 failed attempts per 15 minutes per IP.
 * Successful requests don't count against the limit.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getValidatedIp,
  validate: validateConfig,
});
