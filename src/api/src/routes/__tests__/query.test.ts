/**
 * Query Builder Route Tests
 *
 * SECURITY CRITICAL: Tests for input validation and SQL injection prevention
 * in the query builder endpoint.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { queryRouter } from "../query/index.js";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { closeSessionStore } from "../../db/session-store.js";

// Create test database and mock the db module
let testDb: Database.Database;
let testDbPath: string;

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

let app: express.Express;

beforeAll(() => {
  // Copy the production database to a temp location for testing
  const prodDbPath = path.resolve(process.cwd(), "../../data/local/polkadot.db");
  testDbPath = path.resolve(process.cwd(), "../../data/local/polkadot-test.db");

  // Copy the database file
  if (fs.existsSync(prodDbPath)) {
    fs.copyFileSync(prodDbPath, testDbPath);
    testDb = new Database(testDbPath);
  } else {
    // Fallback: create in-memory database if prod DB doesn't exist
    console.warn("Production database not found, using in-memory database for tests");
    testDb = new Database(":memory:");

    // Create minimal schema for security tests
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS "Referenda" (
        "id" INTEGER PRIMARY KEY,
        "url" TEXT,
        "title" TEXT,
        "status" TEXT,
        "DOT_proposal_time" REAL,
        "USD_proposal_time" REAL,
        "track" TEXT,
        "DOT_latest" REAL,
        "USD_latest" REAL,
        "tally_ayes" REAL,
        "tally_nays" REAL,
        "proposal_time" TIMESTAMP,
        "latest_status_change" TIMESTAMP,
        "DOT_component" REAL,
        "USDC_component" REAL,
        "USDT_component" REAL,
        "category_id" INTEGER,
        "notes" TEXT,
        "hide_in_spends" INTEGER,
        "year" TEXT
      );

      CREATE TABLE IF NOT EXISTS "Treasury" (
        "id" INTEGER PRIMARY KEY,
        "url" TEXT,
        "status" TEXT,
        "DOT_latest" REAL,
        "description" TEXT
      );

      CREATE TABLE IF NOT EXISTS "Child Bounties" (
        "identifier" TEXT PRIMARY KEY,
        "url" TEXT,
        "status" TEXT
      );

      CREATE TABLE IF NOT EXISTS "Categories" (
        "id" INTEGER PRIMARY KEY,
        "category" TEXT,
        "subcategory" TEXT
      );

      CREATE TABLE IF NOT EXISTS "secret_data" (
        "id" INTEGER PRIMARY KEY,
        "password" TEXT
      );

      CREATE VIEW IF NOT EXISTS "outstanding_claims" AS
        SELECT id, url, status FROM "Treasury" WHERE status = 'Approved';

      CREATE VIEW IF NOT EXISTS "all_spending" AS
        SELECT id, url, year, DOT_latest, DOT_component, year || '-Q1' as year_quarter FROM "Referenda";

      INSERT INTO "Categories" (id, category, subcategory)
      VALUES (1, 'Development', 'Infrastructure'),
             (2, 'Marketing', 'Community');

      INSERT INTO "Referenda" (id, title, status, DOT_latest, track, category_id, year)
      VALUES (1, 'Test Ref 1', 'Executed', 1000, 'Treasurer', 1, '2024'),
             (2, 'Test Ref 2', 'Ongoing', 2000, 'SmallSpender', 2, '2025'),
             (3, 'Test Ref 3', 'Executed', 3000, 'Treasurer', 1, '2025'),
             (4, 'Test Ref 4', 'Ongoing', 4000, 'SmallSpender', 2, '2024');

      INSERT INTO "Treasury" (id, status, DOT_latest, description)
      VALUES (1, 'Approved', 1000, 'Test'),
             (2, 'Paid', 2000, 'Test 2');

      INSERT INTO "secret_data" (id, password)
      VALUES (1, 'supersecret123');
    `);
  }

  // Add secret_data table for security testing (not in prod DB)
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS "secret_data" (
      "id" INTEGER PRIMARY KEY,
      "password" TEXT
    );

    INSERT OR IGNORE INTO "secret_data" (id, password)
    VALUES (1, 'supersecret123');

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

  // Clean up test database file
  if (testDbPath && fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (err) {
      console.warn("Failed to delete test database:", err);
    }
  }
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

    it("accepts column with underscore: DOT_proposal_time", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_proposal_time" }],
          filters: [],
        });

      if (response.status !== 200) {
        console.error("Response body:", response.body);
      }
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

    it("!= operator includes NULL values in results", async () => {
      // The != operator should include rows where the column is NULL
      // SQL's != does not match NULLs by default, so we generate (col != ? OR col IS NULL)
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }, { column: "notes" }],
          filters: [{ column: "notes", operator: "!=", value: "some_value" }],
        });

      expect(response.status).toBe(200);
      // Should include rows where notes is NULL (all test rows have NULL notes)
      expect(response.body.data.length).toBeGreaterThan(0);
      // Verify the SQL includes the NULL handling pattern
      expect(response.body.sql).toContain("IS NULL");
      expect(response.body.sql).toMatch(/\(.*!=.*OR.*IS NULL\)/);
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
          filters: [{ column: "title", operator: "IS NULL", value: null }],
        });

      expect(response.status).toBe(200);
    });

    it("accepts operator: IS NOT NULL", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: [{ column: "title", operator: "IS NOT NULL", value: null }],
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

    it("totalCount reflects grouped row count, not raw row count", async () => {
      // When using GROUP BY with pagination (offset), totalCount should reflect
      // the number of groups, not the number of raw rows before grouping
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
          offset: 0,  // Enable server-side pagination to get totalCount
          limit: 100,
        });

      expect(response.status).toBe(200);
      expect(response.body.totalCount).toBeDefined();
      // totalCount should equal the number of distinct status values (groups),
      // not the total number of Referenda rows
      expect(response.body.totalCount).toBe(response.body.data.length);
      // The total count should be less than or equal to the sum of all group counts
      // (proving we're counting groups, not raw rows)
      const sumOfCounts = response.body.data.reduce(
        (sum: number, row: { count_id: number }) => sum + row.count_id,
        0
      );
      expect(response.body.totalCount).toBeLessThanOrEqual(sumOfCounts);
    });

    it("uses expression in GROUP BY when referencing expression column alias", async () => {
      // When GROUP BY references an expression column alias, the SQL should use
      // the actual expression, not the quoted alias (which SQLite would treat as
      // a non-existent column name)
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest", aggregateFunction: "SUM" }],
          expressionColumns: [{ expression: "UPPER(status)", alias: "status_upper" }],
          groupBy: ["status_upper"],
          filters: [],
          limit: 10,
        });

      if (response.status !== 200) {
        console.error("Response error:", response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("GROUP BY (UPPER(status))");
      expect(response.body.sql).not.toContain('GROUP BY "status_upper"');
    });

    it("handles mixed regular columns and expression aliases in GROUP BY", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [
            { column: "track" },
            { column: "DOT_latest", aggregateFunction: "SUM" }
          ],
          expressionColumns: [{ expression: "UPPER(status)", alias: "status_upper" }],
          groupBy: ["track", "status_upper"],
          filters: [],
          limit: 10,
        });

      expect(response.status).toBe(200);
      // Regular column should be sanitized normally, expression alias should use expression
      expect(response.body.sql).toMatch(/GROUP BY "track",?\s*\(UPPER\(status\)\)/);
    });

    it("returns data successfully when grouping by expression column alias", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest", aggregateFunction: "SUM" }],
          expressionColumns: [{ expression: "UPPER(status)", alias: "status_upper" }],
          groupBy: ["status_upper"],
          filters: [],
          limit: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(Array.isArray(response.body.data)).toBe(true);
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

    it("uses alias in ORDER BY for aggregated columns", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "all_spending",
          columns: [
            { column: "year_quarter" },
            { column: "DOT_component", alias: "Total_DOT", aggregateFunction: "SUM" },
          ],
          filters: [],
          groupBy: ["year_quarter"],
          orderBy: [{ column: "DOT_component", direction: "DESC" }],
          limit: 5,
        });

      expect(response.status).toBe(200);
      // The ORDER BY should use the alias "Total_DOT" instead of raw column "DOT_component"
      expect(response.body.sql).toContain('ORDER BY "Total_DOT" DESC');
      expect(response.body.sql).not.toMatch(/ORDER BY.*"DOT_component"/);
    });

    it("uses generated alias in ORDER BY for aggregated columns without explicit alias", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "all_spending",
          columns: [
            { column: "year_quarter" },
            { column: "DOT_component", aggregateFunction: "SUM" },
          ],
          filters: [],
          groupBy: ["year_quarter"],
          orderBy: [{ column: "DOT_component", direction: "ASC" }],
          limit: 5,
        });

      expect(response.status).toBe(200);
      // Without explicit alias, the generated alias should be "sum_DOT_component"
      expect(response.body.sql).toContain('ORDER BY "sum_DOT_component" ASC');
      expect(response.body.sql).not.toMatch(/ORDER BY.*"DOT_component" ASC/);
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

// ===========================================================================
// Expression Column Security Tests
// ===========================================================================
describe("Expression Column Security Tests", () => {
  describe("Valid Expression Columns", () => {
    it("allows valid arithmetic expression", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest * 10", alias: "dot_x10" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.sql).toContain("dot_x10");
    });

    it("allows ROUND function in expression", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "ROUND(DOT_latest / 1000000, 2)", alias: "dot_millions" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("allows CASE WHEN expression", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{
            expression: "CASE WHEN status = 'Executed' THEN 1 ELSE 0 END",
            alias: "is_executed"
          }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("allows COALESCE function", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "COALESCE(DOT_latest, 0)", alias: "dot_safe" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("allows NULLIF function", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "COALESCE(DOT_latest, 0) / NULLIF(USD_latest, 0)", alias: "ratio" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("allows IIF function", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "IIF(DOT_latest > 1000, 'large', 'small')", alias: "size" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("allows expression-only query (no regular columns)", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [],
          expressionColumns: [{ expression: "COUNT(*)", alias: "total_count" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("allows quoted column names in expression", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: '"DOT_latest" * 2', alias: "doubled" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });
  });

  describe("Blocked SQL Injection Patterns", () => {
    it("rejects expression with semicolon", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest; DROP TABLE secret_data", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with UNION", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "1 UNION SELECT password FROM secret_data", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with SELECT", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "(SELECT password FROM secret_data)", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with INSERT", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "INSERT INTO secret_data VALUES(1, 'x')", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with UPDATE", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "UPDATE secret_data SET password = 'x'", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with DELETE", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DELETE FROM secret_data", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with DROP", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DROP TABLE secret_data", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with SQL comment --", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest -- comment", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with block comment /*", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest /* comment */", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with ATTACH", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "ATTACH DATABASE 'evil.db' AS evil", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });

    it("rejects expression with PRAGMA", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "PRAGMA table_info(secret_data)", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("blocked");
    });
  });

  describe("Column Validation in Expressions", () => {
    it("rejects unknown column reference", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "nonexistent_column * 10", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Unknown column");
    });

    it("rejects reference to column from different table", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "password * 1", alias: "bad" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Unknown column");
    });
  });

  describe("Alias Validation", () => {
    it("rejects empty alias", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest * 10", alias: "" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("alias");
    });

    it("sanitizes alias with special characters", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest * 10", alias: "bad; DROP TABLE" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Special chars sanitized
      expect(response.body.sql).toContain('"bad__DROP_TABLE"');
    });

    it("sanitizes alias starting with number", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest * 10", alias: "123bad" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Prepends underscore when starting with number
      expect(response.body.sql).toContain('"_123bad"');
    });

    it("accepts alias with underscore", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest * 10", alias: "dot_times_10" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts alias starting with underscore", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "DOT_latest * 10", alias: "_private" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });
  });

  describe("Expression Length Limits", () => {
    it("rejects expression exceeding max length (500 chars)", async () => {
      const longExpression = "DOT_latest + " + "1 + ".repeat(200) + "1";
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: longExpression, alias: "too_long" }],
          filters: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("too long");
    });
  });

  describe("Empty Expression Validation", () => {
    it("rejects empty expression", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "", alias: "empty" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("empty");
    });

    it("rejects whitespace-only expression", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          expressionColumns: [{ expression: "   ", alias: "whitespace" }],
          filters: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("empty");
    });
  });
});

