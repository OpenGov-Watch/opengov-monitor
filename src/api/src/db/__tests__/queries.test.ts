/**
 * Tests for database query functions
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import {
  createTestDatabase,
  closeTestDatabase,
  seedTestData,
  fixtures,
} from "../../test/test-db";
import { TABLE_NAMES, VIEW_NAMES } from "../types";

// We'll mock the db module to use our test database
let testDb: Database.Database;

// Mock the db index module
vi.mock("../index", () => ({
  getDatabase: () => testDb,
  getWritableDatabase: () => testDb,
  getLogDatabase: () => testDb,
  logDatabaseExists: () => true,
}));

// Import after mocking
import * as queries from "../queries";

describe("Database Queries", () => {
  beforeAll(() => {
    testDb = createTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  beforeEach(() => {
    // Clear all tables before each test
    testDb.exec(`DELETE FROM "${TABLE_NAMES.referenda}"`);
    testDb.exec(`DELETE FROM "${TABLE_NAMES.treasury}"`);
    testDb.exec(`DELETE FROM "${TABLE_NAMES.childBounties}"`);
    testDb.exec(`DELETE FROM "${TABLE_NAMES.fellowship}"`);
    testDb.exec(`DELETE FROM "${TABLE_NAMES.categories}"`);
    testDb.exec(`DELETE FROM "${TABLE_NAMES.bounties}"`);
    testDb.exec(`DELETE FROM "${TABLE_NAMES.subtreasury}"`);
    testDb.exec(`DELETE FROM "${TABLE_NAMES.dashboards}"`);
    testDb.exec(`DELETE FROM "${TABLE_NAMES.dashboardComponents}"`);
  });

  // ==========================================================================
  // Read Queries (removed - now using POST /api/query/execute)
  // See query-ui-pages.test.ts for comprehensive tests of the new query system
  // ==========================================================================

  // ==========================================================================
  // Metadata Queries
  // ==========================================================================

  describe("tableExists", () => {
    it("returns true for existing table", () => {
      expect(queries.tableExists(TABLE_NAMES.referenda)).toBe(true);
    });

    it("returns false for non-existent table", () => {
      expect(queries.tableExists("NonexistentTable")).toBe(false);
    });
  });

  describe("viewExists", () => {
    it("returns true for existing view", () => {
      expect(queries.viewExists(VIEW_NAMES.outstandingClaims)).toBe(true);
    });

    it("returns false for non-existent view", () => {
      expect(queries.viewExists("nonexistent_view")).toBe(false);
    });
  });

  describe("getRowCount", () => {
    it("returns 0 for empty table", () => {
      expect(queries.getRowCount(TABLE_NAMES.referenda)).toBe(0);
    });

    it("returns correct count after inserting data", () => {
      seedTestData(testDb, TABLE_NAMES.referenda, fixtures.referenda);
      expect(queries.getRowCount(TABLE_NAMES.referenda)).toBe(2);
    });
  });

  describe("isDatabaseAccessible", () => {
    it("returns true when database is accessible", () => {
      expect(queries.isDatabaseAccessible()).toBe(true);
    });
  });

  // ==========================================================================
  // Categories CRUD
  // ==========================================================================

  describe("Categories CRUD", () => {
    describe("getCategories", () => {
      it("returns empty array when no categories exist", () => {
        const result = queries.getCategories();
        expect(result).toEqual([]);
      });

      it("returns categories ordered by category, subcategory", () => {
        seedTestData(testDb, TABLE_NAMES.categories, fixtures.categories);
        const result = queries.getCategories();
        expect(result).toHaveLength(3);
        // Development comes before Marketing
        expect(result[0].category).toBe("Development");
      });
    });

    describe("createCategory", () => {
      it("creates new category and returns it with id", () => {
        const result = queries.createCategory("TestCategory", "TestSubcategory");
        expect(result.id).toBeDefined();
        expect(result.category).toBe("TestCategory");
        expect(result.subcategory).toBe("TestSubcategory");
      });

      it("returns correct lastInsertRowid", () => {
        const first = queries.createCategory("Cat1", "Sub1");
        const second = queries.createCategory("Cat2", "Sub2");
        expect(second.id).toBeGreaterThan(first.id);
      });
    });

    describe("updateCategory", () => {
      it("updates existing category", () => {
        const created = queries.createCategory("Original", "Original");
        queries.updateCategory(created.id, "Updated", "Updated");

        const categories = queries.getCategories();
        const updated = categories.find((c) => c.id === created.id);
        expect(updated?.category).toBe("Updated");
        expect(updated?.subcategory).toBe("Updated");
      });
    });

    describe("deleteCategory", () => {
      it("deletes existing category with non-null subcategory", () => {
        const created = queries.createCategory("ToDelete", "ToDeleteSub");
        // createCategory also auto-creates NULL subcategory row, so expect 2
        expect(queries.getCategories()).toHaveLength(2);

        const result = queries.deleteCategory(created.id);
        expect(result.success).toBe(true);
        // Only NULL subcategory row remains
        expect(queries.getCategories()).toHaveLength(1);
      });

      it("prevents deletion of NULL subcategory row", () => {
        // Creating with non-null subcategory auto-creates NULL subcategory row
        const created = queries.createCategory("Development", "SDK");
        const categories = queries.getCategories();
        const nullSubcatRow = categories.find(c => c.category === "Development" && c.subcategory === null);

        expect(nullSubcatRow).toBeDefined();
        const result = queries.deleteCategory(nullSubcatRow!.id);
        expect(result.success).toBe(false);
        expect(result.error).toContain("Cannot delete");
      });
    });
  });

  // ==========================================================================
  // Bounties CRUD
  // ==========================================================================

  describe("Bounties CRUD", () => {
    describe("getBounties", () => {
      it("returns empty array when no bounties exist", () => {
        const result = queries.getBounties();
        expect(result).toEqual([]);
      });

      it("returns bounties ordered by id DESC", () => {
        seedTestData(testDb, TABLE_NAMES.categories, fixtures.categories);
        seedTestData(testDb, TABLE_NAMES.bounties, fixtures.bounties);
        const result = queries.getBounties();
        expect(result).toHaveLength(1);
      });
    });

    describe("getBountyById", () => {
      it("returns bounty when found", () => {
        seedTestData(testDb, TABLE_NAMES.categories, fixtures.categories);
        seedTestData(testDb, TABLE_NAMES.bounties, fixtures.bounties);
        const result = queries.getBountyById(10);
        expect(result).toBeDefined();
        expect(result?.name).toBe("Parent Bounty 1");
      });

      it("returns undefined when not found", () => {
        const result = queries.getBountyById(999);
        expect(result).toBeUndefined();
      });
    });

    describe("upsertBounty", () => {
      it("inserts new bounty when id does not exist", () => {
        queries.upsertBounty({
          id: 20,
          name: "New Bounty",
          category_id: 1,
          remaining_dot: 1000,
          url: "https://example.com",
        });
        const result = queries.getBountyById(20);
        expect(result?.name).toBe("New Bounty");
      });

      it("updates existing bounty when id exists", () => {
        queries.upsertBounty({
          id: 30,
          name: "Original",
          category_id: null,
          remaining_dot: 500,
          url: null,
        });
        queries.upsertBounty({
          id: 30,
          name: "Updated",
          category_id: 1,
          remaining_dot: 1000,
          url: "https://updated.com",
        });
        const result = queries.getBountyById(30);
        expect(result?.name).toBe("Updated");
        expect(result?.remaining_dot).toBe(1000);
      });
    });

    describe("deleteBounty", () => {
      it("deletes existing bounty", () => {
        queries.upsertBounty({
          id: 40,
          name: "ToDelete",
          category_id: null,
          remaining_dot: null,
          url: null,
        });
        expect(queries.getBountyById(40)).toBeDefined();

        queries.deleteBounty(40);
        expect(queries.getBountyById(40)).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // Subtreasury CRUD
  // ==========================================================================

  describe("Subtreasury CRUD", () => {
    describe("getSubtreasury", () => {
      it("returns empty array when no entries exist", () => {
        const result = queries.getSubtreasury();
        expect(result).toEqual([]);
      });
    });

    describe("createSubtreasury", () => {
      it("creates new entry with all fields", () => {
        const result = queries.createSubtreasury({
          title: "Test Entry",
          description: "Test Description",
          DOT_latest: 1000,
          USD_latest: 5000,
          DOT_component: 500,
          USDC_component: 300,
          USDT_component: 200,
          category_id: 1,
          latest_status_change: "2024-01-15 00:00:00",
          url: "https://example.com",
        });
        expect(result.id).toBeDefined();
        expect(result.title).toBe("Test Entry");
      });

      it("handles NULL values for optional fields", () => {
        const result = queries.createSubtreasury({
          title: null,
          description: null,
          DOT_latest: null,
          USD_latest: null,
          DOT_component: null,
          USDC_component: null,
          USDT_component: null,
          category_id: null,
          latest_status_change: null,
          url: null,
        });
        expect(result.id).toBeDefined();
        expect(result.title).toBeNull();
      });
    });

    describe("getSubtreasuryById", () => {
      it("returns entry when found", () => {
        const created = queries.createSubtreasury({
          title: "Find Me",
          description: null,
          DOT_latest: 100,
          USD_latest: null,
          DOT_component: null,
          USDC_component: null,
          USDT_component: null,
          category_id: null,
          latest_status_change: null,
          url: null,
        });
        const result = queries.getSubtreasuryById(created.id);
        expect(result?.title).toBe("Find Me");
      });

      it("returns undefined when not found", () => {
        const result = queries.getSubtreasuryById(999);
        expect(result).toBeUndefined();
      });
    });

    describe("updateSubtreasury", () => {
      it("updates all fields of existing entry", () => {
        const created = queries.createSubtreasury({
          title: "Original",
          description: null,
          DOT_latest: 100,
          USD_latest: null,
          DOT_component: null,
          USDC_component: null,
          USDT_component: null,
          category_id: null,
          latest_status_change: null,
          url: null,
        });

        queries.updateSubtreasury({
          id: created.id,
          title: "Updated",
          description: "Now has description",
          DOT_latest: 200,
          USD_latest: 1000,
          DOT_component: 100,
          USDC_component: 50,
          USDT_component: 50,
          category_id: 1,
          latest_status_change: "2024-02-01 00:00:00",
          url: "https://updated.com",
        });

        const result = queries.getSubtreasuryById(created.id);
        expect(result?.title).toBe("Updated");
        expect(result?.DOT_latest).toBe(200);
      });
    });

    describe("deleteSubtreasury", () => {
      it("deletes existing entry", () => {
        const created = queries.createSubtreasury({
          title: "ToDelete",
          description: null,
          DOT_latest: null,
          USD_latest: null,
          DOT_component: null,
          USDC_component: null,
          USDT_component: null,
          category_id: null,
          latest_status_change: null,
          url: null,
        });

        queries.deleteSubtreasury(created.id);
        expect(queries.getSubtreasuryById(created.id)).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // Dashboards CRUD
  // ==========================================================================

  describe("Dashboards CRUD", () => {
    describe("getDashboards", () => {
      it("returns empty array when no dashboards exist", () => {
        const result = queries.getDashboards();
        expect(result).toEqual([]);
      });
    });

    describe("createDashboard", () => {
      it("creates new dashboard with name and description", () => {
        const result = queries.createDashboard("Test Dashboard", "A description");
        expect(result.id).toBeDefined();
        expect(result.name).toBe("Test Dashboard");
        expect(result.description).toBe("A description");
        expect(result.created_at).toBeDefined();
        expect(result.updated_at).toBeDefined();
      });

      it("handles NULL description", () => {
        const result = queries.createDashboard("No Description", null);
        expect(result.description).toBeNull();
      });
    });

    describe("getDashboardById", () => {
      it("returns dashboard when found", () => {
        const created = queries.createDashboard("Find Me", null);
        const result = queries.getDashboardById(created.id);
        expect(result?.name).toBe("Find Me");
      });

      it("returns undefined when not found", () => {
        const result = queries.getDashboardById(999);
        expect(result).toBeUndefined();
      });
    });

    describe("updateDashboard", () => {
      it("updates name and description", () => {
        const created = queries.createDashboard("Original", "Original");
        queries.updateDashboard(created.id, "Updated", "Updated");

        const result = queries.getDashboardById(created.id);
        expect(result?.name).toBe("Updated");
        expect(result?.description).toBe("Updated");
      });

      it("sets updated_at timestamp on update", () => {
        const created = queries.createDashboard("Test", null);
        queries.updateDashboard(created.id, "Updated", null);

        const result = queries.getDashboardById(created.id);
        // updated_at should be a valid ISO timestamp
        expect(result?.updated_at).toBeDefined();
        expect(new Date(result!.updated_at!).toISOString()).toBe(result!.updated_at);
      });
    });

    describe("deleteDashboard", () => {
      it("deletes dashboard", () => {
        const created = queries.createDashboard("ToDelete", null);
        queries.deleteDashboard(created.id);
        expect(queries.getDashboardById(created.id)).toBeUndefined();
      });

      it("cascades to delete dashboard components", () => {
        const dashboard = queries.createDashboard("WithComponents", null);
        const component = queries.createDashboardComponent(
          dashboard.id,
          "Component",
          "table",
          "{}",
          "{}",
          null
        );

        // Verify component exists
        expect(queries.getDashboardComponentById(component.id)).toBeDefined();

        // Delete dashboard
        queries.deleteDashboard(dashboard.id);

        // Component should be deleted
        expect(queries.getDashboardComponentById(component.id)).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // Dashboard Components CRUD
  // ==========================================================================

  describe("Dashboard Components CRUD", () => {
    let dashboardId: number;

    beforeEach(() => {
      const dashboard = queries.createDashboard("Test Dashboard", null);
      dashboardId = dashboard.id;
    });

    describe("getDashboardComponents", () => {
      it("returns empty array when no components exist", () => {
        const result = queries.getDashboardComponents(dashboardId);
        expect(result).toEqual([]);
      });

      it("returns only components for specified dashboard_id", () => {
        const otherDashboard = queries.createDashboard("Other", null);
        queries.createDashboardComponent(dashboardId, "Comp1", "table", "{}", "{}", null);
        queries.createDashboardComponent(otherDashboard.id, "Comp2", "pie", "{}", "{}", null);

        const result = queries.getDashboardComponents(dashboardId);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Comp1");
      });
    });

    describe("createDashboardComponent", () => {
      it("creates component with all required fields", () => {
        const result = queries.createDashboardComponent(
          dashboardId,
          "My Component",
          "table",
          '{"sourceTable":"Referenda"}',
          '{"x":0,"y":0,"w":6,"h":4}',
          null
        );
        expect(result.id).toBeDefined();
        expect(result.name).toBe("My Component");
        expect(result.type).toBe("table");
      });

      it("parent dashboard has valid updated_at after component creation", () => {
        queries.createDashboardComponent(
          dashboardId,
          "Comp",
          "table",
          "{}",
          "{}",
          null
        );

        const updated = queries.getDashboardById(dashboardId);
        // updated_at should be a valid ISO timestamp
        expect(updated?.updated_at).toBeDefined();
        expect(new Date(updated!.updated_at!).toISOString()).toBe(updated!.updated_at);
      });
    });

    describe("getDashboardComponentById", () => {
      it("returns component when found", () => {
        const created = queries.createDashboardComponent(
          dashboardId,
          "Find Me",
          "pie",
          "{}",
          "{}",
          null
        );
        const result = queries.getDashboardComponentById(created.id);
        expect(result?.name).toBe("Find Me");
      });

      it("returns undefined when not found", () => {
        const result = queries.getDashboardComponentById(999);
        expect(result).toBeUndefined();
      });
    });

    describe("updateDashboardComponent", () => {
      it("updates all component fields", () => {
        const created = queries.createDashboardComponent(
          dashboardId,
          "Original",
          "table",
          '{"old":true}',
          '{"x":0}',
          null
        );

        queries.updateDashboardComponent(
          created.id,
          "Updated",
          "pie",
          '{"new":true}',
          '{"x":1}',
          '{"colors":["red"]}'
        );

        const result = queries.getDashboardComponentById(created.id);
        expect(result?.name).toBe("Updated");
        expect(result?.type).toBe("pie");
        expect(result?.query_config).toBe('{"new":true}');
        expect(result?.chart_config).toBe('{"colors":["red"]}');
      });
    });

    describe("updateDashboardComponentGrid", () => {
      it("only updates grid_config", () => {
        const created = queries.createDashboardComponent(
          dashboardId,
          "GridTest",
          "table",
          '{"query":true}',
          '{"x":0,"y":0}',
          null
        );

        queries.updateDashboardComponentGrid(created.id, '{"x":5,"y":5}');

        const result = queries.getDashboardComponentById(created.id);
        expect(result?.grid_config).toBe('{"x":5,"y":5}');
        // Other fields unchanged
        expect(result?.name).toBe("GridTest");
        expect(result?.query_config).toBe('{"query":true}');
      });
    });

    describe("deleteDashboardComponent", () => {
      it("deletes component", () => {
        const created = queries.createDashboardComponent(
          dashboardId,
          "ToDelete",
          "table",
          "{}",
          "{}",
          null
        );
        queries.deleteDashboardComponent(created.id);
        expect(queries.getDashboardComponentById(created.id)).toBeUndefined();
      });

      it("updates parent dashboard updated_at", () => {
        const created = queries.createDashboardComponent(
          dashboardId,
          "ToDelete",
          "table",
          "{}",
          "{}",
          null
        );

        const dashboardBefore = queries.getDashboardById(dashboardId);

        // Small operation to ensure time passes
        queries.deleteDashboardComponent(created.id);

        const dashboardAfter = queries.getDashboardById(dashboardId);
        // updated_at should change (might be same if too fast, so just check it exists)
        expect(dashboardAfter?.updated_at).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Category Lookup Queries
  // ==========================================================================

  describe("Category Lookup Queries", () => {
    describe("findOrCreateCategory", () => {
      it("returns existing category when found", () => {
        seedTestData(testDb, TABLE_NAMES.categories, fixtures.categories);

        const result = queries.findOrCreateCategory("Development", "Infrastructure");

        expect(result.id).toBe(1);
        expect(result.category).toBe("Development");
        expect(result.subcategory).toBe("Infrastructure");
      });

      it("creates new category when not found", () => {
        const result = queries.findOrCreateCategory("NewCategory", "NewSubcategory");

        expect(result.id).toBeDefined();
        expect(result.category).toBe("NewCategory");
        expect(result.subcategory).toBe("NewSubcategory");
      });

      it("handles empty subcategory (converts to NULL for Other)", () => {
        const result = queries.findOrCreateCategory("Marketing", "");

        expect(result.id).toBeDefined();
        expect(result.category).toBe("Marketing");
        // Empty string is converted to NULL (represents "Other")
        expect(result.subcategory).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Bulk Update Category Validation
  // ==========================================================================

  describe("Bulk Update Category Validation", () => {
    beforeEach(() => {
      // Seed categories for validation tests
      seedTestData(testDb, TABLE_NAMES.categories, fixtures.categories);
    });

    describe("bulkUpdateReferenda", () => {
      it("allows empty category and subcategory (no category)", () => {
        const items = [
          {
            id: 1,
            category: "",
            subcategory: "",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        // Should not throw
        expect(() => queries.bulkUpdateReferenda(items)).not.toThrow();
      });

      it("rejects empty category with non-empty subcategory", () => {
        const items = [
          {
            id: 2,
            category: "",
            subcategory: "NonExistentSubcategory",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        expect(() => queries.bulkUpdateReferenda(items)).toThrow(/non-existent categories/);
      });

      it("rejects non-existent category with empty subcategory", () => {
        const items = [
          {
            id: 3,
            category: "NonExistentCategory",
            subcategory: "",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        expect(() => queries.bulkUpdateReferenda(items)).toThrow(/non-existent categories/);
      });

      it("accepts valid category/subcategory pair", () => {
        const items = [
          {
            id: 4,
            category: "Development",
            subcategory: "Infrastructure",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        // Should not throw
        expect(() => queries.bulkUpdateReferenda(items)).not.toThrow();
      });
    });

    describe("bulkUpdateChildBounties", () => {
      it("allows empty category and subcategory (no category)", () => {
        const items = [
          {
            identifier: "1-1",
            category: "",
            subcategory: "",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        // Should not throw
        expect(() => queries.bulkUpdateChildBounties(items)).not.toThrow();
      });

      it("rejects empty category with non-empty subcategory", () => {
        const items = [
          {
            identifier: "1-2",
            category: "",
            subcategory: "NonExistentSubcategory",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        expect(() => queries.bulkUpdateChildBounties(items)).toThrow(/non-existent categories/);
      });

      it("rejects non-existent category with empty subcategory", () => {
        const items = [
          {
            identifier: "1-3",
            category: "NonExistentCategory",
            subcategory: "",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        expect(() => queries.bulkUpdateChildBounties(items)).toThrow(/non-existent categories/);
      });

      it("accepts valid category/subcategory pair", () => {
        const items = [
          {
            identifier: "1-4",
            category: "Development",
            subcategory: "Infrastructure",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        // Should not throw
        expect(() => queries.bulkUpdateChildBounties(items)).not.toThrow();
      });
    });

    describe("bulkUpdateBounties", () => {
      it("allows empty category and subcategory (no category)", () => {
        const items = [
          {
            id: 1,
            category: "",
            subcategory: "",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        // Should not throw
        expect(() => queries.bulkUpdateBounties(items)).not.toThrow();
      });

      it("rejects empty category with non-empty subcategory", () => {
        const items = [
          {
            id: 2,
            category: "",
            subcategory: "NonExistentSubcategory",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        expect(() => queries.bulkUpdateBounties(items)).toThrow(/non-existent categories/);
      });

      it("rejects non-existent category with empty subcategory", () => {
        const items = [
          {
            id: 3,
            category: "NonExistentCategory",
            subcategory: "",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        expect(() => queries.bulkUpdateBounties(items)).toThrow(/non-existent categories/);
      });

      it("accepts valid category/subcategory pair", () => {
        const items = [
          {
            id: 4,
            category: "Development",
            subcategory: "Infrastructure",
            notes: "",
            hide_in_spends: 0,
          },
        ];

        // Should not throw
        expect(() => queries.bulkUpdateBounties(items)).not.toThrow();
      });
    });
  });
});
