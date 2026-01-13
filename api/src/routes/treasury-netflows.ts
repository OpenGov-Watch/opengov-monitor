import { Router } from "express";
import { getTreasuryNetflows, replaceAllNetflows, type NetflowImportItem } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";

export const treasuryNetflowsRouter: Router = Router();

// GET /api/treasury-netflows - Get all netflows
treasuryNetflowsRouter.get("/", (_req, res) => {
  try {
    const data = getTreasuryNetflows();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/treasury-netflows/import - Replace all records
treasuryNetflowsRouter.post("/import", requireAuth, (req, res) => {
  try {
    const { items } = req.body as { items: NetflowImportItem[] };

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }

    // Validate required fields
    for (const item of items) {
      if (!item.month || !item.asset_name || !item.flow_type) {
        return res.status(400).json({
          error: "Each item must have month, asset_name, and flow_type"
        });
      }
      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(item.month)) {
        return res.status(400).json({
          error: `Invalid month format: ${item.month}. Expected YYYY-MM`
        });
      }
    }

    const count = replaceAllNetflows(items);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