// ===========================================================================
// Regular Column Alias Security Tests (Issue #15)
// ===========================================================================
describe("Regular Column Alias Security Tests", () => {
  describe("SQL Injection Prevention in Regular Column Aliases", () => {
    it("accepts valid alphanumeric alias", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: "referendum_id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("accepts alias with underscores", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest", alias: "dot_amount_latest" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("accepts alias starting with underscore", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: "_private_id" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("sanitizes SQL injection attempt: quote and FROM clause", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: 'foo" FROM secret_data --' }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // SQL injection neutralized via sanitization
      expect(response.body.sql).toContain('"foo__FROM_secret_data___"');
    });

    it("sanitizes alias with semicolon", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: "id; DROP TABLE secret_data" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // SQL injection neutralized via sanitization
      expect(response.body.sql).toContain('"id__DROP_TABLE_secret_data"');
    });

    it("sanitizes alias with SQL comment", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: "id--comment" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Dashes replaced with underscores
      expect(response.body.sql).toContain('"id__comment"');
    });

    it("sanitizes alias with spaces", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: "bad alias" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Space replaced with underscore
      expect(response.body.sql).toContain('"bad_alias"');
    });

    it("sanitizes alias with parentheses", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: "func()" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Parentheses replaced with underscores
      expect(response.body.sql).toContain('"func__"');
    });

    it("sanitizes alias starting with number", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: "123invalid" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Prepends underscore when starting with number
      expect(response.body.sql).toContain('"_123invalid"');
    });

    it("sanitizes alias with single quote", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: "id'malicious" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Single quote replaced with underscore
      expect(response.body.sql).toContain('"id_malicious"');
    });

    it("sanitizes alias with double quote", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", alias: 'id"malicious' }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Double quote replaced with underscore
      expect(response.body.sql).toContain('"id_malicious"');
    });
  });

  describe("Aggregate Function Alias Security", () => {
    it("accepts valid alias with aggregate function", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", aggregateFunction: "COUNT", alias: "total_count" }],
          filters: [],
        });

      expect(response.status).toBe(200);
    });

    it("auto-generates safe alias when not provided", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "DOT_latest", aggregateFunction: "SUM" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("sum_DOT_latest");
    });

    it("sanitizes SQL injection attempt in aggregate alias", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", aggregateFunction: "COUNT", alias: 'total" FROM secret_data --' }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Special chars sanitized - SQL injection neutralized
      expect(response.body.sql).toContain('"total__FROM_secret_data___"');
    });

    it("sanitizes semicolon in aggregate alias", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id", aggregateFunction: "COUNT", alias: "cnt; DROP TABLE secret_data" }],
          filters: [],
        });

      expect(response.status).toBe(200);
      // Special chars sanitized - SQL injection neutralized
      expect(response.body.sql).toContain('"cnt__DROP_TABLE_secret_data"');
    });
  });
});

