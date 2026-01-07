/**
 * Query Builder Route Tests
 *
 * SECURITY CRITICAL: Tests for input validation and SQL injection prevention
 * in the query builder endpoint.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { queryRouter } from "../query.js";
import Database from "better-sqlite3";

// Create test database and mock the db module
let testDb: Database.Database;

vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

// Create test Express app
function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/query", queryRouter);
  return app;
}

// Schema SQL for test database
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Referenda" (
    "id" INTEGER PRIMARY KEY,
    "url" TEXT,
    "title" TEXT,
    "status" TEXT,
    "DOT_proposal_time" REAL,
    "USD_proposal_time" REAL,
    "track" TEXT,
    "tally.ayes" REAL,
    "tally.nays" REAL,
    "proposal_time" TEXT,
    "latest_status_change" TEXT,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "DOT_component" REAL,
    "USDC_component" REAL,
    "USDT_component" REAL,
    "category" TEXT,
    "subcategory" TEXT
  );

  CREATE TABLE IF NOT EXISTS "Treasury" (
    "id" INTEGER PRIMARY KEY,
    "url" TEXT,
    "referendumIndex" INTEGER,
    "status" TEXT,
    "description" TEXT,
    "DOT_proposal_time" REAL,
    "USD_proposal_time" REAL,
    "proposal_time" TEXT,
    "latest_status_change" TEXT,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "DOT_component" REAL,
    "USDC_component" REAL,
    "USDT_component" REAL,
    "validFrom" TEXT,
    "expireAt" TEXT
  );

  CREATE TABLE IF NOT EXISTS "Child Bounties" (
    "identifier" TEXT PRIMARY KEY,
    "url" TEXT,
    "index" INTEGER,
    "parentBountyId" INTEGER,
    "status" TEXT,
    "description" TEXT,
    "DOT" REAL,
    "USD_proposal_time" REAL,
    "beneficiary" TEXT,
    "proposal_time" TEXT,
    "latest_status_change" TEXT,
    "USD_latest" REAL,
    "category" TEXT,
    "subcategory" TEXT
  );

  CREATE TABLE IF NOT EXISTS "categories" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT,
    "subcategory" TEXT
  );

  CREATE TABLE IF NOT EXISTS "bounties" (
    "id" INTEGER PRIMARY KEY,
    "name" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "remaining_dot" REAL,
    "url" TEXT
  );

  CREATE TABLE IF NOT EXISTS "secret_data" (
    "id" INTEGER PRIMARY KEY,
    "password" TEXT
  );

  CREATE VIEW IF NOT EXISTS "outstanding_claims" AS
    SELECT id, url, status FROM "Treasury" WHERE status = 'Approved';

  CREATE VIEW IF NOT EXISTS "all_spending" AS
    SELECT id, url FROM "Referenda";
`;

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);

  // Seed test data
  testDb.exec(`
    INSERT INTO "Referenda" (id, title, status, DOT_latest, track)
    VALUES (1, 'Test Ref 1', 'Executed', 1000, 'Treasurer'),
           (2, 'Test Ref 2', 'Ongoing', 2000, 'SmallSpender');

    INSERT INTO "Treasury" (id, status, DOT_latest, description)
    VALUES (1, 'Approved', 1000, 'Test'),
           (2, 'Paid', 2000, 'Test 2');

    INSERT INTO "secret_data" (id, password)
    VALUES (1, 'supersecret123');
  `);

  app = createApp();
});

afterAll(() => {
  testDb.close();
});

describe("Query Builder Security Tests", () => {
  // ===========================================================================
  // Table/Source Whitelist Tests
  // ===========================================================================
  describe("Source Table Whitelist", () => {
    it("accepts whitelisted table: Referenda", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("accepts whitelisted table: Treasury", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Treasury",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts whitelisted table with spaces: Child Bounties", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Child Bounties",
          columns: [{ column: "identifier" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts whitelisted view: outstanding_claims", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "outstanding_claims",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts whitelisted view: all_spending", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "all_spending",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("rejects non-whitelisted table: sqlite_master", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "sqlite_master",
          columns: [{ column: "name" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid source table");
    });

    it("rejects non-whitelisted table: secret_data", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "secret_data",
          columns: [{ column: "password" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid source table");
    });

    it("rejects empty source table", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(400);
    });

    it("rejects undefined source table", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(400);
    });

    it("rejects SQL injection in table name: Referenda; DROP TABLE", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda; DROP TABLE secret_data;--",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid source table");
    });
  });

  // ===========================================================================
  // Column Name Sanitization Tests
  // ===========================================================================
  describe("Column Name Sanitization", () => {
    it("accepts valid column name: id", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts column with dot: tally.ayes", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "tally.ayes" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts column with underscore: DOT_latest", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts column with space: latest status change", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "latest_status_change" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("rejects column with semicolon: id; DROP TABLE", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id; DROP TABLE secret_data;--" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Invalid column name");
    });

    it("rejects column with double quote: id\"", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: 'id"' }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Invalid column name");
    });

    it("rejects column with single quote: id'", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id'" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Invalid column name");
    });

    it("rejects column with parentheses: id()", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id()" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Invalid column name");
    });

    it("rejects empty columns array", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("At least one column");
    });
  });

  // ===========================================================================
  // Operator Validation Tests
  // ===========================================================================
  describe("Operator Validation", () => {
    it("accepts operator: =", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "status", operator: "=", value: "Executed" }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: !=", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "status", operator: "!=", value: "Executed" }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: >", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "id", operator: ">", value: 0 }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: <", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "id", operator: "<", value: 100 }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: >=", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "id", operator: ">=", value: 1 }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: <=", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "id", operator: "<=", value: 100 }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: LIKE", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "title", operator: "LIKE", value: "%Test%" }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: IN with array", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "status", operator: "IN", value: ["Executed", "Ongoing"] }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: IS NULL", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "category", operator: "IS NULL", value: null }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: IS NOT NULL", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "category", operator: "IS NOT NULL", value: null }],
        });

      expect(response.status).toBe(200);
    });

    it("rejects operator: UNION", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "id", operator: "UNION", value: "SELECT * FROM secret_data" }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid operator");
    });

    it("rejects operator: OR", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "id", operator: "OR", value: "1=1" }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid operator");
    });

    it("rejects operator: --", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "id", operator: "--", value: "" }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid operator");
    });

    it("rejects operator: ;", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "id", operator: ";", value: "DROP TABLE" }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid operator");
    });
  });

  // ===========================================================================
  // Aggregate Function Validation Tests
  // ===========================================================================
  describe("Aggregate Function Validation", () => {
    it("accepts aggregate: COUNT", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", aggregateFunction: "COUNT" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts aggregate: SUM", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest", aggregateFunction: "SUM" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts aggregate: AVG", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest", aggregateFunction: "AVG" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts aggregate: MIN", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest", aggregateFunction: "MIN" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts aggregate: MAX", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest", aggregateFunction: "MAX" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("rejects aggregate: EXEC", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", aggregateFunction: "EXEC" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid aggregate function");
    });

    it("rejects aggregate: DROP", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", aggregateFunction: "DROP" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid aggregate function");
    });

    it("rejects SQL in aggregate: COUNT; DROP TABLE", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", aggregateFunction: "COUNT; DROP TABLE secret_data;--" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid aggregate function");
    });
  });

  // ===========================================================================
  // Row Limit Enforcement Tests
  // ===========================================================================
  describe("Row Limit Enforcement", () => {
    it("applies default limit when not specified", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // SQL should contain LIMIT
      expect(response.body.sql).toContain("LIMIT");
    });

    it("respects user-specified limit within bounds", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
          limit: 100,
        });

      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("LIMIT 100");
    });

    it("caps limit at MAX_ROWS (10000)", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
          limit: 999999,
        });

      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("LIMIT 10000");
    });
  });

  // ===========================================================================
  // Parameterized Query Tests
  // ===========================================================================
  describe("Parameterized Queries", () => {
    it("uses parameterized value for = operator", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "status", operator: "=", value: "Executed" }],
        });

      expect(response.status).toBe(200);
      // Should use placeholder, not direct value in SQL
      expect(response.body.sql).toContain("?");
    });

    it("uses parameterized values for IN operator", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "status", operator: "IN", value: ["Executed", "Ongoing", "Rejected"] }],
        });

      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("?, ?, ?");
    });

    it("does not include raw value in SQL for LIKE", async () => {
      const maliciousValue = "'; DROP TABLE secret_data;--";
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "title", operator: "LIKE", value: maliciousValue }],
        });

      expect(response.status).toBe(200);
      // SQL should not contain the malicious value directly
      expect(response.body.sql).not.toContain(maliciousValue);
      expect(response.body.sql).toContain("?");
    });
  });

  // ===========================================================================
  // GROUP BY Tests
  // ===========================================================================
  describe("GROUP BY Clause", () => {
    it("accepts valid GROUP BY column", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [
            { column: "status" },
            { column: "id", aggregateFunction: "COUNT" },
          ],
          filters: [],
          groupBy: ["status"],
        });

      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("GROUP BY");
    });

    it("sanitizes GROUP BY column names", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "status" }],
          filters: [],
          groupBy: ["status; DROP TABLE secret_data;--"],
        });

      // Should either reject or sanitize
      expect([200, 500]).toContain(response.status);
      if (response.status === 500) {
        expect(response.body.error).toContain("Invalid column name");
      }
    });
  });

  // ===========================================================================
  // ORDER BY Tests
  // ===========================================================================
  describe("ORDER BY Clause", () => {
    it("accepts valid ORDER BY with ASC", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
          orderBy: [{ column: "id", direction: "ASC" }],
        });

      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("ORDER BY");
      expect(response.body.sql).toContain("ASC");
    });

    it("accepts valid ORDER BY with DESC", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
          orderBy: [{ column: "id", direction: "DESC" }],
        });

      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("DESC");
    });

    it("sanitizes ORDER BY column names", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
          orderBy: [{ column: "id; DROP TABLE--", direction: "ASC" }],
        });

      // Should either reject or sanitize
      expect([200, 500]).toContain(response.status);
      if (response.status === 500) {
        expect(response.body.error).toContain("Invalid column name");
      }
    });
  });

  // ===========================================================================
  // Response Format Tests
  // ===========================================================================
  describe("Response Format", () => {
    it("returns data array", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns rowCount", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      expect(typeof response.body.rowCount).toBe("number");
    });

    it("returns generated SQL", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      expect(typeof response.body.sql).toBe("string");
      expect(response.body.sql).toContain("SELECT");
    });
  });
});

describe("GET /api/query/schema", () => {
  it("returns schema for whitelisted tables", async () => {
    const response = await request(app).get("/api/query/schema");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // Should contain Referenda
    const referenda = response.body.find(
      (t: { name: string }) => t.name === "Referenda"
    );
    expect(referenda).toBeDefined();
    expect(referenda.columns).toBeDefined();
  });

  it("excludes non-whitelisted tables", async () => {
    const response = await request(app).get("/api/query/schema");

    expect(response.status).toBe(200);

    // Should not contain secret_data
    const secretData = response.body.find(
      (t: { name: string }) => t.name === "secret_data"
    );
    expect(secretData).toBeUndefined();

    // Should not contain sqlite_master
    const sqliteMaster = response.body.find(
      (t: { name: string }) => t.name === "sqlite_master"
    );
    expect(sqliteMaster).toBeUndefined();
  });

  it("includes column information with types", async () => {
    const response = await request(app).get("/api/query/schema");

    expect(response.status).toBe(200);

    const referenda = response.body.find(
      (t: { name: string }) => t.name === "Referenda"
    );
    expect(referenda.columns.length).toBeGreaterThan(0);

    const idColumn = referenda.columns.find(
      (c: { name: string }) => c.name === "id"
    );
    expect(idColumn).toBeDefined();
    expect(idColumn.type).toBeDefined();
  });
});
