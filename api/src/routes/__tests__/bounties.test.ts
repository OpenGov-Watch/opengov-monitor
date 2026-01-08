/**
 * Bounties Route Tests
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { bountiesRouter } from "../bounties.js";
import Database from "better-sqlite3";

let testDb: Database.Database;

vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/bounties", bountiesRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Bounties" (
    "id" INTEGER PRIMARY KEY,
    "name" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "remaining_dot" REAL,
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
  testDb.exec('DELETE FROM "Bounties"');
});

afterAll(() => {
  testDb.close();
});

describe("GET /api/bounties", () => {
  it("returns empty array when no bounties exist", async () => {
    const response = await request(app).get("/api/bounties");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns all bounties", async () => {
    testDb.exec(`
      INSERT INTO "Bounties" (id, name, category, subcategory, remaining_dot, url)
      VALUES (1, 'Bounty 1', 'Development', 'Core', 1000.5, 'https://example.com/1'),
             (2, 'Bounty 2', 'Marketing', null, 500.0, 'https://example.com/2')
    `);

    const response = await request(app).get("/api/bounties");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    const names = response.body.map((b: { name: string }) => b.name);
    expect(names).toContain("Bounty 1");
    expect(names).toContain("Bounty 2");
  });
});

describe("GET /api/bounties/:id", () => {
  it("returns single bounty by id", async () => {
    testDb.exec(`
      INSERT INTO "Bounties" (id, name, category, subcategory, remaining_dot, url)
      VALUES (1, 'Bounty 1', 'Development', 'Core', 1000.5, 'https://example.com/1')
    `);

    const response = await request(app).get("/api/bounties/1");

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(1);
    expect(response.body.name).toBe("Bounty 1");
    expect(response.body.category).toBe("Development");
  });

  it("returns 404 for non-existent bounty", async () => {
    const response = await request(app).get("/api/bounties/999");

    expect(response.status).toBe(404);
    expect(response.body.error).toContain("not found");
  });
});

describe("POST /api/bounties", () => {
  it("creates bounty with valid data", async () => {
    const response = await request(app)
      .post("/api/bounties")
      .send({
        id: 1,
        name: "New Bounty",
        category: "Development",
        subcategory: "Core",
        remaining_dot: 1000.0,
        url: "https://example.com/new",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    // Verify in database
    const result = testDb.prepare('SELECT * FROM "Bounties" WHERE id = 1').get() as {
      name: string;
    };
    expect(result.name).toBe("New Bounty");
  });

  it("creates bounty with minimal data", async () => {
    const response = await request(app)
      .post("/api/bounties")
      .send({ id: 1 });

    expect(response.status).toBe(201);
  });
});

describe("PUT /api/bounties/:id", () => {
  it("updates existing bounty", async () => {
    testDb.exec(`
      INSERT INTO "Bounties" (id, name, category, subcategory, remaining_dot, url)
      VALUES (1, 'Original', 'Dev', null, 1000, null)
    `);

    const response = await request(app)
      .put("/api/bounties/1")
      .send({
        id: 1,
        name: "Updated Bounty",
        category: "Marketing",
        subcategory: "Events",
        remaining_dot: 500.0,
        url: "https://updated.com",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify update
    const result = testDb.prepare('SELECT * FROM "Bounties" WHERE id = 1').get() as {
      name: string;
      category: string;
    };
    expect(result.name).toBe("Updated Bounty");
    expect(result.category).toBe("Marketing");
  });
});

describe("PATCH /api/bounties/:id/category", () => {
  it("updates bounty category", async () => {
    testDb.exec(`
      INSERT INTO "Bounties" (id, name, category, subcategory, remaining_dot, url)
      VALUES (1, 'Test', null, null, 1000, null)
    `);

    const response = await request(app)
      .patch("/api/bounties/1/category")
      .send({ category: "New Category", subcategory: "New Sub" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify update
    const result = testDb.prepare('SELECT category, subcategory FROM "Bounties" WHERE id = 1').get() as {
      category: string;
      subcategory: string;
    };
    expect(result.category).toBe("New Category");
    expect(result.subcategory).toBe("New Sub");
  });
});

describe("DELETE /api/bounties/:id", () => {
  it("deletes existing bounty", async () => {
    testDb.exec(`
      INSERT INTO "Bounties" (id, name, category, subcategory, remaining_dot, url)
      VALUES (1, 'ToDelete', null, null, 1000, null)
    `);

    const response = await request(app).delete("/api/bounties/1");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify deletion
    const result = testDb.prepare('SELECT * FROM "Bounties" WHERE id = 1').get();
    expect(result).toBeUndefined();
  });

  it("handles non-existent bounty gracefully", async () => {
    const response = await request(app).delete("/api/bounties/999");

    // Should succeed (no-op)
    expect(response.status).toBe(200);
  });
});
