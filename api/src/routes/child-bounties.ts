import { Router } from "express";
import { getChildBounties, updateChildBounty, bulkUpdateChildBounties, type ChildBountyImportItem } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";
import { buildTableQuery, parseTableQueryParams } from "../db/table-query-builder.js";
import type { ChildBounty } from "../db/types.js";

export const childBountiesRouter: Router = Router();

childBountiesRouter.get("/", (req, res) => {
  try {
    // Check if advanced query parameters are provided
    const hasAdvancedParams = req.query.filters || req.query.sorts || req.query.groupBy;

    if (hasAdvancedParams) {
      // Use new advanced query builder
      const options = parseTableQueryParams(req.query);
      const { data } = buildTableQuery<ChildBounty>("Child Bounties", options);
      res.json(data);
    } else {
      // Use legacy query (maintains backward compatibility)
      const data = getChildBounties();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update a single child bounty (all editable fields)
childBountiesRouter.patch("/:identifier", requireAuth, (req, res) => {
  try {
    const { identifier } = req.params;
    const { category_id, notes, hide_in_spends } = req.body;
    updateChildBounty(identifier, { category_id, notes, hide_in_spends });
    res.json({ success: true });
  } catch (error) {
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
    res.status(500).json({ error: (error as Error).message });
  }
});
