/**
 * Rate Limit Middleware Tests
 *
 * Tests for the rate limiting middleware.
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { generalLimiter, writeLimiter, authLimiter } from "../rate-limit.js";

function createTestApp(limiter: ReturnType<typeof import("express-rate-limit").default>) {
  const app = express();
  app.use(limiter);
  app.get("/test", (_req, res) => res.json({ ok: true }));
  app.post("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("Rate limit middleware exports", () => {
  it("exports generalLimiter", () => {
    expect(generalLimiter).toBeDefined();
    expect(typeof generalLimiter).toBe("function");
  });

  it("exports writeLimiter", () => {
    expect(writeLimiter).toBeDefined();
    expect(typeof writeLimiter).toBe("function");
  });

  it("exports authLimiter", () => {
    expect(authLimiter).toBeDefined();
    expect(typeof authLimiter).toBe("function");
  });
});

describe("Rate limit headers", () => {
  it("includes rate limit headers in response", async () => {
    const app = createTestApp(generalLimiter);

    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(response.headers["ratelimit-limit"]).toBeDefined();
    expect(response.headers["ratelimit-remaining"]).toBeDefined();
    expect(response.headers["ratelimit-reset"]).toBeDefined();
  });
});

describe("Rate limit error response", () => {
  it("returns JSON error message when rate limited", async () => {
    // Create a limiter with very low limit for testing
    const { default: rateLimit } = await import("express-rate-limit");
    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 1,
      message: { error: "Too many requests, please try again later" },
      standardHeaders: true,
      legacyHeaders: false,
    });

    const app = createTestApp(testLimiter);

    // First request should succeed
    const first = await request(app).get("/test");
    expect(first.status).toBe(200);

    // Second request should be rate limited
    const second = await request(app).get("/test");
    expect(second.status).toBe(429);
    expect(second.body.error).toBe("Too many requests, please try again later");
  });
});
