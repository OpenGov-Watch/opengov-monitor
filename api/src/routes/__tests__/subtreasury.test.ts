/**
 * Subtreasury Route Tests
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { subtreasuryRouter } from "../subtreasury.js";
import Database from "better-sqlite3";

let testDb: Database.Database;

vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

// Mock auth middleware to allow all requests in tests
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/subtreasury", subtreasuryRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Categories" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT,
    "subcategory" TEXT
  );
  CREATE TABLE IF NOT EXISTS "Subtreasury" (
    "id" INTEGER PRIMARY KEY,
    "title" TEXT,
    "description" TEXT,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "DOT_component" REAL,
    "USDC_component" REAL,
    "USDT_component" REAL,
    "category_id" INTEGER,
    "latest_status_change" TEXT,
    "url" TEXT
  );
`;

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  app = createApp();
});

beforeEach(() => {
  testDb.exec('DELETE FROM "Subtreasury"');
  testDb.exec('DELETE FROM "Categories"');
  // Insert test categories
  testDb.exec(`
    INSERT INTO "Categories" (id, category, subcategory)
    VALUES
      (1, 'Development', 'Core'),
      (2, 'Marketing', 'Events')
  `);
});

afterAll(() => {
  testDb.close();
});

describe("GET /api/subtreasury", () => {
  it("returns empty array when no entries exist", async () => {
    const response = await request(app).get("/api/subtreasury");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns all subtreasury entries", async () => {
    testDb.exec(`
      INSERT INTO "Subtreasury" (id, title, description, DOT_latest, category_id)
      VALUES (1, 'Entry 1', 'Desc 1', 1000.5, 1),
             (2, 'Entry 2', 'Desc 2', 500.0, 2)
    `);

    const response = await request(app).get("/api/subtreasury");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].title).toBe("Entry 1");
  });
});

describe("GET /api/subtreasury/:id", () => {
  it("returns single entry by id", async () => {
    testDb.exec(`
      INSERT INTO "Subtreasury" (id, title, description, DOT_latest, category_id)
      VALUES (1, 'Entry 1', 'Description', 1000.5, 1)
    `);

    const response = await request(app).get("/api/subtreasury/1");

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(1);
    expect(response.body.title).toBe("Entry 1");
  });

  it("returns 404 for non-existent entry", async () => {
    const response = await request(app).get("/api/subtreasury/999");

    expect(response.status).toBe(404);
    expect(response.body.error).toContain("not found");
  });
});

describe("POST /api/subtreasury", () => {
  it("creates entry with valid data", async () => {
    const response = await request(app)
      .post("/api/subtreasury")
      .send({
        title: "New Entry",
        description: "Description",
        DOT_latest: 1000.0,
        USD_latest: 7500.0,
        category_id: 1,
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.title).toBe("New Entry");
  });

  it("creates entry with minimal data", async () => {
    const response = await request(app)
      .post("/api/subtreasury")
      .send({ title: "Minimal" });

    expect(response.status).toBe(201);
  });
});

describe("PUT /api/subtreasury/:id", () => {
  it("updates existing entry", async () => {
    testDb.exec(`
      INSERT INTO "Subtreasury" (id, title, description)
      VALUES (1, 'Original', 'Desc')
    `);

    const response = await request(app)
      .put("/api/subtreasury/1")
      .send({
        id: 1,
        title: "Updated",
        description: "New Description",
        DOT_latest: 2000.0,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify update
    const result = testDb.prepare('SELECT * FROM "Subtreasury" WHERE id = 1').get() as {
      title: string;
      description: string;
    };
    expect(result.title).toBe("Updated");
    expect(result.description).toBe("New Description");
  });
});

describe("DELETE /api/subtreasury/:id", () => {
  it("deletes existing entry", async () => {
    testDb.exec(`
      INSERT INTO "Subtreasury" (id, title)
      VALUES (1, 'ToDelete')
    `);

    const response = await request(app).delete("/api/subtreasury/1");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify deletion
    const result = testDb.prepare('SELECT * FROM "Subtreasury" WHERE id = 1').get();
    expect(result).toBeUndefined();
  });

  it("handles non-existent entry gracefully", async () => {
    const response = await request(app).delete("/api/subtreasury/999");

    expect(response.status).toBe(200);
  });
});

describe("Validation", () => {
  describe("POST /api/subtreasury", () => {
    it("returns 400 when title is missing", async () => {
      const response = await request(app)
        .post("/api/subtreasury")
        .send({ description: "Description only" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("title is required");
    });

    it("returns 400 when title is empty string", async () => {
      const response = await request(app)
        .post("/api/subtreasury")
        .send({ title: "", description: "Description" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("title is required");
    });

    it("returns 400 when title is whitespace only", async () => {
      const response = await request(app)
        .post("/api/subtreasury")
        .send({ title: "   ", description: "Description" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("title is required");
    });

    it("returns 400 when title is not a string", async () => {
      const response = await request(app)
        .post("/api/subtreasury")
        .send({ title: 123, description: "Description" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("title is required");
    });
  });

  describe("PUT /api/subtreasury/:id", () => {
    it("returns 400 when id is not a number", async () => {
      const response = await request(app)
        .put("/api/subtreasury/not-a-number")
        .send({ title: "Updated" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid id format");
    });

    it("returns 400 when title is missing", async () => {
      const response = await request(app)
        .put("/api/subtreasury/1")
        .send({ description: "Description only" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("title is required");
    });

    it("returns 400 when title is empty string", async () => {
      const response = await request(app)
        .put("/api/subtreasury/1")
        .send({ title: "", description: "Description" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("title is required");
    });
  });

  describe("DELETE /api/subtreasury/:id", () => {
    it("returns 400 when id is not a number", async () => {
      const response = await request(app).delete("/api/subtreasury/not-a-number");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid id format");
    });
  });
});