// ===========================================================================
// FilterGroup and Empty Filter Condition Tests
// ===========================================================================
describe("FilterGroup and Empty Filter Condition Tests", () => {
  describe("Empty Filter Conditions", () => {
    it("ignores filter condition with empty string value", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "id", operator: "=", value: "" }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      // Should return all data since empty condition is ignored
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it("ignores filter condition with null value", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "id", operator: "=", value: null }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("ignores filter condition with undefined value", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "id", operator: ">", value: undefined }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("applies valid conditions while ignoring empty ones", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }, { column: "status" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "id", operator: "=", value: "" },  // Ignored
              { column: "status", operator: "=", value: "Executed" }  // Applied
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      // Should only return Executed referenda
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].status).toBe("Executed");
    });

    it("allows IS NULL operator with null value", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "title", operator: "IS NULL", value: null }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("allows IS NOT NULL operator with null value", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "title", operator: "IS NOT NULL", value: null }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("ignores IN operator with empty array", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "status", operator: "IN", value: [] }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      // Should return all data since empty IN is ignored
    });
  });

  describe("Nested FilterGroup with Empty Conditions", () => {
    it("handles nested FilterGroup with some empty conditions", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "status", operator: "=", value: "Executed" },
              {
                operator: "OR",
                conditions: [
                  { column: "id", operator: ">", value: "" },  // Ignored
                  { column: "track", operator: "=", value: "Treasurer" }
                ]
              }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("handles FilterGroup with all conditions empty", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: [
              { column: "id", operator: "=", value: "" },
              { column: "status", operator: "=", value: "" }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      // Should return all data since all conditions are empty
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it("handles empty FilterGroup", async () => {
      const response = await request(app)
        .post("/api/query/execute")
        .send({
          sourceTable: "Referenda",
          columns: [{ column: "id" }],
          filters: {
            operator: "AND",
            conditions: []
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe("Facet Query with Empty Conditions", () => {
    it("handles facet query with empty filter conditions", async () => {
      const response = await request(app)
        .post("/api/query/facets")
        .send({
          sourceTable: "Referenda",
          columns: ["status"],
          filters: {
            operator: "AND",
            conditions: [
              { column: "id", operator: ">", value: "" }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.facets).toBeDefined();
      expect(response.body.facets.status).toBeDefined();
    });

    it("applies valid conditions in facet query while ignoring empty ones", async () => {
      const response = await request(app)
        .post("/api/query/facets")
        .send({
          sourceTable: "Referenda",
          columns: ["track"],
          filters: {
            operator: "AND",
            conditions: [
              { column: "id", operator: "=", value: "" },  // Ignored
              { column: "status", operator: "=", value: "Executed" }
            ]
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.facets).toBeDefined();
    });
  });
});

describe("Filters with JOINs and Ambiguous Column Names", () => {
  it("handles filters on ambiguous columns when JOINs are present", async () => {
    // This tests the fix for: when a query has JOINs and filters on a column
    // that exists in multiple tables (e.g., "id" in both Referenda and Categories),
    // the filter should add table prefix to avoid SQL "ambiguous column name" error
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "Referenda",
        columns: [
          { column: "id" },
          { column: "title" },
          { column: "status" },
          { column: "c.category", alias: "category" },
        ],
        joins: [
          {
            type: "LEFT",
            table: "Categories",
            alias: "c",
            on: {
              left: "Referenda.category_id",
              right: "c.id"
            }
          }
        ],
        filters: {
          operator: "AND",
          conditions: [
            { column: "id", operator: "=", value: 1 }
          ]
        },
        limit: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("handles facet queries with ambiguous columns when JOINs are present", async () => {
    // Test that facet queries also handle ambiguous columns correctly
    const response = await request(app)
      .post("/api/query/facets")
      .send({
        sourceTable: "Referenda",
        columns: ["status"],
        joins: [
          {
            type: "LEFT",
            table: "Categories",
            alias: "c",
            on: {
              left: "Referenda.category_id",
              right: "c.id"
            }
          }
        ],
        filters: {
          operator: "AND",
          conditions: [
            { column: "id", operator: ">", value: 100 }
          ]
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.facets).toBeDefined();
    expect(response.body.facets.status).toBeDefined();
  });

  it("preserves explicit table.column references in filters", async () => {
    // Test that if user explicitly specifies table.column, it's preserved
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "Referenda",
        columns: [
          { column: "id" },
          { column: "title" },
        ],
        joins: [
          {
            type: "LEFT",
            table: "Categories",
            alias: "c",
            on: {
              left: "Referenda.category_id",
              right: "c.id"
            }
          }
        ],
        filters: {
          operator: "AND",
          conditions: [
            { column: "Referenda.id", operator: "=", value: 1 }
          ]
        },
        limit: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });

  it("handles nested FilterGroups with JOINs", async () => {
    // Test that nested filter groups also handle ambiguous columns correctly
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "Referenda",
        columns: [
          { column: "id" },
          { column: "title" },
        ],
        joins: [
          {
            type: "LEFT",
            table: "Categories",
            alias: "c",
            on: {
              left: "Referenda.category_id",
              right: "c.id"
            }
          }
        ],
        filters: {
          operator: "OR",
          conditions: [
            {
              operator: "AND",
              conditions: [
                { column: "id", operator: "=", value: 1 }
              ]
            },
            {
              operator: "AND",
              conditions: [
                { column: "id", operator: "=", value: 2 }
              ]
            }
          ]
        },
        limit: 10
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });

  it("handles facet query on joined column with null value in IN filter", async () => {
    // Test that facet queries on joined columns (e.g., c.category) handle
    // null values in IN filters gracefully - IN with null should be skipped
    // (same as IN with empty array)
    const response = await request(app)
      .post("/api/query/facets")
      .send({
        sourceTable: "Referenda",
        columns: ["c.category"],
        joins: [
          {
            type: "LEFT",
            table: "Categories",
            alias: "c",
            on: {
              left: "Referenda.category_id",
              right: "c.id"
            }
          }
        ],
        filters: {
          operator: "AND",
          conditions: [
            { column: "c.category", operator: "IN", value: null }
          ]
        }
      });

    // Joined columns (c.category) are now allowed in facet queries
    // IN with null value is skipped (same as empty array)
    expect(response.status).toBe(200);
    expect(response.body.facets).toBeDefined();
    expect(response.body.facets["c.category"]).toBeDefined();
  });
});

describe("Filter Value Type Coercion", () => {
  // Tests for automatic type coercion when filtering TEXT columns with numeric values
  // SQLite doesn't automatically match TEXT '2025' with INTEGER 2025

  it("coerces numeric filter value to string for TEXT column (= operator)", async () => {
    // The 'year' column in all_spending view is computed TEXT, storing values like '2024', '2025'
    // When filtering with a numeric value like 2025, it should be coerced to '2025'
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "all_spending",
        columns: [{ column: "id" }, { column: "year" }],
        filters: {
          operator: "AND",
          conditions: [
            { column: "year", operator: "=", value: 2025 } // numeric value
          ]
        }
      });

    expect(response.status).toBe(200);
    // Should return rows with year '2025'
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.data.every((row: { year: string }) => row.year === "2025")).toBe(true);
  });

  it("coerces numeric filter values in IN operator for TEXT column", async () => {
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "all_spending",
        columns: [{ column: "id" }, { column: "year" }],
        filters: {
          operator: "AND",
          conditions: [
            { column: "year", operator: "IN", value: [2024, 2025] } // numeric values
          ]
        }
      });

    expect(response.status).toBe(200);
    // Should return rows with year '2024' or '2025'
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.data.every((row: { year: string }) =>
      row.year === "2024" || row.year === "2025"
    )).toBe(true);
  });

  it("coerces numeric filter values in NOT IN operator for TEXT column", async () => {
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "all_spending",
        columns: [{ column: "id" }, { column: "year" }],
        filters: {
          operator: "AND",
          conditions: [
            { column: "year", operator: "IS NOT NULL", value: null },
            { column: "year", operator: "NOT IN", value: [2024] } // numeric value
          ]
        }
      });

    expect(response.status).toBe(200);
    // Should return rows with non-null year that is NOT '2024'
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.data.every((row: { year: string }) => row.year !== "2024")).toBe(true);
  });

  it("coerces numeric filter value for view column with empty type info", async () => {
    // Views often have empty column type info in PRAGMA table_info
    // The 'year' column in all_spending view should still work with numeric filters
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "all_spending",
        columns: [{ column: "id" }, { column: "year" }],
        filters: {
          operator: "AND",
          conditions: [
            { column: "year", operator: "=", value: 2025 }
          ]
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.data.every((row: { year: string }) => row.year === "2025")).toBe(true);
  });

  it("coerces numeric filter value with table prefix (table.column)", async () => {
    // Test that all_spending.year filter also works with numeric value
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "all_spending",
        columns: [{ column: "id" }, { column: "year" }],
        filters: {
          operator: "AND",
          conditions: [
            { column: "all_spending.year", operator: "=", value: 2025 }
          ]
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("preserves numeric type for REAL/INTEGER columns", async () => {
    // DOT_latest is a REAL column - numeric values should NOT be converted to strings
    // Use a range filter that should return real data
    const response = await request(app)
      .post("/api/query/execute")
      .send({
        sourceTable: "Referenda",
        columns: [{ column: "id" }, { column: "DOT_latest" }],
        filters: {
          operator: "AND",
          conditions: [
            { column: "DOT_latest", operator: ">", value: 0 }
          ]
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    // Verify that DOT_latest values are numbers, not strings
    expect(response.body.data.every((row: { DOT_latest: number }) => typeof row.DOT_latest === "number")).toBe(true);
  });
});
