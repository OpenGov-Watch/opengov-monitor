/**
 * Test database factory for creating in-memory SQLite databases.
 * Mirrors the schema from backend/data_sinks/sqlite/schema.py
 */

import Database from "better-sqlite3";
import { TABLE_NAMES, VIEW_NAMES } from "../db/types";

let testDb: Database.Database | null = null;

// Schema SQL matching backend/data_sinks/sqlite/schema.py
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.referenda}" (
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

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.treasury}" (
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

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.childBounties}" (
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

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.fellowship}" (
    "id" INTEGER PRIMARY KEY,
    "url" TEXT,
    "status" TEXT,
    "description" TEXT,
    "DOT" REAL,
    "USD_proposal_time" REAL,
    "proposal_time" TEXT,
    "latest_status_change" TEXT,
    "USD_latest" REAL
  );

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.fellowshipSalaryCycles}" (
    "cycle" INTEGER PRIMARY KEY,
    "url" TEXT,
    "budget_dot" REAL,
    "registeredCount" INTEGER,
    "registeredPaidCount" INTEGER,
    "registered_paid_amount_dot" REAL,
    "total_registrations_dot" REAL,
    "unregistered_paid_dot" REAL,
    "registration_period" INTEGER,
    "payout_period" INTEGER,
    "start_block" INTEGER,
    "end_block" INTEGER,
    "start_time" TEXT,
    "end_time" TEXT
  );

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.fellowshipSalaryClaimants}" (
    "address" TEXT PRIMARY KEY,
    "display_name" TEXT,
    "name" TEXT,
    "short_address" TEXT,
    "status_type" TEXT,
    "registered_amount_dot" REAL,
    "attempt_amount_dot" REAL,
    "attempt_id" INTEGER,
    "last_active_time" TEXT,
    "rank" INTEGER
  );

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.categories}" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT,
    "subcategory" TEXT
  );

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.bounties}" (
    "id" INTEGER PRIMARY KEY,
    "name" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "remaining_dot" REAL,
    "url" TEXT
  );

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.subtreasury}" (
    "id" INTEGER PRIMARY KEY,
    "title" TEXT,
    "description" TEXT,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "DOT_component" REAL,
    "USDC_component" REAL,
    "USDT_component" REAL,
    "category" TEXT,
    "subcategory" TEXT,
    "latest_status_change" TEXT,
    "url" TEXT
  );

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.fellowshipSubtreasury}" (
    "id" INTEGER PRIMARY KEY,
    "url" TEXT,
    "title" TEXT,
    "status" TEXT,
    "DOT_proposal_time" REAL,
    "USD_proposal_time" REAL,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "proposal_time" TEXT,
    "latest_status_change" TEXT,
    "validFrom" TEXT,
    "expireAt" TEXT
  );

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.dashboards}" (
    "id" INTEGER PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "created_at" TEXT,
    "updated_at" TEXT
  );

  CREATE TABLE IF NOT EXISTS "${TABLE_NAMES.dashboardComponents}" (
    "id" INTEGER PRIMARY KEY,
    "dashboard_id" INTEGER,
    "name" TEXT,
    "type" TEXT,
    "query_config" TEXT,
    "grid_config" TEXT,
    "chart_config" TEXT,
    "created_at" TEXT,
    "updated_at" TEXT
  );
`;

// View SQL matching backend/data_sinks/sqlite/sink.py
const VIEWS_SQL = `
  CREATE VIEW IF NOT EXISTS "${VIEW_NAMES.outstandingClaims}" AS
    SELECT
        id, url, referendumIndex, status, description,
        DOT_proposal_time, USD_proposal_time,
        DOT_latest, USD_latest,
        DOT_component, USDC_component, USDT_component,
        proposal_time, latest_status_change, validFrom, expireAt,
        CASE WHEN validFrom <= datetime('now') THEN 'active' ELSE 'upcoming' END AS claim_type,
        CAST((julianday(expireAt) - julianday('now')) AS INTEGER) AS days_until_expiry,
        CAST((julianday(validFrom) - julianday('now')) AS INTEGER) AS days_until_valid
    FROM "${TABLE_NAMES.treasury}"
    WHERE status = 'Approved'
      AND expireAt > datetime('now');

  CREATE VIEW IF NOT EXISTS "${VIEW_NAMES.expiredClaims}" AS
    SELECT
        id, url, referendumIndex, status, description,
        DOT_proposal_time, USD_proposal_time,
        DOT_latest, USD_latest,
        DOT_component, USDC_component, USDT_component,
        proposal_time, latest_status_change, validFrom, expireAt,
        CAST((julianday('now') - julianday(expireAt)) AS INTEGER) AS days_since_expiry
    FROM "${TABLE_NAMES.treasury}"
    WHERE status = 'Approved'
      AND expireAt < datetime('now');
