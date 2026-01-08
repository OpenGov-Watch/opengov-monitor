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
  CREATE TABLE IF NOT EXISTS "Child Bounties" (
    "identifier" TEXT PRIMARY KEY,
    "description" TEXT,
    "status" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
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
  // Insert test data
  testDb.exec(`
    INSERT INTO "Child Bounties" (identifier, description, status, category, subcategory)
    VALUES
      ('1_23', 'Test CB 1', 'Claimed', NULL, NULL),
      ('2_45', 'Test CB 2', 'Active', NULL, NULL),
      ('3_67', 'Test CB 3', 'Pending', 'Development', 'SDK')
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
  it("updates category and subcategory", async () => {
    const response = await request(app)
      .patch("/api/child-bounties/1_23")
      .send({ category: "Development", subcategory: "Core" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const result = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      category: string;
      subcategory: string;
    };
    expect(result.category).toBe("Development");
    expect(result.subcategory).toBe("Core");
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
        category: "Outreach",
        subcategory: "Content",
        notes: "Full CB update",
        hide_in_spends: 1,
      });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      category: string;
      subcategory: string;
      notes: string;
      hide_in_spends: number;
    };
    expect(result.category).toBe("Outreach");
    expect(result.subcategory).toBe("Content");
    expect(result.notes).toBe("Full CB update");
    expect(result.hide_in_spends).toBe(1);
  });

  it("handles URL-encoded identifier with special characters", async () => {
    // Add a child bounty with special characters
    testDb.exec(`INSERT INTO "Child Bounties" (identifier, description) VALUES ('test/special', 'Special')`);

    const response = await request(app)
      .patch(`/api/child-bounties/${encodeURIComponent("test/special")}`)
      .send({ category: "Test" });

    expect(response.status).toBe(200);
  });

  it("clears category by setting to null", async () => {
    // First set a value
    await request(app)
      .patch("/api/child-bounties/1_23")
      .send({ category: "Development" });

    // Then clear it
    const response = await request(app)
      .patch("/api/child-bounties/1_23")
      .send({ category: null });

    expect(response.status).toBe(200);

    const result = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      category: string | null;
    };
    expect(result.category).toBeNull();
  });
});

describe("POST /api/child-bounties/import", () => {
  it("bulk updates multiple child bounties", async () => {
    const response = await request(app)
      .post("/api/child-bounties/import")
      .send({
        items: [
          { identifier: "1_23", category: "Dev", subcategory: "SDK" },
          { identifier: "2_45", category: "Marketing", subcategory: "Events" },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);

    const result1 = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("1_23") as {
      category: string;
    };
    expect(result1.category).toBe("Dev");

    const result2 = testDb.prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?').get("2_45") as {
      category: string;
    };
    expect(result2.category).toBe("Marketing");
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
          { identifier: "999_999", category: "Dev" },
          { identifier: "1000_1000", category: "Marketing" },
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
