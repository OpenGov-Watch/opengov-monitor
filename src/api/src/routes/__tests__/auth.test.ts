/**
 * Auth Route Tests
 *
 * Tests for the authentication API endpoints.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { authRouter } from "../auth.js";
import Database from "better-sqlite3";

let testDb: Database.Database;

vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

// Mock bcrypt to avoid native module issues in tests
vi.mock("bcrypt", () => ({
  default: {
    hash: async (password: string) => `hashed_${password}`,
    compare: async (password: string, hash: string) => hash === `hashed_${password}`,
  },
}));

function createApp(options?: { trustProxy?: boolean; secureCookie?: boolean }): express.Express {
  const app = express();

  if (options?.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: options?.secureCookie ?? false,
        sameSite: "lax",
      },
    })
  );
  app.use("/api/auth", authRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "username" TEXT UNIQUE NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  app = createApp();
});

beforeEach(() => {
  testDb.exec('DELETE FROM "Users"');
  // Insert test user with mocked hash
  testDb.exec(`
    INSERT INTO "Users" (id, username, password_hash)
    VALUES (1, 'admin', 'hashed_password123')
  `);
});

afterAll(() => {
  testDb.close();
});

describe("GET /api/auth/me", () => {
  it("returns authenticated: false when not logged in", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  it("returns 401 for invalid username", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "nonexistent", password: "password123" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid username or password");
  });

  it("returns 401 for invalid password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrongpassword" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid username or password");
  });

  it("returns 400 for missing username", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ password: "password123" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Username is required");
  });

  it("returns 400 for missing password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Password is required");
  });

  it("returns success for valid credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "password123" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.username).toBe("admin");
    expect(response.body.user.id).toBe(1);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns success even when not logged in", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

describe("Session flow", () => {
  it("maintains session after login", async () => {
    const agent = request.agent(app);

    // Login
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "password123" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);

    // Check auth status
    const meRes = await agent.get("/api/auth/me");

    expect(meRes.status).toBe(200);
    expect(meRes.body.authenticated).toBe(true);
    expect(meRes.body.user.username).toBe("admin");
  });

  it("clears session after logout", async () => {
    const agent = request.agent(app);

    // Login
    await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "password123" });

    // Logout
    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);

    // Check auth status
    const meRes = await agent.get("/api/auth/me");
    expect(meRes.body.authenticated).toBe(false);
  });
});

describe("Reverse proxy session handling", () => {
  it("sets Secure cookie flag when trust proxy is enabled with X-Forwarded-Proto: https", async () => {
    // Simulate production: trust proxy enabled, secure cookies required
    const proxyApp = createApp({ trustProxy: true, secureCookie: true });

    // Login with X-Forwarded-Proto: https (simulating nginx)
    const loginRes = await request(proxyApp)
      .post("/api/auth/login")
      .set("X-Forwarded-Proto", "https")
      .send({ username: "admin", password: "password123" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);

    // Verify session cookie is set with Secure flag
    // This is the critical check: with trust proxy + X-Forwarded-Proto: https,
    // the cookie MUST have Secure flag for browsers to persist it
    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes("Secure"))).toBe(true);
    expect(cookies.some((c: string) => c.includes("SameSite=Lax"))).toBe(true);
  });

  it("does NOT set Secure cookie flag without trust proxy (production misconfiguration)", async () => {
    // Without trust proxy, Express doesn't see HTTPS and won't set secure cookie
    // This test documents the bug we fixed: missing trust proxy = broken sessions
    const noProxyApp = createApp({ trustProxy: false, secureCookie: true });

    // Login with X-Forwarded-Proto: https but trust proxy disabled
    const loginRes = await request(noProxyApp)
      .post("/api/auth/login")
      .set("X-Forwarded-Proto", "https")
      .send({ username: "admin", password: "password123" });

    expect(loginRes.status).toBe(200);

    // Cookie should NOT have Secure flag because Express doesn't trust the proxy
    // In production, this would cause session loss on reload (the original bug)
    const cookies = loginRes.headers["set-cookie"];
    if (cookies) {
      expect(cookies.some((c: string) => c.includes("Secure"))).toBe(false);
    }
  });
});
