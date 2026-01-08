/**
 * Categories Route Tests
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { categoriesRouter } from "../categories.js";
import Database from "better-sqlite3";

let testDb: Database.Database;

vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/categories", categoriesRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Categories" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT,
    "subcategory" TEXT
  );
`;

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  app = createApp();
});

beforeEach(() => {
  // Clear table before each test
  testDb.exec('DELETE FROM "Categories"');
});

afterAll(() => {
  testDb.close();
});

describe("GET /api/Categories", () => {
  it("returns empty array when no Categories exist", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns all Categories", async () => {
    testDb.exec(`
      INSERT INTO "Categories" (id, category, subcategory)
      VALUES (1, 'Development', 'Infrastructure'),
             (2, 'Marketing', 'Events')
    `);

    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].category).toBe("Development");
    expect(response.body[1].category).toBe("Marketing");
  });
});

describe("POST /api/Categories", () => {
  it("creates category with valid data", async () => {
    const response = await request(app)
      .post("/api/categories")
      .send({ category: "Test Category", subcategory: "Test Sub" });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.category).toBe("Test Category");
    expect(response.body.subcategory).toBe("Test Sub");
  });

  it("creates category with null subcategory", async () => {
    const response = await request(app)
      .post("/api/categories")
      .send({ category: "Test Category", subcategory: null });

    expect(response.status).toBe(201);
    expect(response.body.subcategory).toBeNull();
  });

  it("creates category without subcategory field", async () => {
    const response = await request(app)
      .post("/api/categories")
      .send({ category: "Only Category" });

    expect(response.status).toBe(201);
  });
});

describe("PUT /api/Categories/:id", () => {
  it("updates existing category", async () => {
    testDb.exec(`
      INSERT INTO "Categories" (id, category, subcategory)
      VALUES (1, 'Original', 'Sub')
    `);

    const response = await request(app)
      .put("/api/categories/1")
      .send({ category: "Updated", subcategory: "New Sub" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify update
    const result = testDb.prepare('SELECT * FROM "Categories" WHERE id = 1').get() as {
      category: string;
      subcategory: string;
    };
    expect(result.category).toBe("Updated");
    expect(result.subcategory).toBe("New Sub");
  });

  it("handles non-existent id gracefully", async () => {
    const response = await request(app)
      .put("/api/categories/999")
      .send({ category: "Updated", subcategory: "Sub" });

    // Should succeed (no rows affected, but no error)
    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/Categories/:id", () => {
  it("deletes existing category", async () => {
    testDb.exec(`
      INSERT INTO "Categories" (id, category, subcategory)
      VALUES (1, 'ToDelete', 'Sub')
    `);

    const response = await request(app).delete("/api/categories/1");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify deletion
    const result = testDb.prepare('SELECT * FROM "Categories" WHERE id = 1').get();
    expect(result).toBeUndefined();
  });

  it("handles non-existent id gracefully", async () => {
    const response = await request(app).delete("/api/categories/999");

    expect(response.status).toBe(200);
  });
});

describe("POST /api/categories/lookup", () => {
  it("returns existing category when found", async () => {
    testDb.exec(`
      INSERT INTO "Categories" (id, category, subcategory)
      VALUES (1, 'Development', 'Core')
    `);

    const response = await request(app)
      .post("/api/categories/lookup")
      .send({ category: "Development", subcategory: "Core" });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(1);
    expect(response.body.category).toBe("Development");
    expect(response.body.subcategory).toBe("Core");
  });

  it("creates new category when not found", async () => {
    const response = await request(app)
      .post("/api/categories/lookup")
      .send({ category: "NewCategory", subcategory: "NewSub" });

    expect(response.status).toBe(200);
    expect(response.body.id).toBeDefined();
    expect(response.body.category).toBe("NewCategory");
    expect(response.body.subcategory).toBe("NewSub");

    // Verify it was created in the database
    const result = testDb.prepare('SELECT * FROM "Categories" WHERE category = ?').get("NewCategory") as {
      subcategory: string;
    };
    expect(result.subcategory).toBe("NewSub");
  });

  it("handles empty subcategory", async () => {
    const response = await request(app)
      .post("/api/categories/lookup")
      .send({ category: "Development", subcategory: "" });

    expect(response.status).toBe(200);
    expect(response.body.category).toBe("Development");
    expect(response.body.subcategory).toBe("");
  });

  it("handles missing subcategory", async () => {
    const response = await request(app)
      .post("/api/categories/lookup")
      .send({ category: "Development" });

    expect(response.status).toBe(200);
    expect(response.body.category).toBe("Development");
    expect(response.body.subcategory).toBe("");
  });

  it("returns 400 when category is missing", async () => {
    const response = await request(app)
      .post("/api/categories/lookup")
      .send({ subcategory: "Sub" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("category is required");
  });

  it("returns 400 when category is empty", async () => {
    const response = await request(app)
      .post("/api/categories/lookup")
      .send({ category: "", subcategory: "Sub" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("category is required");
  });

  it("trims whitespace from category and subcategory", async () => {
    const response = await request(app)
      .post("/api/categories/lookup")
      .send({ category: "  Development  ", subcategory: "  Core  " });

    expect(response.status).toBe(200);
    expect(response.body.category).toBe("Development");
    expect(response.body.subcategory).toBe("Core");
  });
});

describe("Validation", () => {
  describe("POST /api/categories", () => {
    it("returns 400 when category is missing", async () => {
      const response = await request(app)
        .post("/api/categories")
        .send({ subcategory: "Sub" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("category is required");
    });

    it("returns 400 when category is empty string", async () => {
      const response = await request(app)
        .post("/api/categories")
        .send({ category: "", subcategory: "Sub" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("category is required");
    });

    it("returns 400 when category is whitespace only", async () => {
      const response = await request(app)
        .post("/api/categories")
        .send({ category: "   ", subcategory: "Sub" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("category is required");
    });

    it("returns 400 when category is not a string", async () => {
      const response = await request(app)
        .post("/api/categories")
        .send({ category: 123, subcategory: "Sub" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("category is required");
    });
  });

  describe("PUT /api/categories/:id", () => {
    it("returns 400 when id is not a number", async () => {
      const response = await request(app)
        .put("/api/categories/not-a-number")
        .send({ category: "Test", subcategory: "Sub" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid id format");
    });

    it("returns 400 when category is missing", async () => {
      const response = await request(app)
        .put("/api/categories/1")
        .send({ subcategory: "Sub" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("category is required");
    });

    it("returns 400 when category is empty string", async () => {
      const response = await request(app)
        .put("/api/categories/1")
        .send({ category: "", subcategory: "Sub" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("category is required");
    });
  });

  describe("DELETE /api/categories/:id", () => {
    it("returns 400 when id is not a number", async () => {
      const response = await request(app).delete("/api/categories/not-a-number");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid id format");
    });
  });
});