`;

export function createTestDatabase(): Database.Database {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  testDb.exec(VIEWS_SQL);
  return testDb;
}

export function getTestDatabase(): Database.Database {
  if (!testDb) {
    return createTestDatabase();
  }
  return testDb;
}

export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

export function resetTestDatabase(): void {
  closeTestDatabase();
  createTestDatabase();
}

/**
 * Seed test data into a table
 */
export function seedTestData(
  db: Database.Database,
  table: string,
  data: Record<string, unknown>[]
): void {
  if (data.length === 0) return;

  const columns = Object.keys(data[0]);
  const placeholders = columns.map(() => "?").join(", ");
  const stmt = db.prepare(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`
  );

  for (const row of data) {
    stmt.run(...columns.map((c) => row[c]));
  }
}

// Test fixtures
export const fixtures = {
  referenda: [
    {
      id: 1,
      url: "https://polkadot.subsquare.io/referenda/1",
      title: "Test Referendum 1",
      status: "Executed",
      DOT_proposal_time: 1000,
      USD_proposal_time: 5000,
      track: "Treasurer",
      "tally.ayes": 100000,
      "tally.nays": 10000,
      proposal_time: "2024-01-01 00:00:00",
      latest_status_change: "2024-01-15 00:00:00",
      DOT_latest: 1100,
      USD_latest: 5500,
      DOT_component: 500,
      USDC_component: 300,
      USDT_component: 200,
      category: "Development",
      subcategory: "Infrastructure",
    },
    {
      id: 2,
      url: "https://polkadot.subsquare.io/referenda/2",
      title: "Test Referendum 2",
      status: "Ongoing",
      DOT_proposal_time: 2000,
      USD_proposal_time: 10000,
      track: "SmallSpender",
      "tally.ayes": 50000,
      "tally.nays": 5000,
      proposal_time: "2024-02-01 00:00:00",
      latest_status_change: "2024-02-10 00:00:00",
      DOT_latest: 2100,
      USD_latest: 10500,
      DOT_component: 1000,
      USDC_component: 600,
      USDT_component: 400,
      category: null,
      subcategory: null,
    },
  ],

  treasury: [
    {
      id: 1,
      url: "https://polkadot.subsquare.io/treasury/1",
      referendumIndex: 1,
      status: "Approved",
      description: "Active claim",
      DOT_proposal_time: 1000,
      USD_proposal_time: 5000,
      proposal_time: "2024-01-01 00:00:00",
      latest_status_change: "2024-01-15 00:00:00",
      DOT_latest: 1100,
      USD_latest: 5500,
      DOT_component: 500,
      USDC_component: 300,
      USDT_component: 200,
      validFrom: "2024-01-01 00:00:00",
      expireAt: "2099-12-31 00:00:00", // Far future
    },
    {
      id: 2,
      url: "https://polkadot.subsquare.io/treasury/2",
      referendumIndex: 2,
      status: "Paid",
      description: "Paid claim",
      DOT_proposal_time: 2000,
      USD_proposal_time: 10000,
      proposal_time: "2024-02-01 00:00:00",
      latest_status_change: "2024-02-15 00:00:00",
      DOT_latest: 2100,
      USD_latest: 10500,
      DOT_component: 1000,
      USDC_component: 600,
      USDT_component: 400,
      validFrom: "2024-02-01 00:00:00",
      expireAt: "2024-03-01 00:00:00",
    },
  ],

  childBounties: [
    {
      identifier: "10-1",
      url: "https://polkadot.subsquare.io/child-bounty/10-1",
      index: 1,
      parentBountyId: 10,
      status: "Claimed",
      description: "Child Bounty 1",
      DOT: 100,
      USD_proposal_time: 500,
      beneficiary: "addr1",
      proposal_time: "2024-01-01 00:00:00",
      latest_status_change: "2024-01-15 00:00:00",
      USD_latest: 550,
      category: "Development",
      subcategory: "Tooling",
    },
    {
      identifier: "10-2",
      url: "https://polkadot.subsquare.io/child-bounty/10-2",
      index: 2,
      parentBountyId: 10,
      status: "Pending",
      description: "Child Bounty 2",
      DOT: 200,
      USD_proposal_time: 1000,
      beneficiary: "addr2",
      proposal_time: "2024-02-01 00:00:00",
      latest_status_change: "2024-02-10 00:00:00",
      USD_latest: 1100,
      category: null,
      subcategory: null,
    },
  ],

  categories: [
    { id: 1, category: "Development", subcategory: "Infrastructure" },
    { id: 2, category: "Development", subcategory: "Tooling" },
    { id: 3, category: "Marketing", subcategory: "Events" },
  ],

  bounties: [
    {
      id: 10,
      name: "Parent Bounty 1",
      category: "Development",
      subcategory: "Infrastructure",
      remaining_dot: 5000,
      url: "https://polkadot.subsquare.io/bounty/10",
    },
  ],

  dashboards: [
    {
      id: 1,
      name: "Test Dashboard",
      description: "A test dashboard",
      created_at: "2024-01-01 00:00:00",
      updated_at: "2024-01-15 00:00:00",
    },
  ],

  dashboardComponents: [
    {
      id: 1,
      dashboard_id: 1,
      name: "Test Component",
      type: "table",
      query_config: JSON.stringify({
        sourceTable: "Referenda",
        columns: [{ column: "id" }],
        filters: [],
      }),
      grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
      chart_config: null,
      created_at: "2024-01-01 00:00:00",
      updated_at: "2024-01-15 00:00:00",
    },
  ],
};
