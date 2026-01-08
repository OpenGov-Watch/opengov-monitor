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

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
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
