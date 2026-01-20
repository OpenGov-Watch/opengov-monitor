/**
 * Apply Defaults Integration Tests
 *
 * End-to-end integration tests that simulate the complete "Apply Defaults" workflow
 * as a user would experience it in the UI. This tests the multi-step process of:
 * 1. Fetching default CSV files via /api/sync/defaults/*
 * 2. Parsing the CSV content
 * 3. Resolving category strings to category IDs via /api/categories/lookup
 * 4. Importing the resolved data via /api/referenda/import or /api/child-bounties/import
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import request from "supertest";
import express from "express";
import Database from "better-sqlite3";

let testDb: Database.Database;

// Mock fs module for file operations
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "fs";
import { syncRouter } from "../sync.js";
import { categoriesRouter } from "../categories.js";
import { referendaRouter } from "../referenda.js";
import { childBountiesRouter } from "../child-bounties.js";
import { bountiesRouter } from "../bounties.js";

// Mock database to use test database
vi.mock("../../db/index.js", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
}));

// Mock auth middleware to allow all requests in tests
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Create Express app with all required routers
function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/sync", syncRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/referenda", referendaRouter);
  app.use("/api/child-bounties", childBountiesRouter);
  app.use("/api/bounties", bountiesRouter);
  return app;
}

// Database schema for all required tables
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Categories" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT,
    "subcategory" TEXT
  );
  CREATE TABLE IF NOT EXISTS "Referenda" (
    "id" INTEGER PRIMARY KEY,
    "title" TEXT,
    "status" TEXT,
    "category_id" INTEGER,
    "notes" TEXT,
    "hide_in_spends" INTEGER
  );
  CREATE TABLE IF NOT EXISTS "Bounties" (
    "id" INTEGER PRIMARY KEY,
    "name" TEXT,
    "category_id" INTEGER
  );
  CREATE TABLE IF NOT EXISTS "Child Bounties" (
    "identifier" TEXT PRIMARY KEY,
    "parentBountyId" INTEGER,
    "description" TEXT,
    "status" TEXT,
    "category_id" INTEGER,
    "notes" TEXT,
    "hide_in_spends" INTEGER
  );
`;

// Helper function to parse CSV (mimics frontend behavior)
function parseCSVForTest(content: string): Array<{
  id?: number;
  identifier?: string;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  hide_in_spends: number;
}> {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",");
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: Record<string, string> = {};

    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });

    const parsed: {
      id?: number;
      identifier?: string;
      category: string | null;
      subcategory: string | null;
      notes: string | null;
      hide_in_spends: number;
    } = {
      category: row.category || null,
      subcategory: row.subcategory || null,
      notes: row.notes || null,
      hide_in_spends: row.hide_in_spends === "1" ? 1 : 0,
    };

    // Handle referenda (has id) vs child bounties (has identifier)
    if (row.id) {
      parsed.id = parseInt(row.id);
    }
    if (row.identifier) {
      parsed.identifier = row.identifier;
    }

    rows.push(parsed);
  }

  return rows;
}

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  app = createApp();
});

beforeEach(() => {
  // Clear all tables
  testDb.exec('DELETE FROM "Referenda"');
  testDb.exec('DELETE FROM "Child Bounties"');
  testDb.exec('DELETE FROM "Categories"');
  testDb.exec('DELETE FROM "Bounties"');

  // Seed existing categories (to test reuse and validation)
  testDb.exec(`
    INSERT INTO "Categories" (id, category, subcategory)
    VALUES (1, 'Development', 'Core'),
           (2, 'Outreach', 'Content'),
           (3, 'Development', 'Smart Contracts'),
           (4, 'New Category', 'New Subcategory'),
           (5, 'Development', ''),
           (6, 'Outreach', 'Advertising')
  `);

  // Seed existing referenda (to test updates)
  testDb.exec(`
    INSERT INTO "Referenda" (id, title, status, category_id, notes, hide_in_spends)
    VALUES (1, 'Existing Referendum', 'Executed', NULL, NULL, 0),
           (100, 'Another Ref', 'Approved', NULL, NULL, 0),
           (231, 'Hidden Ref', 'Executed', NULL, NULL, 0),
           (500, 'New Item Ref', 'Pending', NULL, NULL, 0)
  `);

  // Seed parent bounties for child bounties
  testDb.exec(`
    INSERT INTO "Bounties" (id, name)
    VALUES (13, 'Parent Bounty 13'),
           (33, 'Parent Bounty 33'),
           (17, 'Parent Bounty 17'),
           (99, 'Parent Bounty 99')
  `);

  // Seed existing child bounties (using underscore format per data model spec)
  testDb.exec(`
    INSERT INTO "Child Bounties" (identifier, parentBountyId, description, status)
    VALUES ('13_1332', 13, 'Existing CB', 'Claimed'),
           ('33_331193', 33, 'Another CB', 'Active'),
           ('17_17111', 17, 'Third CB', 'Pending'),
           ('99_9999', 99, 'Fourth CB', 'Pending')
  `);

  // Clear mocks before each test
  vi.clearAllMocks();
});

afterAll(() => {
  testDb.close();
});

describe("Apply Defaults Integration Tests", () => {
  describe("Referenda Apply Defaults Workflow", () => {
    const mockReferendaCSV = `id,category,subcategory,notes,hide_in_spends
1,Development,Core,Updated note,0
100,Outreach,Content,,0
231,,,,1
500,New Category,New Subcategory,New item,0`;

    it("should complete full workflow: fetch CSV → parse → lookup categories → import", async () => {
      // 1. Mock fs to return CSV
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockReferendaCSV);

      // 2. Fetch CSV via sync endpoint
      const syncResponse = await request(app).get(
        "/api/sync/defaults/referenda"
      );
      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.content).toBe(mockReferendaCSV);

      // 3. Parse CSV (simulating frontend parseReferendaCSV)
      const parsedItems = parseCSVForTest(mockReferendaCSV);
      expect(parsedItems).toHaveLength(4);

      // 4. Send category strings directly - backend will resolve them
      const items = parsedItems.map((item) => ({
        id: item.id!,
        category: item.category,
        subcategory: item.subcategory,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

      // 5. Import
      const importResponse = await request(app)
        .post("/api/referenda/import")
        .send({ items });
      expect(importResponse.status).toBe(200);
      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.count).toBeGreaterThan(0);

      // 6. Verify database state

      // Check existing categories were reused (ID should be 1)
      const existingCategory = testDb
        .prepare(
          'SELECT * FROM "Categories" WHERE category = ? AND subcategory = ?'
        )
        .get("Development", "Core") as {
        id: number;
        category: string;
        subcategory: string;
      };
      expect(existingCategory.id).toBe(1); // Existing ID, not new

      // Check seeded category exists (no longer auto-created)
      const newCategory = testDb
        .prepare('SELECT * FROM "Categories" WHERE category = ?')
        .get("New Category") as {
        id: number;
        category: string;
        subcategory: string;
      };
      expect(newCategory).toBeDefined();
      expect(newCategory.id).toBe(4); // Pre-seeded category
      expect(newCategory.subcategory).toBe("New Subcategory");

      // Check referenda were updated
      const ref1 = testDb
        .prepare('SELECT * FROM "Referenda" WHERE id = 1')
        .get() as {
        category_id: number;
        notes: string;
        hide_in_spends: number;
      };
      expect(ref1.category_id).toBe(1); // Development/Core
      expect(ref1.notes).toBe("Updated note");
      expect(ref1.hide_in_spends).toBe(0);

      const ref100 = testDb
        .prepare('SELECT * FROM "Referenda" WHERE id = 100')
        .get() as {
        category_id: number;
      };
      expect(ref100.category_id).toBe(2); // Outreach/Content (existing category)

      const ref231 = testDb
        .prepare('SELECT * FROM "Referenda" WHERE id = 231')
        .get() as {
        category_id: number | null;
        hide_in_spends: number;
      };
      expect(ref231.category_id).toBeNull(); // Empty category in CSV
      expect(ref231.hide_in_spends).toBe(1);

      const ref500 = testDb
        .prepare('SELECT * FROM "Referenda" WHERE id = 500')
        .get() as {
        category_id: number;
        notes: string;
      };
      expect(ref500.category_id).toBe(newCategory.id); // New category
      expect(ref500.notes).toBe("New item");

      // Check total category count (should not change - all categories pre-seeded)
      const categoryCount = testDb
        .prepare('SELECT COUNT(*) as count FROM "Categories"')
        .get() as { count: number };
      expect(categoryCount.count).toBe(6); // All pre-seeded categories
    });

    it("should reject import when category doesn't exist", async () => {
      const csvWithInvalidCategory = `id,category,subcategory,notes,hide_in_spends
1,Nonexistent Category,Nonexistent Sub,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithInvalidCategory);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/referenda"
      );
      const parsedItems = parseCSVForTest(syncResponse.body.content);

      const items = parsedItems.map((item) => ({
        id: item.id!,
        category: item.category,
        subcategory: item.subcategory,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

      // Import should fail with validation error
      const importResponse = await request(app)
        .post("/api/referenda/import")
        .send({ items });

      expect(importResponse.status).toBe(400);
      expect(importResponse.body.error).toContain("Import rejected");
      expect(importResponse.body.error).toContain("non-existent categories");
      expect(importResponse.body.error).toContain("Row 2"); // Row 2 (1 + header)
      expect(importResponse.body.error).toContain("Nonexistent Category");
      expect(importResponse.body.error).toContain("Nonexistent Sub");
    });

    it("should show first 10 violations when many invalid categories", async () => {
      // Create CSV with 15 invalid categories
      const rows = Array.from({ length: 15 }, (_, i) =>
        `${i + 1},Invalid Cat ${i},Invalid Sub ${i},,0`
      );
      const csvWithManyInvalid = `id,category,subcategory,notes,hide_in_spends\n${rows.join("\n")}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithManyInvalid);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/referenda"
      );
      const parsedItems = parseCSVForTest(syncResponse.body.content);

      const items = parsedItems.map((item) => ({
        id: item.id!,
        category: item.category,
        subcategory: item.subcategory,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

      const importResponse = await request(app)
        .post("/api/referenda/import")
        .send({ items });

      expect(importResponse.status).toBe(400);
      expect(importResponse.body.error).toContain("15 row(s)");
      expect(importResponse.body.error).toContain("First 10 violations");

      // Verify first 10 are shown
      expect(importResponse.body.error).toContain("Invalid Cat 0");
      expect(importResponse.body.error).toContain("Invalid Cat 9");

      // Verify 11th+ are not shown (only first 10)
      expect(importResponse.body.error).not.toContain("Invalid Cat 10");
      expect(importResponse.body.error).not.toContain("Invalid Cat 14");
    });

    it("should reuse existing categories when they match", async () => {
      const csvWithExistingCategory = `id,category,subcategory,notes,hide_in_spends
1,Development,Core,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithExistingCategory);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/referenda"
      );
      const parsedItems = parseCSVForTest(syncResponse.body.content);

      const categoryResponse = await request(app)
        .post("/api/categories/lookup")
        .send({
          category: parsedItems[0].category!,
          subcategory: parsedItems[0].subcategory!,
        });

      expect(categoryResponse.status).toBe(200);
      expect(categoryResponse.body.id).toBe(1); // Existing category ID

      // Verify category count didn't increase
      const categoryCount = testDb
        .prepare('SELECT COUNT(*) as count FROM "Categories"')
        .get() as { count: number };
      expect(categoryCount.count).toBe(6); // Still only seeded categories
    });

    it("should handle empty subcategories", async () => {
      const csvWithEmptySubcategory = `id,category,subcategory,notes,hide_in_spends
1,Development,,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithEmptySubcategory);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/referenda"
      );
      const parsedItems = parseCSVForTest(syncResponse.body.content);

      const categoryResponse = await request(app)
        .post("/api/categories/lookup")
        .send({
          category: parsedItems[0].category!,
          subcategory: "",
        });

      expect(categoryResponse.status).toBe(200);
      expect(categoryResponse.body.category).toBe("Development");
      // Empty string is converted to NULL (represents "Other")
      expect(categoryResponse.body.subcategory).toBeNull();
    });

    it("should handle hide_in_spends flags", async () => {
      const csvWithHideFlags = `id,category,subcategory,notes,hide_in_spends
1,Development,Core,,1
100,Outreach,Content,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithHideFlags);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/referenda"
      );
      const parsedItems = parseCSVForTest(syncResponse.body.content);

      const items = [];
      for (const item of parsedItems) {
        const categoryResponse = await request(app)
          .post("/api/categories/lookup")
          .send({ category: item.category!, subcategory: item.subcategory! });
        items.push({
          id: item.id!,
          category_id: categoryResponse.body.id,
          hide_in_spends: item.hide_in_spends,
        });
      }

      await request(app).post("/api/referenda/import").send({ items });

      const ref1 = testDb
        .prepare('SELECT hide_in_spends FROM "Referenda" WHERE id = 1')
        .get() as { hide_in_spends: number };
      expect(ref1.hide_in_spends).toBe(1);

      const ref100 = testDb
        .prepare('SELECT hide_in_spends FROM "Referenda" WHERE id = 100')
        .get() as { hide_in_spends: number };
      expect(ref100.hide_in_spends).toBe(0);
    });

    it("should return 404 when default file doesn't exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const response = await request(app).get("/api/sync/defaults/referenda");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Default file not found");
    });

    it("should handle empty CSV file", async () => {
      const emptyCSV = `id,category,subcategory,notes,hide_in_spends`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(emptyCSV);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/referenda"
      );
      expect(syncResponse.status).toBe(200);

      const parsedItems = parseCSVForTest(syncResponse.body.content);
      expect(parsedItems).toHaveLength(0);

      const importResponse = await request(app)
        .post("/api/referenda/import")
        .send({ items: [] });

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.count).toBe(0);
    });

    it("should handle large CSV imports without rate limiting (750+ rows)", async () => {
      // Clear existing referenda from beforeEach
      testDb.exec('DELETE FROM "Referenda"');

      // Generate CSV with 750 rows (simulating actual default file)
      const rows = Array.from({ length: 750 }, (_, i) =>
        `${i + 1},Development,Core,,0`
      );
      const largeCsv = `id,category,subcategory,notes,hide_in_spends\n${rows.join("\n")}`;

      // Mock existing referenda in database
      for (let i = 1; i <= 750; i++) {
        testDb.exec(
          `INSERT INTO "Referenda" (id, title, status) VALUES (${i}, 'Ref ${i}', 'Executed')`
        );
      }

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(largeCsv);

      // Fetch CSV
      const syncResponse = await request(app).get(
        "/api/sync/defaults/referenda"
      );
      expect(syncResponse.status).toBe(200);

      // Parse and import with category strings (no lookup calls)
      const parsedItems = parseCSVForTest(syncResponse.body.content);
      expect(parsedItems).toHaveLength(750);

      const items = parsedItems.map((item) => ({
        id: item.id!,
        category: item.category,
        subcategory: item.subcategory,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

      // Single import request (should not hit rate limit)
      const importResponse = await request(app)
        .post("/api/referenda/import")
        .send({ items });

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.count).toBe(750);

      // Verify categories were created
      const categoryCount = testDb
        .prepare('SELECT COUNT(*) as count FROM "Categories"')
        .get() as { count: number };
      expect(categoryCount.count).toBeGreaterThan(0);
    });
  });

  describe("Child Bounties Apply Defaults Workflow", () => {
    const mockChildBountiesCSV = `identifier,category,subcategory,notes,hide_in_spends
13-1332,Development,Smart Contracts,,0
33-331193,Outreach,Advertising,,0
99-9999,Outreach,Content,,1`;

    it("should complete full workflow: fetch CSV → parse → lookup categories → import", async () => {
      // 1. Mock fs to return CSV
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockChildBountiesCSV);

      // 2. Fetch CSV via sync endpoint
      const syncResponse = await request(app).get(
        "/api/sync/defaults/child-bounties"
      );
      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.content).toBe(mockChildBountiesCSV);

      // 3. Parse CSV
      const parsedItems = parseCSVForTest(mockChildBountiesCSV);
      expect(parsedItems).toHaveLength(3);

      // 4. Send category strings directly - backend will resolve them
      const items = parsedItems.map((item) => ({
        identifier: item.identifier!,
        category: item.category,
        subcategory: item.subcategory,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

      // 5. Import
      const importResponse = await request(app)
        .post("/api/child-bounties/import")
        .send({ items });
      expect(importResponse.status).toBe(200);
      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.count).toBeGreaterThan(0);

      // 6. Verify database state

      // Check child bounties were updated (using underscore format in DB)
      const cb1 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("13_1332") as {
        category_id: number;
        hide_in_spends: number;
      };
      expect(cb1.category_id).toBe(3); // Development/Smart Contracts
      expect(cb1.hide_in_spends).toBe(0);

      const cb2 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("33_331193") as {
        category_id: number;
        hide_in_spends: number;
      };
      expect(cb2.category_id).toBe(6); // Outreach/Advertising

      const cb3 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("99_9999") as {
        category_id: number;
        hide_in_spends: number;
      };
      expect(cb3.category_id).toBe(2); // Outreach/Content
      expect(cb3.hide_in_spends).toBe(1);

      // Check total category count (should not change - all categories pre-seeded)
      const categoryCount = testDb
        .prepare('SELECT COUNT(*) as count FROM "Categories"')
        .get() as { count: number };
      expect(categoryCount.count).toBe(6); // All pre-seeded categories
    });

    it("should reject import when category doesn't exist", async () => {
      const csvWithInvalidCategory = `identifier,category,subcategory,notes,hide_in_spends
13-1332,Nonexistent CB Category,Nonexistent CB Sub,,0
99-9999,Another Invalid,Category,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithInvalidCategory);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/child-bounties"
      );
      const parsedItems = parseCSVForTest(syncResponse.body.content);

      const items = parsedItems.map((item) => ({
        identifier: item.identifier!,
        category: item.category,
        subcategory: item.subcategory,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

      // Import should fail with validation error
      const importResponse = await request(app)
        .post("/api/child-bounties/import")
        .send({ items });

      expect(importResponse.status).toBe(400);
      expect(importResponse.body.error).toContain("Import rejected");
      expect(importResponse.body.error).toContain("non-existent categories");
      expect(importResponse.body.error).toContain("2 row(s)");
      expect(importResponse.body.error).toContain("13-1332");
      expect(importResponse.body.error).toContain("Nonexistent CB Category");
    });

    it("should reuse existing categories when they match", async () => {
      const csvWithExistingCategory = `identifier,category,subcategory,notes,hide_in_spends
13-1332,Development,Core,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithExistingCategory);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/child-bounties"
      );
      const parsedItems = parseCSVForTest(syncResponse.body.content);

      const categoryResponse = await request(app)
        .post("/api/categories/lookup")
        .send({
          category: parsedItems[0].category!,
          subcategory: parsedItems[0].subcategory!,
        });

      expect(categoryResponse.status).toBe(200);
      expect(categoryResponse.body.id).toBe(1); // Existing category ID

      // Verify category count didn't increase
      const categoryCount = testDb
        .prepare('SELECT COUNT(*) as count FROM "Categories"')
        .get() as { count: number };
      expect(categoryCount.count).toBe(6); // Still only seeded categories
    });

    it("should handle composite identifiers", async () => {
      const csvWithCompositeIds = `identifier,category,subcategory,notes,hide_in_spends
13-1332,Development,Core,,0
99-9999,Outreach,Content,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithCompositeIds);

      const syncResponse = await request(app).get(
        "/api/sync/defaults/child-bounties"
      );
      const parsedItems = parseCSVForTest(syncResponse.body.content);

      expect(parsedItems[0].identifier).toBe("13-1332");
      expect(parsedItems[1].identifier).toBe("99-9999");

      const items = [];
      for (const item of parsedItems) {
        const categoryResponse = await request(app)
          .post("/api/categories/lookup")
          .send({ category: item.category!, subcategory: item.subcategory! });
        items.push({
          identifier: item.identifier!,
          category_id: categoryResponse.body.id,
        });
      }

      const importResponse = await request(app)
        .post("/api/child-bounties/import")
        .send({ items });

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.count).toBe(2);

      // Verify both were updated (using underscore format in DB)
      const cb1 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("13_1332");
      expect(cb1).toBeDefined();

      const cb2 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("99_9999");
      expect(cb2).toBeDefined();
    });

    it("should return 404 when default file doesn't exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const response = await request(app).get(
        "/api/sync/defaults/child-bounties"
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Default file not found");
    });
  });

  describe("Bounties Apply Defaults Workflow", () => {
    const mockBountiesCSV = `id,name,category,subcategory
10,Test Bounty,Development,Core
11,Another Bounty,Outreach,Content`;

    it("should create bounties and assign categories via upsert", async () => {
      // Start with no bounties (cleared in beforeEach)

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockBountiesCSV);

      // Fetch CSV via sync endpoint
      const syncResponse = await request(app).get("/api/sync/defaults/bounties");
      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.content).toBe(mockBountiesCSV);

      // Parse CSV and prepare items (simulating frontend)
      const items = [
        { id: 10, name: "Test Bounty", category: "Development", subcategory: "Core" },
        { id: 11, name: "Another Bounty", category: "Outreach", subcategory: "Content" },
      ];

      // Import via bounties endpoint
      const importResponse = await request(app)
        .post("/api/bounties/import")
        .send({ items });

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.count).toBe(2);

      // Verify bounties were created
      const bounty10 = testDb.prepare('SELECT * FROM "Bounties" WHERE id = 10').get() as {
        id: number;
        name: string;
        category_id: number;
      };
      expect(bounty10).toBeDefined();
      expect(bounty10.name).toBe("Test Bounty");
      expect(bounty10.category_id).toBe(1); // Development/Core

      const bounty11 = testDb.prepare('SELECT * FROM "Bounties" WHERE id = 11').get() as {
        id: number;
        name: string;
        category_id: number;
      };
      expect(bounty11).toBeDefined();
      expect(bounty11.name).toBe("Another Bounty");
      expect(bounty11.category_id).toBe(2); // Outreach/Content
    });

    it("should update existing bounties while preserving name when not provided", async () => {
      // Seed an existing bounty
      testDb.exec(`
        INSERT INTO "Bounties" (id, name, category_id)
        VALUES (10, 'Original Name', NULL)
      `);

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(mockBountiesCSV);

      // Import with name - should update
      const importResponse = await request(app)
        .post("/api/bounties/import")
        .send({
          items: [
            { id: 10, name: "Updated Name", category: "Development", subcategory: "Core" },
          ],
        });

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.count).toBe(1);

      // Verify bounty was updated
      const bounty = testDb.prepare('SELECT * FROM "Bounties" WHERE id = 10').get() as {
        name: string;
        category_id: number;
      };
      expect(bounty.name).toBe("Updated Name");
      expect(bounty.category_id).toBe(1);
    });

    it("should reject import when category doesn't exist", async () => {
      const items = [
        { id: 10, name: "Test", category: "Nonexistent", subcategory: "Cat" },
      ];

      const response = await request(app)
        .post("/api/bounties/import")
        .send({ items });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Import rejected");
      expect(response.body.error).toContain("non-existent categories");
    });

    it("should handle empty categories (sets to null)", async () => {
      const items = [
        { id: 10, name: "Test Bounty", category: null, subcategory: null },
      ];

      const response = await request(app)
        .post("/api/bounties/import")
        .send({ items });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);

      // Verify bounty was created with null category
      const bounty = testDb.prepare('SELECT * FROM "Bounties" WHERE id = 10').get() as {
        name: string;
        category_id: number | null;
      };
      expect(bounty.name).toBe("Test Bounty");
      expect(bounty.category_id).toBeNull();
    });

    it("should return 404 when default file doesn't exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const response = await request(app).get("/api/sync/defaults/bounties");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Default file not found");
    });
  });
});
