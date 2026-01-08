/**
 * Referenda Route Tests
 *
 * Tests for the referenda API endpoints including PATCH for single updates
 * and POST /import for bulk imports.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { referendaRouter } from "../referenda.js";
import Database from "better-sqlite3";

let testDb: Database.Database;

vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/referenda", referendaRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Categories" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT,
    "subcategory" TEXT
  );
  CREATE TABLE IF NOT EXISTS "Referenda" (
    "id" INTEGER PRIMARY KEY,
    "title" TEXT,
    "status" TEXT,
    "category_id" INTEGER,
    "notes" TEXT,
    "hide_in_spends" INTEGER
  );
`;

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  app = createApp();
});

beforeEach(() => {
  testDb.exec('DELETE FROM "Referenda"');
  testDb.exec('DELETE FROM "Categories"');
  // Insert test categories
  testDb.exec(`
    INSERT INTO "Categories" (id, category, subcategory)
    VALUES
      (1, 'Development', 'Core'),
      (2, 'Development', 'SDK'),
      (3, 'Outreach', 'Marketing')
  `);
  // Insert test data
  testDb.exec(`
    INSERT INTO "Referenda" (id, title, status, category_id)
    VALUES
      (1, 'Test Ref 1', 'Executed', NULL),
      (2, 'Test Ref 2', 'Approved', NULL),
      (3, 'Test Ref 3', 'Ongoing', 1)
  `);
});

afterAll(() => {
  testDb.close();
});

describe("GET /api/referenda", () => {
  it("returns all referenda", async () => {
    const response = await request(app).get("/api/referenda");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0].id).toBe(1);
  });
});

describe("PATCH /api/referenda/:id", () => {
  it("updates category_id", async () => {
    const response = await request(app)
      .patch("/api/referenda/1")
      .send({ category_id: 2 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const result = testDb.prepare('SELECT * FROM "Referenda" WHERE id = 1').get() as {
      category_id: number;
    };
    expect(result.category_id).toBe(2);
  });

  it("updates notes", async () => {
    const response = await request(app)
      .patch("/api/referenda/1")
      .send({ notes: "Test note" });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Referenda" WHERE id = 1').get() as {
      notes: string;
    };
    expect(result.notes).toBe("Test note");
  });

  it("updates hide_in_spends", async () => {
    const response = await request(app)
      .patch("/api/referenda/1")
      .send({ hide_in_spends: 1 });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Referenda" WHERE id = 1').get() as {
      hide_in_spends: number;
    };
    expect(result.hide_in_spends).toBe(1);
  });

  it("updates all fields at once", async () => {
    const response = await request(app)
      .patch("/api/referenda/1")
      .send({
        category_id: 3,
        notes: "Full update",
        hide_in_spends: 1,
      });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Referenda" WHERE id = 1').get() as {
      category_id: number;
      notes: string;
      hide_in_spends: number;
    };
    expect(result.category_id).toBe(3);
    expect(result.notes).toBe("Full update");
    expect(result.hide_in_spends).toBe(1);
  });

  it("clears category_id by setting to null", async () => {
    // First set a value
    await request(app)
      .patch("/api/referenda/1")
      .send({ category_id: 1 });

    // Then clear it
    const response = await request(app)
      .patch("/api/referenda/1")
      .send({ category_id: null });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Referenda" WHERE id = 1').get() as {
      category_id: number | null;
    };
    expect(result.category_id).toBeNull();
  });
});

describe("POST /api/referenda/import", () => {
  it("bulk updates multiple referenda", async () => {
    const response = await request(app)
      .post("/api/referenda/import")
      .send({
        items: [
          { id: 1, category_id: 1 },
          { id: 2, category_id: 3 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);

    const result1 = testDb.prepare('SELECT * FROM "Referenda" WHERE id = 1').get() as {
      category_id: number;
    };
    expect(result1.category_id).toBe(1);

    const result2 = testDb.prepare('SELECT * FROM "Referenda" WHERE id = 2').get() as {
      category_id: number;
    };
    expect(result2.category_id).toBe(3);
  });

  it("handles partial updates in bulk import", async () => {
    const response = await request(app)
      .post("/api/referenda/import")
      .send({
        items: [
          { id: 1, notes: "Note only" },
          { id: 2, hide_in_spends: 1 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);

    const result1 = testDb.prepare('SELECT * FROM "Referenda" WHERE id = 1').get() as {
      notes: string;
    };
    expect(result1.notes).toBe("Note only");
  });

  it("returns 400 when items is not an array", async () => {
    const response = await request(app)
      .post("/api/referenda/import")
      .send({ items: "not an array" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("items must be an array");
  });

  it("returns count 0 when no IDs match", async () => {
    const response = await request(app)
      .post("/api/referenda/import")
      .send({
        items: [
          { id: 999, category_id: 1 },
          { id: 1000, category_id: 2 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
  });

  it("handles empty array", async () => {
    const response = await request(app)
      .post("/api/referenda/import")
      .send({ items: [] });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
  });
});
