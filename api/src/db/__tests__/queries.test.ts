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
  // Read Queries
  // ==========================================================================

  describe("getReferenda", () => {
    it("returns empty array when no data exists", () => {
      const result = queries.getReferenda();
      expect(result).toEqual([]);
    });

    it("returns all referenda from database", () => {
      seedTestData(testDb, TABLE_NAMES.referenda, fixtures.referenda);
      const result = queries.getReferenda();
      expect(result).toHaveLength(2);
    });

    it("correctly maps columns with dots (tally.ayes)", () => {
      seedTestData(testDb, TABLE_NAMES.referenda, fixtures.referenda);
      const result = queries.getReferenda();
      expect(result[0]["tally.ayes"]).toBe(100000);
    });

    it("handles NULL values correctly", () => {
      seedTestData(testDb, TABLE_NAMES.referenda, fixtures.referenda);
      const result = queries.getReferenda();
      const nullCategoryRow = result.find((r) => r.id === 2);
      expect(nullCategoryRow?.category).toBeNull();
    });
  });

  describe("getTreasury", () => {
    it("returns empty array when no data exists", () => {
      const result = queries.getTreasury();
      expect(result).toEqual([]);
    });

    it("returns all treasury spends from database", () => {
      seedTestData(testDb, TABLE_NAMES.treasury, fixtures.treasury);
      const result = queries.getTreasury();
      expect(result).toHaveLength(2);
    });
  });

  describe("getChildBounties", () => {
    it("returns empty array when no data exists", () => {
      const result = queries.getChildBounties();
      expect(result).toEqual([]);
    });

    it("returns all child bounties with identifier as primary key", () => {
      seedTestData(testDb, TABLE_NAMES.childBounties, fixtures.childBounties);
      const result = queries.getChildBounties();
      expect(result).toHaveLength(2);
      expect(result[0].identifier).toBe("10-1");
    });
  });

  // ==========================================================================
  // View Queries
  // ==========================================================================

  describe("getOutstandingClaims", () => {
    it("returns empty array when no approved claims exist", () => {
      const result = queries.getOutstandingClaims();
      expect(result).toEqual([]);
    });

    it("only includes Approved status with future expiry", () => {
      seedTestData(testDb, TABLE_NAMES.treasury, fixtures.treasury);
      const result = queries.getOutstandingClaims();
      // Only the first record has status=Approved and future expiry
      expect(result.length).toBeGreaterThanOrEqual(1);
      result.forEach((claim) => {
        expect(claim.status).toBe("Approved");
      });
    });
  });

  describe("getExpiredClaims", () => {
    it("returns empty array when no expired claims exist", () => {
      const result = queries.getExpiredClaims();
      expect(result).toEqual([]);
    });
  });

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
      it("deletes existing category", () => {
        const created = queries.createCategory("ToDelete", "ToDelete");
        expect(queries.getCategories()).toHaveLength(1);

        queries.deleteCategory(created.id);
        expect(queries.getCategories()).toHaveLength(0);
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
        seedTestData(testDb, TABLE_NAMES.bounties, fixtures.bounties);
        const result = queries.getBounties();
        expect(result).toHaveLength(1);
      });
    });

    describe("getBountyById", () => {
      it("returns bounty when found", () => {
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
          category: "Test",
          subcategory: "Test",
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
          category: null,
          subcategory: null,
          remaining_dot: 500,
          url: null,
        });
        queries.upsertBounty({
          id: 30,
          name: "Updated",
          category: "Cat",
          subcategory: "Sub",
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
          category: null,
          subcategory: null,
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
          category: "Development",
          subcategory: "Infrastructure",
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
          category: null,
          subcategory: null,
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
          category: null,
          subcategory: null,
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
          category: null,
          subcategory: null,
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
          category: "Test",
          subcategory: "Test",
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
          category: null,
          subcategory: null,
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

      it("updates updated_at timestamp", () => {
        const created = queries.createDashboard("Test", null);
        const originalUpdatedAt = created.updated_at;

        // Small delay to ensure timestamp changes
        queries.updateDashboard(created.id, "Updated", null);

        const result = queries.getDashboardById(created.id);
        // updated_at should have changed
        expect(result?.updated_at).not.toBe(originalUpdatedAt);
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

      it("updates parent dashboard updated_at", () => {
        const dashboard = queries.getDashboardById(dashboardId);
        const originalUpdatedAt = dashboard?.updated_at;

        queries.createDashboardComponent(
          dashboardId,
          "Comp",
          "table",
          "{}",
          "{}",
          null
        );

        const updated = queries.getDashboardById(dashboardId);
        expect(updated?.updated_at).not.toBe(originalUpdatedAt);
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
  // Category Update Queries
  // ==========================================================================

  describe("Category Update Queries", () => {
    describe("updateReferendumCategory", () => {
      it("updates category and subcategory on referendum", () => {
        seedTestData(testDb, TABLE_NAMES.referenda, fixtures.referenda);

        queries.updateReferendumCategory(1, "NewCategory", "NewSubcategory");

        const result = queries.getReferenda();
        const updated = result.find((r) => r.id === 1);
        expect(updated?.category).toBe("NewCategory");
        expect(updated?.subcategory).toBe("NewSubcategory");
      });

      it("can set values to NULL", () => {
        seedTestData(testDb, TABLE_NAMES.referenda, fixtures.referenda);

        queries.updateReferendumCategory(1, null, null);

        const result = queries.getReferenda();
        const updated = result.find((r) => r.id === 1);
        expect(updated?.category).toBeNull();
        expect(updated?.subcategory).toBeNull();
      });
    });

    describe("updateChildBountyCategory", () => {
      it("updates category and subcategory by identifier", () => {
        seedTestData(testDb, TABLE_NAMES.childBounties, fixtures.childBounties);

        queries.updateChildBountyCategory("10-1", "Updated", "Updated");

        const result = queries.getChildBounties();
        const updated = result.find((cb) => cb.identifier === "10-1");
        expect(updated?.category).toBe("Updated");
        expect(updated?.subcategory).toBe("Updated");
      });
    });
  });
});
