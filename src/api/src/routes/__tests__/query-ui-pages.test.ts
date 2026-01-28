/**
 * UI Page Query Configuration Tests
 *
 * Tests the actual QueryConfig objects used in each migrated UI page to ensure
 * they execute successfully and return expected data structures.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { queryRouter } from "../query/index.js";
import Database from "better-sqlite3";
import type { QueryConfig } from "../../db/types.js";

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

// Comprehensive test schema matching production
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

  CREATE TABLE IF NOT EXISTS "Referenda" (
    "id" INTEGER PRIMARY KEY,
    "url" TEXT,
    "title" TEXT,
    "status" TEXT,
    "DOT_proposal_time" REAL,
    "USD_proposal_time" REAL,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "DOT_component" REAL,
    "USDC_component" REAL,
    "USDT_component" REAL,
    "track" TEXT,
    "tally_ayes" REAL,
    "tally_nays" REAL,
    "proposal_time" TEXT,
    "latest_status_change" TEXT,
    "category_id" INTEGER,
    "notes" TEXT,
    "hide_in_spends" INTEGER
  );

  CREATE TABLE IF NOT EXISTS "Treasury" (
    "id" INTEGER PRIMARY KEY,
    "referendumIndex" INTEGER,
    "beneficiary" TEXT,
    "status" TEXT,
    "description" TEXT,
    "DOT_proposal_time" REAL,
    "USD_proposal_time" REAL,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "DOT_component" REAL,
    "USDC_component" REAL,
    "USDT_component" REAL,
    "proposal_time" TEXT,
    "latest_status_change" TEXT,
    "validFrom" TEXT,
    "expireAt" TEXT,
    "url" TEXT
  );

  CREATE TABLE IF NOT EXISTS "Child Bounties" (
    "identifier" TEXT PRIMARY KEY,
    "parentBountyId" INTEGER,
    "description" TEXT,
    "status" TEXT,
    "DOT" REAL,
    "USD_proposal_time" REAL,
    "USD_latest" REAL,
    "proposal_time" TEXT,
    "latest_status_change" TEXT,
    "category_id" INTEGER,
    "notes" TEXT,
    "hide_in_spends" INTEGER,
    "url" TEXT
  );

  CREATE TABLE IF NOT EXISTS "Fellowship" (
    "id" INTEGER PRIMARY KEY,
    "status" TEXT,
    "description" TEXT,
    "DOT" REAL,
    "USD_latest" REAL,
    "latest_status_change" TEXT,
    "url" TEXT
  );

  CREATE TABLE IF NOT EXISTS "Fellowship Salary Cycles" (
    "cycle" INTEGER PRIMARY KEY,
    "budget_dot" REAL,
    "registeredCount" INTEGER,
    "registeredPaidCount" INTEGER,
    "registered_paid_amount_dot" REAL,
    "total_registrations_dot" REAL,
    "unregistered_paid_dot" REAL,
    "start_time" TEXT,
    "end_time" TEXT,
    "url" TEXT
  );

  CREATE TABLE IF NOT EXISTS "Fellowship Salary Claimants" (
    "display_name" TEXT,
    "address" TEXT PRIMARY KEY,
    "rank" INTEGER,
    "status_type" TEXT,
    "registered_amount_dot" REAL,
    "attempt_amount_dot" REAL,
    "attempt_id" INTEGER,
    "last_active_time" TEXT
  );

  CREATE VIEW IF NOT EXISTS "outstanding_claims" AS
    SELECT
      id, referendumIndex, description, url,
      DOT_component, USDT_component, USDC_component,
      validFrom, expireAt, latest_status_change,
      JULIANDAY(expireAt) - JULIANDAY('now') as days_until_expiry
    FROM "Treasury"
    WHERE status = 'Approved' AND JULIANDAY(expireAt) > JULIANDAY('now');

  CREATE VIEW IF NOT EXISTS "expired_claims" AS
    SELECT
      id, referendumIndex, description, url,
      DOT_component, USDT_component, USDC_component,
      validFrom, expireAt, latest_status_change,
      JULIANDAY('now') - JULIANDAY(expireAt) as days_since_expiry
    FROM "Treasury"
    WHERE status = 'Approved' AND JULIANDAY(expireAt) <= JULIANDAY('now');

  CREATE TABLE IF NOT EXISTS "Custom Table Metadata" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "table_name" TEXT NOT NULL UNIQUE,
    "display_name" TEXT NOT NULL,
    "schema_json" TEXT NOT NULL,
    "row_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);

  // Seed comprehensive test data
  testDb.exec(`
    -- Categories
    INSERT INTO "Categories" (id, category, subcategory)
    VALUES
      (1, 'Development', 'Polkadot Protocol & SDK'),
      (2, 'Marketing', 'Advertising');

    -- Bounties
    INSERT INTO "Bounties" (id, name, category_id, remaining_dot, url)
    VALUES
      (1, 'Test Bounty', 1, 1000, 'https://example.com/bounty/1');

    -- Referenda
    INSERT INTO "Referenda" (id, url, title, status, DOT_latest, USD_latest, track, category_id, notes, hide_in_spends, proposal_time, latest_status_change, DOT_component, USDC_component, USDT_component)
    VALUES
      (1, 'https://example.com/ref/1', 'Test Ref 1', 'Executed', 1000, 10000, 'Treasurer', 1, 'Test note', 0, '2024-01-01', '2024-01-15', 1000, 0, 0),
      (2, 'https://example.com/ref/2', 'Test Ref 2', 'Ongoing', 2000, 20000, 'SmallSpender', 2, NULL, 1, '2024-02-01', '2024-02-15', 2000, 0, 0);

    -- Treasury
    INSERT INTO "Treasury" (id, referendumIndex, beneficiary, status, description, DOT_latest, USD_latest, DOT_component, USDC_component, USDT_component, validFrom, expireAt, latest_status_change, url, proposal_time)
    VALUES
      (1, 100, '1test...address', 'Approved', 'Test claim', 500, 5000, 500, 0, 0, datetime('now', '-10 days'), datetime('now', '+20 days'), datetime('now', '-10 days'), 'https://example.com/treasury/1', datetime('now', '-10 days')),
      (2, 101, '2test...address', 'Approved', 'Expired claim', 800, 8000, 800, 0, 0, datetime('now', '-40 days'), datetime('now', '-5 days'), datetime('now', '-40 days'), 'https://example.com/treasury/2', datetime('now', '-40 days')),
      (3, 102, '3test...address', 'Paid', 'Paid claim', 1000, 10000, 1000, 0, 0, datetime('now', '-30 days'), datetime('now', '+10 days'), datetime('now', '-1 day'), 'https://example.com/treasury/3', datetime('now', '-30 days'));

    -- Child Bounties
    INSERT INTO "Child Bounties" (identifier, parentBountyId, description, status, DOT, USD_latest, category_id, notes, hide_in_spends, proposal_time, latest_status_change, url)
    VALUES
      ('1-1', 1, 'Test child bounty', 'Claimed', 100, 1000, 1, 'Test', 0, '2024-01-01', '2024-01-15', 'https://example.com/cb/1-1'),
      ('1-2', 1, 'Another child bounty', 'Active', 200, 2000, 2, NULL, 0, '2024-02-01', '2024-02-15', 'https://example.com/cb/1-2');

    -- Fellowship
    INSERT INTO "Fellowship" (id, status, description, DOT, USD_latest, latest_status_change, url)
    VALUES
      (1, 'Approved', 'Fellowship spend 1', 50, 500, '2024-01-01', 'https://example.com/fellowship/1'),
      (2, 'Paid', 'Fellowship spend 2', 100, 1000, '2024-02-01', 'https://example.com/fellowship/2');

    -- Fellowship Salary Cycles
    INSERT INTO "Fellowship Salary Cycles" (cycle, budget_dot, registeredCount, registeredPaidCount, registered_paid_amount_dot, total_registrations_dot, unregistered_paid_dot, start_time, end_time, url)
    VALUES
      (1, 10000, 10, 8, 8000, 9000, 500, '2024-01-01', '2024-01-31', 'https://example.com/salary/1'),
      (2, 12000, 12, 10, 10000, 11000, 800, '2024-02-01', '2024-02-28', 'https://example.com/salary/2');

    -- Fellowship Salary Claimants
    INSERT INTO "Fellowship Salary Claimants" (display_name, address, rank, status_type, registered_amount_dot, attempt_amount_dot, attempt_id, last_active_time)
    VALUES
      ('Alice', '1alice...addr', 4, 'Registered', 1000, NULL, NULL, '2024-01-15'),
      ('Bob', '2bob...addr', 2, 'Attempted', 500, 550, 123, '2024-01-20'),
      ('Charlie', '3charlie...addr', 6, 'Nothing', NULL, NULL, NULL, '2024-01-10');
  `);

  app = createApp();
});

afterAll(() => {
  testDb.close();
});

describe("UI Page QueryConfig Tests", () => {
  describe("Fellowship Page", () => {
    it("executes Fellowship page query successfully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Fellowship",
        columns: [
          { column: "id" },
          { column: "status" },
          { column: "description" },
          { column: "DOT" },
          { column: "USD_latest" },
          { column: "latest_status_change" },
          { column: "url" },
        ],
        filters: [],
        orderBy: [{ column: "id", direction: "DESC" }],
        limit: 1000,
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("id");
      expect(response.body.data[0]).toHaveProperty("status");
      expect(response.body.data[0]).toHaveProperty("DOT");
    });
  });

  describe("Referenda Page", () => {
    it("executes Referenda page query with JOINs successfully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Referenda",
        columns: [
          { column: "id" },
          { column: "url" },
          { column: "title" },
          { column: "status" },
          { column: "track" },
          { column: "DOT_proposal_time" },
          { column: "USD_proposal_time" },
          { column: "DOT_latest" },
          { column: "USD_latest" },
          { column: "tally_ayes" },
          { column: "tally_nays" },
          { column: "proposal_time" },
          { column: "latest_status_change" },
          { column: "category_id" },
          { column: "notes" },
          { column: "hide_in_spends" },
          { column: "c.category", alias: "category" },
          { column: "c.subcategory", alias: "subcategory" },
        ],
        joins: [{
          type: "LEFT",
          table: "Categories",
          alias: "c",
          on: { left: "Referenda.category_id", right: "c.id" }
        }],
        filters: [],
        orderBy: [{ column: "id", direction: "DESC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      if (response.status !== 200) {
        console.error("Referenda JOIN Error:", response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("id");
      expect(response.body.data[0]).toHaveProperty("category");
      expect(response.body.data[0]).toHaveProperty("subcategory");
      expect(response.body.sql).toContain("LEFT JOIN");
      expect(response.body.sql).toContain("Categories");
    });
  });

  describe("Treasury Page", () => {
    it("executes Treasury page query successfully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Treasury",
        columns: [
          { column: "id" },
          { column: "referendumIndex" },
          { column: "beneficiary" },
          { column: "status" },
          { column: "description" },
          { column: "DOT_proposal_time" },
          { column: "USD_proposal_time" },
          { column: "DOT_latest" },
          { column: "USD_latest" },
          { column: "DOT_component" },
          { column: "USDC_component" },
          { column: "USDT_component" },
          { column: "proposal_time" },
          { column: "latest_status_change" },
          { column: "url" },
        ],
        filters: [],
        orderBy: [{ column: "id", direction: "DESC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("id");
      expect(response.body.data[0]).toHaveProperty("beneficiary");
      expect(response.body.data[0]).toHaveProperty("DOT_component");
    });
  });

  describe("Fellowship Salary Cycles Page", () => {
    it("executes Fellowship Salary Cycles query successfully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Fellowship Salary Cycles",
        columns: [
          { column: "cycle" },
          { column: "budget_dot" },
          { column: "registeredCount" },
          { column: "registeredPaidCount" },
          { column: "registered_paid_amount_dot" },
          { column: "total_registrations_dot" },
          { column: "unregistered_paid_dot" },
          { column: "start_time" },
          { column: "end_time" },
        ],
        filters: [],
        orderBy: [{ column: "cycle", direction: "DESC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("cycle");
      expect(response.body.data[0]).toHaveProperty("budget_dot");
      expect(response.body.data[0]).toHaveProperty("registered_paid_amount_dot");
    });
  });

  describe("Fellowship Salary Claimants Page", () => {
    it("executes Fellowship Salary Claimants query successfully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Fellowship Salary Claimants",
        columns: [
          { column: "display_name" },
          { column: "address" },
          { column: "rank" },
          { column: "status_type" },
          { column: "registered_amount_dot" },
          { column: "attempt_amount_dot" },
          { column: "attempt_id" },
          { column: "last_active_time" },
        ],
        filters: [],
        orderBy: [{ column: "display_name", direction: "ASC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("display_name");
      expect(response.body.data[0]).toHaveProperty("rank");
      expect(response.body.data[0]).toHaveProperty("status_type");
    });

    it("supports status_type faceted filter", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Fellowship Salary Claimants",
        columns: [
          { column: "display_name" },
          { column: "address" },
          { column: "status_type" },
        ],
        filters: [
          { column: "status_type", operator: "IN", value: ["Registered", "Attempted"] }
        ],
        orderBy: [{ column: "display_name", direction: "ASC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
      // Should only contain Registered and Attempted
      const statuses = response.body.data.map((row: any) => row.status_type);
      expect(statuses.every((s: string) => ["Registered", "Attempted"].includes(s))).toBe(true);
    });
  });

  describe("Outstanding Claims Page (VIEW)", () => {
    it("executes Outstanding Claims VIEW query successfully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "outstanding_claims",
        columns: [
          { column: "validFrom" },
          { column: "DOT_component" },
          { column: "USDT_component" },
          { column: "USDC_component" },
          { column: "id" },
          { column: "referendumIndex" },
          { column: "description" },
          { column: "url" },
          { column: "expireAt" },
          { column: "latest_status_change" },
          { column: "days_until_expiry" },
        ],
        filters: [],
        orderBy: [{ column: "days_until_expiry", direction: "ASC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      // Should have at least one outstanding claim (expires in future)
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("days_until_expiry");
      expect(response.body.data[0]).toHaveProperty("DOT_component");
    });
  });

  describe("Expired Claims Page (VIEW)", () => {
    it("executes Expired Claims VIEW query successfully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "expired_claims",
        columns: [
          { column: "validFrom" },
          { column: "DOT_component" },
          { column: "USDT_component" },
          { column: "USDC_component" },
          { column: "id" },
          { column: "referendumIndex" },
          { column: "description" },
          { column: "url" },
          { column: "expireAt" },
          { column: "latest_status_change" },
          { column: "days_since_expiry" },
        ],
        filters: [],
        orderBy: [{ column: "days_since_expiry", direction: "DESC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      // Should have at least one expired claim
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty("days_since_expiry");
      expect(response.body.data[0]).toHaveProperty("DOT_component");
    });
  });

  describe("Child Bounties Page (Complex with 2 JOINs)", () => {
    it("executes Child Bounties query with 2 JOINs successfully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Child Bounties",
        columns: [
          { column: "identifier" },
          { column: "parentBountyId" },
          { column: "description" },
          { column: "status" },
          { column: "DOT" },
          { column: "USD_proposal_time" },
          { column: "proposal_time" },
          { column: "latest_status_change" },
          { column: "category_id" },
          { column: "notes" },
          { column: "hide_in_spends" },
          { column: "c.category", alias: "category" },
          { column: "c.subcategory", alias: "subcategory" },
          { column: "b.name", alias: "parentBountyName" },
        ],
        joins: [
          {
            type: "LEFT",
            table: "Categories",
            alias: "c",
            on: {
              left: "Child Bounties.category_id",
              right: "c.id",
            },
          },
          {
            type: "LEFT",
            table: "Bounties",
            alias: "b",
            on: {
              left: "Child Bounties.parentBountyId",
              right: "b.id",
            },
          },
        ],
        filters: [],
        orderBy: [{ column: "identifier", direction: "DESC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      if (response.status !== 200) {
        console.error("Child Bounties JOIN Error:", response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify JOINed columns are present
      expect(response.body.data[0]).toHaveProperty("identifier");
      expect(response.body.data[0]).toHaveProperty("category");
      expect(response.body.data[0]).toHaveProperty("subcategory");
      expect(response.body.data[0]).toHaveProperty("parentBountyName");

      // Verify SQL contains both JOINs
      expect(response.body.sql).toContain("LEFT JOIN");
      expect(response.body.sql).toContain("Categories");
      expect(response.body.sql).toContain("Bounties");
    });

    it("supports status faceted filter on Child Bounties", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Child Bounties",
        columns: [
          { column: "identifier" },
          { column: "status" },
          { column: "description" },
        ],
        filters: [
          { column: "status", operator: "=", value: "Claimed" }
        ],
        orderBy: [{ column: "identifier", direction: "DESC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
      // All results should have status "Claimed"
      expect(response.body.data.every((row: any) => row.status === "Claimed")).toBe(true);
    });

    it("filters by parentBountyId correctly with JOINs", async () => {
      // Seed specific test data with different parentBountyIds
      testDb.exec(`DELETE FROM "Child Bounties"`);
      testDb.exec(`DELETE FROM "Bounties"`);

      testDb.exec(`
        INSERT INTO "Bounties" (id, name, category_id)
        VALUES
          (13, 'Parent Bounty 13', 1),
          (17, 'Parent Bounty 17', 1),
          (33, 'Parent Bounty 33', 2)
      `);

      testDb.exec(`
        INSERT INTO "Child Bounties" (identifier, parentBountyId, description, status, category_id)
        VALUES
          ('13_1001', 13, 'Child of bounty 13 - first', 'Active', 1),
          ('13_1002', 13, 'Child of bounty 13 - second', 'Pending', 1),
          ('17_2001', 17, 'Child of bounty 17 - first', 'Active', 1),
          ('17_2002', 17, 'Child of bounty 17 - second', 'Claimed', 2),
          ('33_3001', 33, 'Child of bounty 33 - first', 'Active', 2)
      `);

      // Query with JOINs and filter by parentBountyId = 17
      const queryConfig: QueryConfig = {
        sourceTable: "Child Bounties",
        columns: [
          { column: "identifier" },
          { column: "parentBountyId" },
          { column: "description" },
          { column: "status" },
          { column: "c.category", alias: "category" },
          { column: "b.name", alias: "parentBountyName" },
        ],
        joins: [
          {
            type: "LEFT",
            table: "Categories",
            alias: "c",
            on: {
              left: "Child Bounties.category_id",
              right: "c.id",
            },
          },
          {
            type: "LEFT",
            table: "Bounties",
            alias: "b",
            on: {
              left: "Child Bounties.parentBountyId",
              right: "b.id",
            },
          },
        ],
        filters: [
          { column: "parentBountyId", operator: "=", value: 17 }
        ],
        orderBy: [{ column: "identifier", direction: "ASC" }],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      if (response.status !== 200) {
        console.error("Filter Error:", response.body);
        console.error("Generated SQL:", response.body.sql);
      }

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);

      // CRITICAL: Should only return Child Bounties with parentBountyId = 17
      expect(response.body.data.length).toBe(2);
      expect(response.body.data.every((row: any) => row.parentBountyId === 17)).toBe(true);

      // Verify the correct identifiers
      const identifiers = response.body.data.map((row: any) => row.identifier);
      expect(identifiers).toEqual(['17_2001', '17_2002']);

      // Verify SQL contains WHERE clause with parentBountyId
      expect(response.body.sql).toContain("WHERE");
      expect(response.body.sql).toContain("parentBountyId");
    });

    it("filters facets by parentBountyId with FilterGroup format", async () => {
      // Seed specific test data with different parentBountyIds
      testDb.exec(`DELETE FROM "Child Bounties"`);
      testDb.exec(`DELETE FROM "Bounties"`);

      testDb.exec(`
        INSERT INTO "Bounties" (id, name, category_id)
        VALUES
          (13, 'Parent Bounty 13', 1),
          (17, 'Parent Bounty 17', 1),
          (33, 'Parent Bounty 33', 2)
      `);

      testDb.exec(`
        INSERT INTO "Child Bounties" (identifier, parentBountyId, description, status, category_id)
        VALUES
          ('13_1001', 13, 'Child of bounty 13 - first', 'Active', 1),
          ('13_1002', 13, 'Child of bounty 13 - second', 'Pending', 1),
          ('17_2001', 17, 'Child of bounty 17 - first', 'Active', 1),
          ('17_2002', 17, 'Child of bounty 17 - second', 'Claimed', 2),
          ('33_3001', 33, 'Child of bounty 33 - first', 'Active', 2)
      `);

      // Request facets with FilterGroup format filtering by parentBountyId = 17
      const facetRequest = {
        sourceTable: "Child Bounties",
        columns: ["status"],
        filters: {
          operator: "AND",
          conditions: [
            { column: "parentBountyId", operator: "=", value: 17 }
          ]
        }
      };

      const response = await request(app)
        .post("/api/query/facets")
        .send(facetRequest);

      if (response.status !== 200) {
        console.error("Facet Error:", response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body.facets).toBeDefined();
      expect(response.body.facets.status).toBeDefined();

      // CRITICAL: Facets should only include status values from parentBountyId = 17
      // We have: 17_2001 (Active) and 17_2002 (Claimed)
      const statusFacets = response.body.facets.status;
      const facetValues = statusFacets.map((f: any) => f.value);

      // Should only have Active and Claimed (from bounty 17), NOT Pending (from bounty 13)
      expect(facetValues).toContain("Active");
      expect(facetValues).toContain("Claimed");
      expect(facetValues).not.toContain("Pending");

      // Total count across facets should be 2 (the two rows with parentBountyId = 17)
      const totalCount = statusFacets.reduce((sum: number, f: any) => sum + f.count, 0);
      expect(totalCount).toBe(2);
    });
  });

  describe("Tally Columns", () => {
    it("handles tally_ayes and tally_nays columns correctly", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Referenda",
        columns: [
          { column: "id" },
          { column: "tally_ayes" },
          { column: "tally_nays" },
        ],
        filters: [],
        limit: 10
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      // Verify the SQL properly quotes tally columns
      expect(response.body.sql).toContain('"tally_ayes"');
      expect(response.body.sql).toContain('"tally_nays"');
    });
  });

  describe("Multi-Currency Columns", () => {
    it("handles DOT, USDC, and USDT component columns", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Treasury",
        columns: [
          { column: "id" },
          { column: "DOT_component" },
          { column: "USDC_component" },
          { column: "USDT_component" },
        ],
        filters: [],
        limit: 10
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data[0]).toHaveProperty("DOT_component");
      expect(response.body.data[0]).toHaveProperty("USDC_component");
      expect(response.body.data[0]).toHaveProperty("USDT_component");
    });
  });

  describe("Default Sorting", () => {
    it("respects DESC sorting on Referenda id", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Referenda",
        columns: [{ column: "id" }],
        filters: [],
        orderBy: [{ column: "id", direction: "DESC" }],
        limit: 10
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(1);

      // Verify descending order
      const ids = response.body.data.map((row: any) => row.id);
      expect(ids[0]).toBeGreaterThan(ids[ids.length - 1]);
    });

    it("respects ASC sorting on Fellowship Salary Claimants display_name", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Fellowship Salary Claimants",
        columns: [{ column: "display_name" }],
        filters: [],
        orderBy: [{ column: "display_name", direction: "ASC" }],
        limit: 10
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(1);

      // Verify ascending order
      const names = response.body.data.map((row: any) => row.display_name);
      expect(names[0] <= names[names.length - 1]).toBe(true);
    });
  });

  describe("Limit Enforcement", () => {
    it("respects limit of 1000 rows", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Referenda",
        columns: [{ column: "id" }],
        filters: [],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(200);
      expect(response.body.sql).toContain("LIMIT 1000");
    });
  });

  describe("Error Handling", () => {
    it("rejects invalid sourceTable from UI", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "NonExistentTable",
        columns: [{ column: "id" }],
        filters: [],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid source table");
    });

    it("rejects invalid column from UI", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Referenda",
        columns: [{ column: "nonexistent_column_xyz" }],
        filters: [],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      // Should fail when trying to execute the query
      expect([500]).toContain(response.status);
    });

    it("handles JOIN with non-existent table gracefully", async () => {
      const queryConfig: QueryConfig = {
        sourceTable: "Referenda",
        columns: [{ column: "id" }],
        joins: [{
          type: "LEFT",
          table: "InvalidTable",
          alias: "x",
          on: { left: "Referenda.id", right: "x.id" }
        }],
        filters: [],
        limit: 1000
      };

      const response = await request(app)
        .post("/api/query/execute")
        .send(queryConfig);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid join table");
    });
  });
});
