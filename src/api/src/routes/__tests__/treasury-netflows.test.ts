/**
 * Treasury Netflows Route Tests
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { treasuryNetflowsRouter } from "../treasury-netflows.js";
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
  app.use("/api/treasury-netflows", treasuryNetflowsRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Treasury Netflows" (
    "month" TEXT,
    "asset_name" TEXT,
    "flow_type" TEXT,
    "amount_usd" REAL,
    "amount_dot_equivalent" REAL
  );
`;

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  app = createApp();
});

beforeEach(() => {
  testDb.exec('DELETE FROM "Treasury Netflows"');
});

afterAll(() => {
  testDb.close();
});

describe("POST /api/treasury-netflows/import", () => {
  it("requires items array in request body", async () => {
    const response = await request(app)
      .post("/api/treasury-netflows/import")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("items must be an array");
  });

  it("validates required fields", async () => {
    const response = await request(app)
      .post("/api/treasury-netflows/import")
      .send({
        items: [
          { month: "2025-01", asset_name: "DOT" } // missing flow_type
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("must have month, asset_name, and flow_type");
  });

  it("validates month format YYYY-MM", async () => {
    const response = await request(app)
      .post("/api/treasury-netflows/import")
      .send({
        items: [
          { month: "01-2025", asset_name: "DOT", flow_type: "fees", amount_usd: 100, amount_dot_equivalent: 50 }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Invalid month format");
    expect(response.body.error).toContain("Expected YYYY-MM");
  });

  it("replaces all existing records with new data", async () => {
    // Insert initial data
    testDb.exec(`
      INSERT INTO "Treasury Netflows" (month, asset_name, flow_type, amount_usd, amount_dot_equivalent)
      VALUES ('2024-12', 'DOT', 'fees', 100.0, 50.0)
    `);

    const response = await request(app)
      .post("/api/treasury-netflows/import")
      .send({
        items: [
          { month: "2025-01", asset_name: "DOT", flow_type: "fees", amount_usd: 200.0, amount_dot_equivalent: 100.0 },
          { month: "2025-01", asset_name: "USDC", flow_type: "proposals", amount_usd: -300.0, amount_dot_equivalent: -150.0 }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(2);

    // Verify old data is gone
    const allRows = testDb.prepare('SELECT * FROM "Treasury Netflows"').all();
    expect(allRows).toHaveLength(2);
    expect(allRows.find((r: any) => r.month === "2024-12")).toBeUndefined();
    expect(allRows.find((r: any) => r.month === "2025-01")).toBeDefined();
  });

  it("handles negative values correctly", async () => {
    const response = await request(app)
      .post("/api/treasury-netflows/import")
      .send({
        items: [
          { month: "2025-01", asset_name: "DOT", flow_type: "proposals", amount_usd: -1500.50, amount_dot_equivalent: -750.25 }
        ]
      });

    expect(response.status).toBe(200);

    const row = testDb.prepare('SELECT * FROM "Treasury Netflows" WHERE flow_type = ?').get("proposals") as any;
    expect(row.amount_usd).toBe(-1500.50);
    expect(row.amount_dot_equivalent).toBe(-750.25);
  });

  it("allows duplicate keys via full table replacement", async () => {
    await request(app)
      .post("/api/treasury-netflows/import")
      .send({
        items: [
          { month: "2025-01", asset_name: "DOT", flow_type: "fees", amount_usd: 100, amount_dot_equivalent: 50 }
        ]
      });

    // Second import with same key but different amount
    const response = await request(app)
      .post("/api/treasury-netflows/import")
      .send({
        items: [
          { month: "2025-01", asset_name: "DOT", flow_type: "fees", amount_usd: 200, amount_dot_equivalent: 100 }
        ]
      });

    // Should succeed - full table replacement means old data is gone
    expect(response.status).toBe(200);

    const rows = testDb.prepare('SELECT * FROM "Treasury Netflows"').all();
    expect(rows).toHaveLength(1);
    expect((rows[0] as any).amount_usd).toBe(200); // Only new value exists
  });

  it("handles multiple assets and flow types", async () => {
    const response = await request(app)
      .post("/api/treasury-netflows/import")
      .send({
        items: [
          { month: "2025-01", asset_name: "DOT", flow_type: "fees", amount_usd: 100, amount_dot_equivalent: 50 },
          { month: "2025-01", asset_name: "DOT", flow_type: "inflation", amount_usd: 200, amount_dot_equivalent: 100 },
          { month: "2025-01", asset_name: "USDC", flow_type: "proposals", amount_usd: -300, amount_dot_equivalent: -150 },
          { month: "2025-02", asset_name: "DOT", flow_type: "fees", amount_usd: 150, amount_dot_equivalent: 75 }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(4);

    const rows = testDb.prepare('SELECT * FROM "Treasury Netflows"').all();
    expect(rows).toHaveLength(4);
  });
});
