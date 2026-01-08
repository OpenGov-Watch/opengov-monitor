/**
 * Child Bounties Route Tests
 *
 * Tests for the child bounties API endpoints including PATCH for single updates
 * and POST /import for bulk imports.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { childBountiesRouter } from "../child-bounties.js";
import Database from "better-sqlite3";

let testDb: Database.Database;

vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/child-bounties", childBountiesRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Categories" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT,
    "subcategory" TEXT
  );
  CREATE TABLE IF NOT EXISTS "Child Bounties" (
    "identifier" TEXT PRIMARY KEY,
    "description" TEXT,
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
  testDb.exec('DELETE FROM "Child Bounties"');
  testDb.exec('DELETE FROM "Categories"');
  // Insert test categories
  testDb.exec(`
    INSERT INTO "Categories" (id, category, subcategory)
    VALUES
      (1, 'Development', 'SDK'),
      (2, 'Development', 'Core'),
      (3, 'Outreach', 'Content')
  `);
  // Insert test data
  testDb.exec(`
    INSERT INTO "Child Bounties" (identifier, description, status, category_id)
    VALUES
      ('1_23', 'Test CB 1', 'Claimed', NULL),
      ('2_45', 'Test CB 2', 'Active', NULL),
      ('3_67', 'Test CB 3', 'Pending', 1)
  `);
});

afterAll(() => {
  testDb.close();
});

describe("GET /api/child-bounties", () => {
  it("returns all child bounties", async () => {
    const response = await request(app).get("/api/child-bounties");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0].identifier).toBe("1_23");
  });
});

describe("PATCH /api/child-bounties/:identifier", () => {
  it("updates category_id", async () => {
    const response = await request(app)
      .patch("/api/child-bounties/1_23")
      .send({ category_id: 2 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const result = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      category_id: number;
    };
    expect(result.category_id).toBe(2);
  });

  it("updates notes", async () => {
    const response = await request(app)
      .patch("/api/child-bounties/1_23")
      .send({ notes: "Test note for CB" });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      notes: string;
    };
    expect(result.notes).toBe("Test note for CB");
  });

  it("updates hide_in_spends", async () => {
    const response = await request(app)
      .patch("/api/child-bounties/1_23")
      .send({ hide_in_spends: 1 });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      hide_in_spends: number;
    };
    expect(result.hide_in_spends).toBe(1);
  });

  it("updates all fields at once", async () => {
    const response = await request(app)
      .patch("/api/child-bounties/1_23")
      .send({
        category_id: 3,
        notes: "Full CB update",
        hide_in_spends: 1,
      });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      category_id: number;
      notes: string;
      hide_in_spends: number;
    };
    expect(result.category_id).toBe(3);
    expect(result.notes).toBe("Full CB update");
    expect(result.hide_in_spends).toBe(1);
  });

  it("handles URL-encoded identifier with special characters", async () => {
    // Add a child bounty with special characters
    testDb.exec(`INSERT INTO "Child Bounties" (identifier, description) VALUES ('test/special', 'Special')`);

    const response = await request(app)
      .patch(`/api/child-bounties/${encodeURIComponent("test/special")}`)
      .send({ category_id: 1 });

    expect(response.status).toBe(200);
  });

  it("clears category_id by setting to null", async () => {
    // First set a value
    await request(app)
      .patch("/api/child-bounties/1_23")
      .send({ category_id: 1 });

    // Then clear it
    const response = await request(app)
      .patch("/api/child-bounties/1_23")
      .send({ category_id: null });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      category_id: number | null;
    };
    expect(result.category_id).toBeNull();
  });
});

describe("POST /api/child-bounties/import", () => {
  it("bulk updates multiple child bounties", async () => {
    const response = await request(app)
      .post("/api/child-bounties/import")
      .send({
        items: [
          { identifier: "1_23", category_id: 1 },
          { identifier: "2_45", category_id: 3 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);

    const result1 = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      category_id: number;
    };
    expect(result1.category_id).toBe(1);

    const result2 = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("2_45") as {
      category_id: number;
    };
    expect(result2.category_id).toBe(3);
  });

  it("handles partial updates in bulk import", async () => {
    const response = await request(app)
      .post("/api/child-bounties/import")
      .send({
        items: [
          { identifier: "1_23", notes: "Note only" },
          { identifier: "2_45", hide_in_spends: 1 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);

    const result1 = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      notes: string;
    };
    expect(result1.notes).toBe("Note only");
  });

  it("returns 400 when items is not an array", async () => {
    const response = await request(app)
      .post("/api/child-bounties/import")
      .send({ items: "not an array" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("items must be an array");
  });

  it("returns count 0 when no identifiers match", async () => {
    const response = await request(app)
      .post("/api/child-bounties/import")
      .send({
        items: [
          { identifier: "999_999", category_id: 1 },
          { identifier: "1000_1000", category_id: 2 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
  });

  it("handles empty array", async () => {
    const response = await request(app)
      .post("/api/child-bounties/import")
      .send({ items: [] });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
  });
});
