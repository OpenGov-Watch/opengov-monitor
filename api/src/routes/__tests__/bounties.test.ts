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

// Mock auth middleware to allow all requests in tests
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/bounties", bountiesRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Categories" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT,
    "subcategory" TEXT
  );
  CREATE TABLE IF NOT EXISTS "Bounties" (
    "id" INTEGER PRIMARY KEY,
    "name" TEXT,
    "category_id" INTEGER,
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
  testDb.exec('DELETE FROM "Categories"');
  // Insert test categories
  testDb.exec(`
    INSERT INTO "Categories" (id, category, subcategory)
    VALUES
      (1, 'Development', 'Core'),
      (2, 'Marketing', 'Events'),
      (3, 'Development', '')
  `);
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
      INSERT INTO "Bounties" (id, name, category_id, remaining_dot, url)
      VALUES (1, 'Bounty 1', 1, 1000.5, 'https://example.com/1'),
             (2, 'Bounty 2', 2, 500.0, 'https://example.com/2')
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
      INSERT INTO "Bounties" (id, name, category_id, remaining_dot, url)
      VALUES (1, 'Bounty 1', 1, 1000.5, 'https://example.com/1')
    `);

    const response = await request(app).get("/api/bounties/1");

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(1);
    expect(response.body.name).toBe("Bounty 1");
    expect(response.body.category_id).toBe(1);
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
        category_id: 1,
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
      INSERT INTO "Bounties" (id, name, category_id, remaining_dot, url)
      VALUES (1, 'Original', 3, 1000, null)
    `);

    const response = await request(app)
      .put("/api/bounties/1")
      .send({
        id: 1,
        name: "Updated Bounty",
        category_id: 2,
        remaining_dot: 500.0,
        url: "https://updated.com",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify update
    const result = testDb.prepare('SELECT * FROM "Bounties" WHERE id = 1').get() as {
      name: string;
      category_id: number;
    };
    expect(result.name).toBe("Updated Bounty");
    expect(result.category_id).toBe(2);
  });
});

describe("PATCH /api/bounties/:id/category", () => {
  it("updates bounty category_id", async () => {
    testDb.exec(`
      INSERT INTO "Bounties" (id, name, category_id, remaining_dot, url)
      VALUES (1, 'Test', null, 1000, null)
    `);

    const response = await request(app)
      .patch("/api/bounties/1/category")
      .send({ category_id: 1 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify update
    const result = testDb.prepare('SELECT category_id FROM "Bounties" WHERE id = 1').get() as {
      category_id: number;
    };
    expect(result.category_id).toBe(1);
  });
});

describe("DELETE /api/bounties/:id", () => {
  it("deletes existing bounty", async () => {
    testDb.exec(`
      INSERT INTO "Bounties" (id, name, category_id, remaining_dot, url)
      VALUES (1, 'ToDelete', null, 1000, null)
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

describe("Validation", () => {
  describe("POST /api/bounties", () => {
    it("returns 400 when id is missing", async () => {
      const response = await request(app)
        .post("/api/bounties")
        .send({ name: "Test Bounty" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("id is required");
    });

    it("returns 400 when id is null", async () => {
      const response = await request(app)
        .post("/api/bounties")
        .send({ id: null, name: "Test Bounty" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("id is required");
    });

    it("returns 400 when id is not a number", async () => {
      const response = await request(app)
        .post("/api/bounties")
        .send({ id: "not-a-number", name: "Test Bounty" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("id must be a number");
    });

    it("accepts numeric string id", async () => {
      const response = await request(app)
        .post("/api/bounties")
        .send({ id: "123", name: "Test Bounty" });

      expect(response.status).toBe(201);
    });
  });

  describe("PUT /api/bounties/:id", () => {
    it("returns 400 when id is not a number", async () => {
      const response = await request(app)
        .put("/api/bounties/not-a-number")
        .send({ name: "Updated" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid id format");
    });

    it("returns 400 when body id does not match URL id", async () => {
      const response = await request(app)
        .put("/api/bounties/1")
        .send({ id: 2, name: "Updated" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("id in body must match id in URL");
    });

    it("accepts request without body id", async () => {
      testDb.exec(`
        INSERT INTO "Bounties" (id, name)
        VALUES (1, 'Original')
      `);

      const response = await request(app)
        .put("/api/bounties/1")
        .send({ name: "Updated" });

      expect(response.status).toBe(200);
    });
  });

  describe("PATCH /api/bounties/:id/category", () => {
    it("returns 400 when id is not a number", async () => {
      const response = await request(app)
        .patch("/api/bounties/not-a-number/category")
        .send({ category: "Test" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid id format");
    });
  });

  describe("DELETE /api/bounties/:id", () => {
    it("returns 400 when id is not a number", async () => {
      const response = await request(app).delete("/api/bounties/not-a-number");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid id format");
    });
  });
});
