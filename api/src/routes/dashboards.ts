import { Router } from "express";
import {
  getDashboards,
  getDashboardById,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  getDashboardComponents,
  getDashboardComponentById,
  createDashboardComponent,
  updateDashboardComponent,
  updateDashboardComponentGrid,
  deleteDashboardComponent,
} from "../db/queries.js";

export const dashboardsRouter: Router = Router();

// Dashboard CRUD
dashboardsRouter.get("/", (req, res) => {
  try {
    const id = req.query.id;
    if (id) {
      const dashboard = getDashboardById(parseInt(id as string, 10));
      if (!dashboard) {
        res.status(404).json({ error: "Dashboard not found" });
        return;
      }
      res.json(dashboard);
      return;
    }
    const dashboards = getDashboards();
    res.json(dashboards);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

dashboardsRouter.post("/", (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const newDashboard = createDashboard(name, description ?? null);
    res.status(201).json(newDashboard);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

dashboardsRouter.put("/", (req, res) => {
  try {
    const { id, name, description } = req.body;
    if (id === undefined) {
      res.status(400).json({ error: "ID is required" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    updateDashboard(id, name, description ?? null);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

dashboardsRouter.delete("/", (req, res) => {
  try {
    const id = req.query.id;
    if (!id) {
      res.status(400).json({ error: "ID is required" });
      return;
    }
    deleteDashboard(parseInt(id as string, 10));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Dashboard Components CRUD
dashboardsRouter.get("/components", (req, res) => {
  try {
    const id = req.query.id;
    const dashboardId = req.query.dashboard_id;

    if (id) {
      const component = getDashboardComponentById(parseInt(id as string, 10));
      if (!component) {
        res.status(404).json({ error: "Component not found" });
        return;
      }
      res.json(component);
      return;
    }

    if (dashboardId) {
      const components = getDashboardComponents(parseInt(dashboardId as string, 10));
      res.json(components);
      return;
    }

    res.status(400).json({ error: "dashboard_id or id is required" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

dashboardsRouter.post("/components", (req, res) => {
  try {
    const { dashboard_id, name, type, query_config, grid_config, chart_config } = req.body;

    if (!dashboard_id) {
      res.status(400).json({ error: "dashboard_id is required" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!type) {
      res.status(400).json({ error: "type is required" });
      return;
    }
    if (!query_config) {
      res.status(400).json({ error: "query_config is required" });
      return;
    }
    if (!grid_config) {
      res.status(400).json({ error: "grid_config is required" });
      return;
    }

    const newComponent = createDashboardComponent(
      dashboard_id,
      name,
      type,
      typeof query_config === "string" ? query_config : JSON.stringify(query_config),
      typeof grid_config === "string" ? grid_config : JSON.stringify(grid_config),
      chart_config ? (typeof chart_config === "string" ? chart_config : JSON.stringify(chart_config)) : null
    );

    res.status(201).json(newComponent);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

dashboardsRouter.put("/components", (req, res) => {
  try {
    const { id, name, type, query_config, grid_config, chart_config, grid_only } = req.body;

    if (id === undefined) {
      res.status(400).json({ error: "id is required" });
      return;
    }

    // Special case: only updating grid position (for drag/resize)
    if (grid_only && grid_config) {
      updateDashboardComponentGrid(
        id,
        typeof grid_config === "string" ? grid_config : JSON.stringify(grid_config)
      );
      res.json({ success: true });
      return;
    }

    if (!name || !type || !query_config || !grid_config) {
      res.status(400).json({ error: "name, type, query_config, and grid_config are required" });
      return;
    }

    updateDashboardComponent(
      id,
      name,
      type,
      typeof query_config === "string" ? query_config : JSON.stringify(query_config),
      typeof grid_config === "string" ? grid_config : JSON.stringify(grid_config),
      chart_config ? (typeof chart_config === "string" ? chart_config : JSON.stringify(chart_config)) : null
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

dashboardsRouter.delete("/components", (req, res) => {
  try {
    const id = req.query.id;
    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }
    deleteDashboardComponent(parseInt(id as string, 10));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
