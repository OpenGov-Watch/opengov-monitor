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
  moveDashboardComponent,
} from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";

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

dashboardsRouter.post("/", requireAuth, (req, res) => {
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

dashboardsRouter.put("/", requireAuth, (req, res) => {
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

dashboardsRouter.delete("/", requireAuth, (req, res) => {
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

dashboardsRouter.post("/components", requireAuth, (req, res) => {
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
    // Text components don't require query_config
    if (!query_config && type !== "text") {
      res.status(400).json({ error: "query_config is required" });
      return;
    }
    if (!grid_config) {
      res.status(400).json({ error: "grid_config is required" });
      return;
    }

    // For text components, use empty query_config if not provided
    const finalQueryConfig = query_config || { sourceTable: "", columns: [], filters: [] };

    const newComponent = createDashboardComponent(
      dashboard_id,
      name,
      type,
      typeof finalQueryConfig === "string" ? finalQueryConfig : JSON.stringify(finalQueryConfig),
      typeof grid_config === "string" ? grid_config : JSON.stringify(grid_config),
      chart_config ? (typeof chart_config === "string" ? chart_config : JSON.stringify(chart_config)) : null
    );

    res.status(201).json(newComponent);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

dashboardsRouter.put("/components", requireAuth, (req, res) => {
  try {
    const { id, name, type, query_config, grid_config, chart_config, grid_only, move, target_dashboard_id } = req.body;

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

    // Special case: move component to another dashboard
    if (move && target_dashboard_id !== undefined) {
      // Validate target dashboard exists
      const targetDashboard = getDashboardById(target_dashboard_id);
      if (!targetDashboard) {
        res.status(404).json({ error: "Target dashboard not found" });
        return;
      }

      // Validate component exists and get current dashboard_id
      const component = getDashboardComponentById(id);
      if (!component) {
        res.status(404).json({ error: "Component not found" });
        return;
      }

      // Prevent moving to same dashboard
      if (component.dashboard_id === target_dashboard_id) {
        res.status(400).json({ error: "Component is already on this dashboard" });
        return;
      }

      // Calculate new grid position: x=0, y = max(y+h) of existing components
      const targetComponents = getDashboardComponents(target_dashboard_id);
      let newY = 0;
      for (const comp of targetComponents) {
        const grid = JSON.parse(comp.grid_config) as { x: number; y: number; w: number; h: number };
        newY = Math.max(newY, grid.y + grid.h);
      }

      // Parse current grid config to preserve w and h
      const currentGrid = JSON.parse(component.grid_config) as { x: number; y: number; w: number; h: number };
      const newGridConfig = JSON.stringify({
        x: 0,
        y: newY,
        w: currentGrid.w,
        h: currentGrid.h,
      });

      const result = moveDashboardComponent(id, target_dashboard_id, newGridConfig);
      if (!result) {
        res.status(404).json({ error: "Component not found" });
        return;
      }

      res.json({ success: true });
      return;
    }

    // Text components don't require query_config
    if (!name || !type || !grid_config || (!query_config && type !== "text")) {
      res.status(400).json({ error: "name, type, query_config (for non-text), and grid_config are required" });
      return;
    }

    // For text components, use empty query_config if not provided
    const finalQueryConfig = query_config || { sourceTable: "", columns: [], filters: [] };

    updateDashboardComponent(
      id,
      name,
      type,
      typeof finalQueryConfig === "string" ? finalQueryConfig : JSON.stringify(finalQueryConfig),
      typeof grid_config === "string" ? grid_config : JSON.stringify(grid_config),
      chart_config ? (typeof chart_config === "string" ? chart_config : JSON.stringify(chart_config)) : null
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

dashboardsRouter.delete("/components", requireAuth, (req, res) => {
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
