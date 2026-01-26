/**
 * Custom Tables API Tests
 *
 * Tests for custom table creation, data operations, and schema inference.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { customTablesRouter } from "../routes/custom-tables.js";
import Database from "better-sqlite3";
import { closeSessionStore } from "../db/session-store.js";

// Create test database and mock the db module
let testDb: Database.Database;

vi.mock("../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

// Mock auth middleware to always allow
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

// Create test Express app
function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/custom-tables", customTablesRouter);
  return app;
}

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");

  // Create the Custom Table Metadata table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS "Custom Table Metadata" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "table_name" TEXT NOT NULL UNIQUE,
      "display_name" TEXT NOT NULL,
      "schema_json" TEXT NOT NULL,
      "row_count" INTEGER DEFAULT 0,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  app = createApp();
});

afterAll(() => {
  testDb.close();
  closeSessionStore();
});

// Clean up any custom tables created during tests
afterEach(() => {
  // Get all custom tables and drop them
  const tables = testDb.prepare(`SELECT table_name FROM "Custom Table Metadata"`).all() as { table_name: string }[];
  for (const table of tables) {
    testDb.exec(`DROP TABLE IF EXISTS "${table.table_name}"`);
  }
  // Clear metadata
  testDb.exec(`DELETE FROM "Custom Table Metadata"`);
});

describe("Schema Inference", () => {
  it("infers integer type correctly", async () => {
    const response = await request(app)
      .post("/api/custom-tables/infer-schema")
      .send({
        headers: ["count"],
        rows: [{ count: "1" }, { count: "2" }, { count: "100" }],
      });

    expect(response.status).toBe(200);
    expect(response.body.schema.columns[0].type).toBe("integer");
  });

  it("infers real type correctly", async () => {
    const response = await request(app)
      .post("/api/custom-tables/infer-schema")
      .send({
        headers: ["amount"],
        rows: [{ amount: "1.5" }, { amount: "2.75" }, { amount: "100.00" }],
      });

    expect(response.status).toBe(200);
    expect(response.body.schema.columns[0].type).toBe("real");
  });

  it("infers date type correctly", async () => {
    const response = await request(app)
      .post("/api/custom-tables/infer-schema")
      .send({
        headers: ["date"],
        rows: [{ date: "2024-01-15" }, { date: "2024-02-20" }],
      });

    expect(response.status).toBe(200);
    expect(response.body.schema.columns[0].type).toBe("date");
  });

  it("infers boolean type correctly", async () => {
    const response = await request(app)
      .post("/api/custom-tables/infer-schema")
      .send({
        headers: ["active"],
        rows: [{ active: "true" }, { active: "false" }, { active: "yes" }],
      });

    expect(response.status).toBe(200);
    expect(response.body.schema.columns[0].type).toBe("boolean");
  });

  it("falls back to text type for mixed data", async () => {
    const response = await request(app)
      .post("/api/custom-tables/infer-schema")
      .send({
        headers: ["value"],
        rows: [{ value: "123" }, { value: "hello" }, { value: "456" }],
      });

    expect(response.status).toBe(200);
    expect(response.body.schema.columns[0].type).toBe("text");
  });

  it("sanitizes column names", async () => {
    const response = await request(app)
      .post("/api/custom-tables/infer-schema")
      .send({
        headers: ["Column Name!", "123start", "SELECT"],
        rows: [{ "Column Name!": "a", "123start": "b", "SELECT": "c" }],
      });

    expect(response.status).toBe(200);
    expect(response.body.schema.columns[0].name).toBe("column_name");
    expect(response.body.schema.columns[1].name).toBe("col_123start");
    expect(response.body.schema.columns[2].name).toBe("select_col");
  });

  it("detects nullable columns based on empty values", async () => {
    const response = await request(app)
      .post("/api/custom-tables/infer-schema")
      .send({
        headers: ["name", "optional"],
        rows: [
          { name: "John", optional: "" },
          { name: "Jane", optional: "value" },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.schema.columns[0].nullable).toBe(false);
    expect(response.body.schema.columns[1].nullable).toBe(true);
  });

  it("rejects request with no headers", async () => {
    const response = await request(app)
      .post("/api/custom-tables/infer-schema")
      .send({
        headers: [],
        rows: [],
      });

    expect(response.status).toBe(400);
  });
});

describe("Table CRUD Operations", () => {
  it("creates a table with schema and data", async () => {
    const response = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Test Table",
        schema: {
          columns: [
            { name: "name", type: "text", nullable: false },
            { name: "value", type: "integer", nullable: true },
          ],
        },
        data: [
          { name: "Item 1", value: 100 },
          { name: "Item 2", value: 200 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.display_name).toBe("Test Table");
    expect(response.body.table_name).toBe("custom_test_table");
    expect(response.body.row_count).toBe(2);
  });

  it("lists all custom tables", async () => {
    // Create a table first
    await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "My Table",
        schema: {
          columns: [{ name: "col1", type: "text", nullable: true }],
        },
      });

    const response = await request(app).get("/api/custom-tables");

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].display_name).toBe("My Table");
  });

  it("gets table by ID with schema", async () => {
    const createResponse = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Details Table",
        schema: {
          columns: [{ name: "info", type: "text", nullable: true }],
        },
      });

    const response = await request(app).get(`/api/custom-tables/${createResponse.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body.display_name).toBe("Details Table");
    expect(response.body.schema.columns.length).toBe(1);
  });

  it("returns 404 for non-existent table", async () => {
    const response = await request(app).get("/api/custom-tables/99999");

    expect(response.status).toBe(404);
  });

  it("deletes a table", async () => {
    const createResponse = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "To Delete",
        schema: {
          columns: [{ name: "data", type: "text", nullable: true }],
        },
      });

    const deleteResponse = await request(app).delete(`/api/custom-tables/${createResponse.body.id}`);
    expect(deleteResponse.status).toBe(200);

    const getResponse = await request(app).get(`/api/custom-tables/${createResponse.body.id}`);
    expect(getResponse.status).toBe(404);
  });

  it("rejects invalid schema", async () => {
    const response = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Bad Schema",
        schema: {
          columns: [{ name: "select", type: "text", nullable: true }], // SQL keyword
        },
      });

    expect(response.status).toBe(400);
  });

  it("generates unique table names for duplicates", async () => {
    await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Duplicate",
        schema: {
          columns: [{ name: "col", type: "text", nullable: true }],
        },
      });

    const response = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Duplicate",
        schema: {
          columns: [{ name: "col", type: "text", nullable: true }],
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.table_name).toBe("custom_duplicate_1");
  });
});

describe("Data CRUD Operations", () => {
  let tableId: number;

  beforeEach(async () => {
    const response = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Data Test",
        schema: {
          columns: [
            { name: "name", type: "text", nullable: false },
            { name: "amount", type: "real", nullable: true },
          ],
        },
        data: [{ name: "Initial", amount: 10.5 }],
      });
    tableId = response.body.id;
  });

  it("gets paginated data", async () => {
    const response = await request(app).get(`/api/custom-tables/${tableId}/data?limit=10&offset=0`);

    expect(response.status).toBe(200);
    expect(response.body.rows.length).toBe(1);
    expect(response.body.total).toBe(1);
    expect(response.body.rows[0].name).toBe("Initial");
  });

  it("inserts a new row", async () => {
    const response = await request(app)
      .post(`/api/custom-tables/${tableId}/data`)
      .send({
        data: { name: "New Row", amount: 25.0 },
      });

    expect(response.status).toBe(201);
    expect(response.body._id).toBeDefined();

    const getResponse = await request(app).get(`/api/custom-tables/${tableId}/data`);
    expect(getResponse.body.total).toBe(2);
  });

  it("updates an existing row", async () => {
    const dataResponse = await request(app).get(`/api/custom-tables/${tableId}/data`);
    const rowId = dataResponse.body.rows[0]._id;

    const response = await request(app)
      .put(`/api/custom-tables/${tableId}/data/${rowId}`)
      .send({
        data: { name: "Updated", amount: 99.9 },
      });

    expect(response.status).toBe(200);

    const getResponse = await request(app).get(`/api/custom-tables/${tableId}/data`);
    expect(getResponse.body.rows[0].name).toBe("Updated");
    expect(getResponse.body.rows[0].amount).toBe(99.9);
  });

  it("deletes a row", async () => {
    const dataResponse = await request(app).get(`/api/custom-tables/${tableId}/data`);
    const rowId = dataResponse.body.rows[0]._id;

    const response = await request(app).delete(`/api/custom-tables/${tableId}/data/${rowId}`);
    expect(response.status).toBe(200);

    const getResponse = await request(app).get(`/api/custom-tables/${tableId}/data`);
    expect(getResponse.body.total).toBe(0);
  });

  it("returns 404 for non-existent row update", async () => {
    const response = await request(app)
      .put(`/api/custom-tables/${tableId}/data/99999`)
      .send({
        data: { name: "Ghost" },
      });

    expect(response.status).toBe(404);
  });
});

describe("Bulk Import", () => {
  let tableId: number;

  beforeEach(async () => {
    const response = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Import Test",
        schema: {
          columns: [
            { name: "item", type: "text", nullable: false },
            { name: "qty", type: "integer", nullable: true },
          ],
        },
        data: [{ item: "Original", qty: 1 }],
      });
    tableId = response.body.id;
  });

  it("appends data without wipe", async () => {
    const response = await request(app)
      .post(`/api/custom-tables/${tableId}/import`)
      .send({
        rows: [
          { item: "New 1", qty: 10 },
          { item: "New 2", qty: 20 },
        ],
        wipe: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.wiped).toBe(false);

    const getResponse = await request(app).get(`/api/custom-tables/${tableId}/data`);
    expect(getResponse.body.total).toBe(3);
  });

  it("wipes and reimports data", async () => {
    const response = await request(app)
      .post(`/api/custom-tables/${tableId}/import`)
      .send({
        rows: [
          { item: "Fresh 1", qty: 100 },
          { item: "Fresh 2", qty: 200 },
        ],
        wipe: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.wiped).toBe(true);

    const getResponse = await request(app).get(`/api/custom-tables/${tableId}/data`);
    expect(getResponse.body.total).toBe(2);
    expect(getResponse.body.rows[0].item).toBe("Fresh 1");
  });

  it("handles large imports (1000+ rows)", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      item: `Item ${i}`,
      qty: i,
    }));

    const response = await request(app)
      .post(`/api/custom-tables/${tableId}/import`)
      .send({
        rows,
        wipe: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1000);

    const getResponse = await request(app).get(`/api/custom-tables/${tableId}/data?limit=10`);
    expect(getResponse.body.total).toBe(1000);
  });
});

describe("Type Coercion", () => {
  it("coerces integer values correctly", async () => {
    const createResponse = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Int Test",
        schema: {
          columns: [{ name: "num", type: "integer", nullable: true }],
        },
        data: [{ num: "42" }, { num: "not a number" }],
      });

    expect(createResponse.status).toBe(201);

    const dataResponse = await request(app).get(`/api/custom-tables/${createResponse.body.id}/data`);
    expect(dataResponse.body.rows[0].num).toBe(42);
    expect(dataResponse.body.rows[1].num).toBe(null); // Invalid number becomes null
  });

  it("coerces boolean values correctly", async () => {
    const createResponse = await request(app)
      .post("/api/custom-tables")
      .send({
        displayName: "Bool Test",
        schema: {
          columns: [{ name: "flag", type: "boolean", nullable: true }],
        },
        data: [{ flag: "true" }, { flag: "false" }, { flag: "yes" }, { flag: "0" }],
      });

    expect(createResponse.status).toBe(201);

    const dataResponse = await request(app).get(`/api/custom-tables/${createResponse.body.id}/data`);
    expect(dataResponse.body.rows[0].flag).toBe(1);
    expect(dataResponse.body.rows[1].flag).toBe(0);
    expect(dataResponse.body.rows[2].flag).toBe(1);
    expect(dataResponse.body.rows[3].flag).toBe(0);
  });
});
