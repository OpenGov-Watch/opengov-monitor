/**
 * Rate limiting middleware for API endpoints.
 *
 * Provides different rate limits for:
 * - General read requests (high limit)
 * - Write operations (moderate limit)
 * - Authentication attempts (strict limit)
 */

import rateLimit from "express-rate-limit";

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
});
