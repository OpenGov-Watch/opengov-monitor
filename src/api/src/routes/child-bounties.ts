import { Router } from "express";
import { updateChildBounty, bulkUpdateChildBounties, type ChildBountyImportItem } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";

export const childBountiesRouter: Router = Router();

// GET endpoint removed - use POST /api/query/execute with sourceTable: "Child Bounties"

// Update a single child bounty (all editable fields)
childBountiesRouter.patch("/:identifier", requireAuth, (req, res) => {
  try {
    const { identifier } = req.params;
    const { category_id, notes, hide_in_spends } = req.body;
    updateChildBounty(identifier, { category_id, notes, hide_in_spends });
    res.json({ success: true });
  } catch (error) {
    console.error("[child-bounties:patch] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Bulk import from CSV
childBountiesRouter.post("/import", requireAuth, (req, res) => {
  try {
    const { items } = req.body as { items: ChildBountyImportItem[] };
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }
    const count = bulkUpdateChildBounties(items);
    res.json({ success: true, count });
  } catch (error) {
    console.error("[child-bounties:import] Error:", error);
    const errorMessage = (error as Error).message;
    // Validation errors (e.g., "Import rejected: ...") are client errors (400)
    // Other errors are server errors (500)
    const statusCode = errorMessage.includes("Import rejected") ? 400 : 500;
    res.status(statusCode).json({ error: errorMessage });
  }
});
