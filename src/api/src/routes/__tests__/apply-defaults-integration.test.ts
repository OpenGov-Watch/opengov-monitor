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
    "name" TEXT
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

  // Seed existing categories (to test reuse)
  testDb.exec(`
    INSERT INTO "Categories" (id, category, subcategory)
    VALUES (1, 'Development', 'Core'),
           (2, 'Outreach', 'Content')
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

  // Seed existing child bounties
  testDb.exec(`
    INSERT INTO "Child Bounties" (identifier, parentBountyId, description, status)
    VALUES ('13-1332', 13, 'Existing CB', 'Claimed'),
           ('33-331193', 33, 'Another CB', 'Active'),
           ('17-17111', 17, 'Third CB', 'Pending'),
           ('99-9999', 99, 'Fourth CB', 'Pending')
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

      // Check new categories were created
      const newCategory = testDb
        .prepare('SELECT * FROM "Categories" WHERE category = ?')
        .get("New Category") as {
        id: number;
        category: string;
        subcategory: string;
      };
      expect(newCategory).toBeDefined();
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

      // Check total category count (should not duplicate)
      const categoryCount = testDb
        .prepare('SELECT COUNT(*) as count FROM "Categories"')
        .get() as { count: number };
      expect(categoryCount.count).toBe(3); // 2 original + 1 new
    });

    it("should create new categories when they don't exist", async () => {
      const csvWithNewCategory = `id,category,subcategory,notes,hide_in_spends
1,Brand New Category,Brand New Sub,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithNewCategory);

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
      const categoryId = categoryResponse.body.id;

      await request(app)
        .post("/api/referenda/import")
        .send({ items: [{ id: 1, category_id: categoryId }] });

      // Verify new category was created
      const newCategory = testDb
        .prepare('SELECT * FROM "Categories" WHERE category = ?')
        .get("Brand New Category") as {
        id: number;
        subcategory: string;
      };
      expect(newCategory).toBeDefined();
      expect(newCategory.subcategory).toBe("Brand New Sub");
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
      expect(categoryCount.count).toBe(2); // Still 2 original categories
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
      expect(categoryResponse.body.subcategory).toBe("");
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
33-331193,,Advertising,,0
99-9999,New Category,New Sub,,1`;

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

      // Check new categories were created
      const newCategory = testDb
        .prepare('SELECT * FROM "Categories" WHERE category = ?')
        .get("New Category") as {
        id: number;
        subcategory: string;
      };
      expect(newCategory).toBeDefined();
      expect(newCategory.subcategory).toBe("New Sub");

      // Check child bounties were updated
      const cb1 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("13-1332") as {
        category_id: number;
        hide_in_spends: number;
      };
      expect(cb1.category_id).toBeDefined();
      expect(cb1.hide_in_spends).toBe(0);

      const cb2 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("33-331193") as {
        category_id: number | null;
      };
      expect(cb2.category_id).toBeNull(); // Empty category in CSV

      const cb3 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("99-9999") as {
        category_id: number;
        hide_in_spends: number;
      };
      expect(cb3.category_id).toBe(newCategory.id);
      expect(cb3.hide_in_spends).toBe(1);

      // Check total category count
      const categoryCount = testDb
        .prepare('SELECT COUNT(*) as count FROM "Categories"')
        .get() as { count: number };
      expect(categoryCount.count).toBe(4); // 2 original + 1 new (Development/Smart Contracts) + 1 new (New Category/New Sub)
    });

    it("should create new categories when they don't exist", async () => {
      const csvWithNewCategory = `identifier,category,subcategory,notes,hide_in_spends
13-1332,Brand New CB Category,Brand New CB Sub,,0`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(csvWithNewCategory);

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
      const categoryId = categoryResponse.body.id;

      await request(app)
        .post("/api/child-bounties/import")
        .send({ items: [{ identifier: "13-1332", category_id: categoryId }] });

      // Verify new category was created
      const newCategory = testDb
        .prepare('SELECT * FROM "Categories" WHERE category = ?')
        .get("Brand New CB Category") as {
        id: number;
        subcategory: string;
      };
      expect(newCategory).toBeDefined();
      expect(newCategory.subcategory).toBe("Brand New CB Sub");
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
      expect(categoryCount.count).toBe(2); // Still 2 original categories
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

      // Verify both were updated
      const cb1 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("13-1332");
      expect(cb1).toBeDefined();

      const cb2 = testDb
        .prepare('SELECT * FROM "Child Bounties" WHERE identifier = ?')
        .get("99-9999");
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
});
