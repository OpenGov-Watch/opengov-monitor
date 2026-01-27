import { Router } from "express";
import { replaceAllCrossChainFlows, type CrossChainFlowItem } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";

export const crossChainFlowsRouter: Router = Router();

// POST /api/cross-chain-flows/import - Replace all records
crossChainFlowsRouter.post("/import", requireAuth, (req, res) => {
  try {
    const { items } = req.body as { items: CrossChainFlowItem[] };

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }

    const count = replaceAllCrossChainFlows(items);
    res.json({ success: true, count });
  } catch (error) {
    console.error("[cross-chain-flows:import] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});
