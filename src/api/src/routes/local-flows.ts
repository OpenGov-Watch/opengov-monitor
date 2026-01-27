import { Router } from "express";
import { replaceAllLocalFlows, type LocalFlowItem } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";

export const localFlowsRouter: Router = Router();

// POST /api/local-flows/import - Replace all records
localFlowsRouter.post("/import", requireAuth, (req, res) => {
  try {
    const { items } = req.body as { items: LocalFlowItem[] };

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }

    const count = replaceAllLocalFlows(items);
    res.json({ success: true, count });
  } catch (error) {
    console.error("[local-flows:import] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});
