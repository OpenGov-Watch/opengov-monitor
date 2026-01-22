/**
 * Dashboards Route Tests
 *
 * Tests HTTP-level validation for dashboards and components.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { dashboardsRouter } from "../dashboards.js";
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
  app.use("/api/dashboards", dashboardsRouter);
  return app;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS "Dashboards" (
    "id" INTEGER PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "created_at" TEXT,
    "updated_at" TEXT
  );

  CREATE TABLE IF NOT EXISTS "Dashboard Components" (
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

let app: express.Express;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(SCHEMA_SQL);
  app = createApp();
});

beforeEach(() => {
  testDb.exec('DELETE FROM "Dashboard Components"');
  testDb.exec('DELETE FROM "Dashboards"');
});

afterAll(() => {
  testDb.close();
});

// =============================================================================
// Dashboard CRUD Tests
// =============================================================================
describe("Dashboard CRUD", () => {
  describe("GET /api/dashboards", () => {
    it("returns empty array when no dashboards", async () => {
      const response = await request(app).get("/api/dashboards");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("returns all dashboards", async () => {
      testDb.exec(`
        INSERT INTO "Dashboards" (id, name, description, created_at, updated_at)
        VALUES (1, 'Dashboard 1', 'Desc 1', '2024-01-01', '2024-01-01'),
               (2, 'Dashboard 2', null, '2024-01-02', '2024-01-02')
      `);

      const response = await request(app).get("/api/dashboards");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it("returns single dashboard by id query param", async () => {
      testDb.exec(`
        INSERT INTO "Dashboards" (id, name, description, created_at, updated_at)
        VALUES (1, 'Dashboard 1', 'Desc', '2024-01-01', '2024-01-01')
      `);

      const response = await request(app).get("/api/dashboards?id=1");

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe("Dashboard 1");
    });

    it("returns 404 for non-existent dashboard id", async () => {
      const response = await request(app).get("/api/dashboards?id=999");

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });
  });

  describe("POST /api/dashboards", () => {
    it("creates dashboard with valid data", async () => {
      const response = await request(app)
        .post("/api/dashboards")
        .send({ name: "New Dashboard", description: "My Description" });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe("New Dashboard");
      expect(response.body.description).toBe("My Description");
    });

    it("creates dashboard with null description", async () => {
      const response = await request(app)
        .post("/api/dashboards")
        .send({ name: "No Desc" });

      expect(response.status).toBe(201);
      expect(response.body.description).toBeNull();
    });

    it("returns 400 when name is missing", async () => {
      const response = await request(app)
        .post("/api/dashboards")
        .send({ description: "No Name" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Name is required");
    });

    it("returns 400 when name is empty", async () => {
      const response = await request(app)
        .post("/api/dashboards")
        .send({ name: "" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Name is required");
    });
  });

  describe("PUT /api/dashboards", () => {
    it("updates dashboard with valid data", async () => {
      testDb.exec(`
        INSERT INTO "Dashboards" (id, name, description, created_at, updated_at)
        VALUES (1, 'Original', 'Desc', '2024-01-01', '2024-01-01')
      `);

      const response = await request(app)
        .put("/api/dashboards")
        .send({ id: 1, name: "Updated", description: "New Desc" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("returns 400 when id is missing", async () => {
      const response = await request(app)
        .put("/api/dashboards")
        .send({ name: "Updated" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("ID is required");
    });

    it("returns 400 when name is missing", async () => {
      const response = await request(app)
        .put("/api/dashboards")
        .send({ id: 1, description: "Desc" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Name is required");
    });
  });

  describe("DELETE /api/dashboards", () => {
    it("deletes dashboard by id query param", async () => {
      testDb.exec(`
        INSERT INTO "Dashboards" (id, name, description, created_at, updated_at)
        VALUES (1, 'ToDelete', null, '2024-01-01', '2024-01-01')
      `);

      const response = await request(app).delete("/api/dashboards?id=1");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("returns 400 when id is missing", async () => {
      const response = await request(app).delete("/api/dashboards");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("ID is required");
    });
  });
});

// =============================================================================
// Dashboard Components CRUD Tests
// =============================================================================
describe("Dashboard Components CRUD", () => {
  beforeEach(() => {
    // Create a parent dashboard for component tests
    testDb.exec(`
      INSERT INTO "Dashboards" (id, name, description, created_at, updated_at)
      VALUES (1, 'Parent Dashboard', null, '2024-01-01', '2024-01-01')
    `);
  });

  describe("GET /api/dashboards/components", () => {
    it("returns components by dashboard_id", async () => {
      testDb.exec(`
        INSERT INTO "Dashboard Components" (id, dashboard_id, name, type, query_config, grid_config, chart_config, created_at, updated_at)
        VALUES (1, 1, 'Comp1', 'table', '{}', '{}', null, '2024-01-01', '2024-01-01')
      `);

      const response = await request(app).get(
        "/api/dashboards/components?dashboard_id=1"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Comp1");
    });

    it("returns single component by id", async () => {
      testDb.exec(`
        INSERT INTO "Dashboard Components" (id, dashboard_id, name, type, query_config, grid_config, chart_config, created_at, updated_at)
        VALUES (1, 1, 'Comp1', 'table', '{}', '{}', null, '2024-01-01', '2024-01-01')
      `);

      const response = await request(app).get("/api/dashboards/components?id=1");

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Comp1");
    });

    it("returns 404 for non-existent component id", async () => {
      const response = await request(app).get(
        "/api/dashboards/components?id=999"
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("returns 400 when neither id nor dashboard_id provided", async () => {
      const response = await request(app).get("/api/dashboards/components");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("dashboard_id or id is required");
    });
  });

  describe("POST /api/dashboards/components", () => {
    it("creates component with valid data", async () => {
      const response = await request(app)
        .post("/api/dashboards/components")
        .send({
          dashboard_id: 1,
          name: "New Component",
          type: "table",
          query_config: { sourceTable: "Referenda", columns: [], filters: [] },
          grid_config: { x: 0, y: 0, w: 6, h: 4 },
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe("New Component");
    });

    it("creates text component without query_config", async () => {
      const response = await request(app)
        .post("/api/dashboards/components")
        .send({
          dashboard_id: 1,
          name: "Text Widget",
          type: "text",
          grid_config: { x: 0, y: 0, w: 6, h: 4 },
        });

      expect(response.status).toBe(201);
    });

    it("returns 400 when dashboard_id is missing", async () => {
      const response = await request(app)
        .post("/api/dashboards/components")
        .send({
          name: "Component",
          type: "table",
          query_config: {},
          grid_config: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("dashboard_id is required");
    });

    it("returns 400 when name is missing", async () => {
      const response = await request(app)
        .post("/api/dashboards/components")
        .send({
          dashboard_id: 1,
          type: "table",
          query_config: {},
          grid_config: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("name is required");
    });

    it("returns 400 when type is missing", async () => {
      const response = await request(app)
        .post("/api/dashboards/components")
        .send({
          dashboard_id: 1,
          name: "Component",
          query_config: {},
          grid_config: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("type is required");
    });

    it("returns 400 when query_config is missing for non-text type", async () => {
      const response = await request(app)
        .post("/api/dashboards/components")
        .send({
          dashboard_id: 1,
          name: "Component",
          type: "table",
          grid_config: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("query_config is required");
    });

    it("returns 400 when grid_config is missing", async () => {
      const response = await request(app)
        .post("/api/dashboards/components")
        .send({
          dashboard_id: 1,
          name: "Component",
          type: "table",
          query_config: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("grid_config is required");
    });

    it("accepts config as JSON string", async () => {
      const response = await request(app)
        .post("/api/dashboards/components")
        .send({
          dashboard_id: 1,
          name: "String Config",
          type: "table",
          query_config: JSON.stringify({ sourceTable: "Referenda" }),
          grid_config: JSON.stringify({ x: 0, y: 0 }),
        });

      expect(response.status).toBe(201);
    });
  });

  describe("PUT /api/dashboards/components", () => {
    beforeEach(() => {
      testDb.exec(`
        INSERT INTO "Dashboard Components" (id, dashboard_id, name, type, query_config, grid_config, chart_config, created_at, updated_at)
        VALUES (1, 1, 'Original', 'table', '{}', '{}', null, '2024-01-01', '2024-01-01')
      `);
    });

    it("updates component with full data", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          name: "Updated",
          type: "pie",
          query_config: { sourceTable: "Treasury" },
          grid_config: { x: 1, y: 1 },
          chart_config: { colors: ["red"] },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("updates only grid_config with grid_only flag", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          grid_only: true,
          grid_config: { x: 5, y: 5, w: 3, h: 2 },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("returns 400 when id is missing", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          name: "Updated",
          type: "table",
          query_config: {},
          grid_config: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("id is required");
    });

    it("returns 400 for full update without required fields", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          name: "Updated",
          // Missing type, query_config, grid_config
        });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/dashboards/components", () => {
    it("deletes component by id", async () => {
      testDb.exec(`
        INSERT INTO "Dashboard Components" (id, dashboard_id, name, type, query_config, grid_config, chart_config, created_at, updated_at)
        VALUES (1, 1, 'ToDelete', 'table', '{}', '{}', null, '2024-01-01', '2024-01-01')
      `);

      const response = await request(app).delete(
        "/api/dashboards/components?id=1"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("returns 400 when id is missing", async () => {
      const response = await request(app).delete("/api/dashboards/components");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("id is required");
    });
  });

  describe("PUT /api/dashboards/components - move operation", () => {
    beforeEach(() => {
      // Create a second dashboard for move tests
      testDb.exec(`
        INSERT INTO "Dashboards" (id, name, description, created_at, updated_at)
        VALUES (2, 'Second Dashboard', null, '2024-01-01', '2024-01-01')
      `);
      // Create a component on dashboard 1
      testDb.exec(`
        INSERT INTO "Dashboard Components" (id, dashboard_id, name, type, query_config, grid_config, chart_config, created_at, updated_at)
        VALUES (1, 1, 'Component1', 'table', '{}', '{"x":0,"y":0,"w":6,"h":4}', null, '2024-01-01', '2024-01-01')
      `);
    });

    it("moves component to another dashboard", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          move: true,
          target_dashboard_id: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify component was moved
      const component = testDb.prepare('SELECT * FROM "Dashboard Components" WHERE id = 1').get() as {
        dashboard_id: number;
        grid_config: string;
      };
      expect(component.dashboard_id).toBe(2);
    });

    it("calculates correct grid position when target has components", async () => {
      // Add existing component at y:0,h:4 to target dashboard
      testDb.exec(`
        INSERT INTO "Dashboard Components" (id, dashboard_id, name, type, query_config, grid_config, chart_config, created_at, updated_at)
        VALUES (2, 2, 'ExistingComp', 'table', '{}', '{"x":0,"y":0,"w":6,"h":4}', null, '2024-01-01', '2024-01-01')
      `);

      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          move: true,
          target_dashboard_id: 2,
        });

      expect(response.status).toBe(200);

      // Verify new y position is 4 (at bottom of existing component)
      const component = testDb.prepare('SELECT * FROM "Dashboard Components" WHERE id = 1').get() as {
        grid_config: string;
      };
      const grid = JSON.parse(component.grid_config);
      expect(grid.y).toBe(4);
      expect(grid.x).toBe(0);
    });

    it("returns 404 for non-existent target dashboard", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          move: true,
          target_dashboard_id: 999,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("Target dashboard not found");
    });

    it("returns 400 when moving to same dashboard", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          move: true,
          target_dashboard_id: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already on this dashboard");
    });

    it("returns 404 for non-existent component", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 999,
          move: true,
          target_dashboard_id: 2,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("Component not found");
    });

    it("updates timestamps on both dashboards", async () => {
      // Get original timestamps
      const beforeSource = testDb.prepare('SELECT updated_at FROM "Dashboards" WHERE id = 1').get() as { updated_at: string };
      const beforeTarget = testDb.prepare('SELECT updated_at FROM "Dashboards" WHERE id = 2').get() as { updated_at: string };

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          move: true,
          target_dashboard_id: 2,
        });

      const afterSource = testDb.prepare('SELECT updated_at FROM "Dashboards" WHERE id = 1').get() as { updated_at: string };
      const afterTarget = testDb.prepare('SELECT updated_at FROM "Dashboards" WHERE id = 2').get() as { updated_at: string };

      // Both dashboards should have updated timestamps
      expect(afterSource.updated_at).not.toBe(beforeSource.updated_at);
      expect(afterTarget.updated_at).not.toBe(beforeTarget.updated_at);
    });

    it("preserves component dimensions when moving", async () => {
      const response = await request(app)
        .put("/api/dashboards/components")
        .send({
          id: 1,
          move: true,
          target_dashboard_id: 2,
        });

      expect(response.status).toBe(200);

      // Verify w and h are preserved
      const component = testDb.prepare('SELECT * FROM "Dashboard Components" WHERE id = 1').get() as {
        grid_config: string;
      };
      const grid = JSON.parse(component.grid_config);
      expect(grid.w).toBe(6);
      expect(grid.h).toBe(4);
    });
  });
});
