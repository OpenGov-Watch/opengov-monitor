/**
 * Backup Route Tests
 *
 * Tests for the database backup API endpoints.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { backupRouter } from "../backup.js";
import Database from "better-sqlite3";

let testDb: Database.Database;

// Mock the db/index.js module to use test database
vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
  getLastWriteTimestamp: () => Date.now() - 10000, // 10 seconds ago
  DB_PATH: ":memory:",
}));

// Mock bcrypt for auth
vi.mock("bcrypt", () => ({
  default: {
    hash: async (password: string) => `hashed_${password}`,
    compare: async (password: string, hash: string) =>
      hash === `hashed_${password}`,
  },
}));

// Mock auth middleware
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.session?.userId) {
      next();
    } else {
      res.status(401).json({ error: "Authentication required" });
    }
  },
  requireAdmin: (req: any, res: any, next: any) => {
    // For tests, requireAdmin behaves like requireAuth since no ADMIN_USERNAMES is set
    // In production with no admins configured, all authenticated users can access
    if (req.session?.userId) {
      next();
    } else {
      res.status(401).json({ error: "Authentication required" });
    }
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
      cookie: {
        secure: false,
        sameSite: "lax",
      },
    })
  );
  app.use("/api/backup", backupRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "username" TEXT UNIQUE NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "TestData" (
    "id" INTEGER PRIMARY KEY,
    "value" TEXT
  );
`;

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  testDb.pragma("journal_mode = WAL");
  app = createApp();
});

beforeEach(() => {
  testDb.exec('DELETE FROM "Users"');
  testDb.exec('DELETE FROM "TestData"');
  // Insert test user
  testDb.exec(`
    INSERT INTO "Users" (id, username, password_hash)
    VALUES (1, 'testuser', 'hashed_testpass')
  `);
  // Insert test data
  testDb.exec(`
    INSERT INTO "TestData" (id, value)
    VALUES (1, 'test value')
  `);
});

afterAll(() => {
  testDb.close();
});

describe("Backup Routes", () => {
  describe("GET /api/backup/info", () => {
    it("returns 401 for unauthenticated user", async () => {
      const res = await request(app).get("/api/backup/info");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toBe("Authentication required");
    });

    it("requires authentication middleware", async () => {
      // Verify endpoint exists but requires auth
      const res = await request(app).get("/api/backup/info");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/backup/download", () => {
    it("returns 401 for unauthenticated user", async () => {
      const res = await request(app).get("/api/backup/download");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toBe("Authentication required");
    });

    it("requires authentication middleware", async () => {
      // Verify endpoint exists but requires auth
      const res = await request(app).get("/api/backup/download");
      expect(res.status).toBe(401);
    });
  });
});
