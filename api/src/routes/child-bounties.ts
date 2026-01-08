import { Router } from "express";
import { getChildBounties, updateChildBounty, bulkUpdateChildBounties, type ChildBountyImportItem } from "../db/queries.js";

export const childBountiesRouter: Router = Router();

childBountiesRouter.get("/", (_req, res) => {
  try {
    const data = getChildBounties();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update a single child bounty (all editable fields)
childBountiesRouter.patch("/:identifier", (req, res) => {
  try {
    const { identifier } = req.params;
    const { category, subcategory, notes, hide_in_spends } = req.body;
    updateChildBounty(identifier, { category, subcategory, notes, hide_in_spends });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Bulk import from CSV
childBountiesRouter.post("/import", (req, res) => {
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
