import { Router } from "express";
import { getReferenda, updateReferendum, bulkUpdateReferenda, type ReferendumImportItem } from "../db/queries.js";

export const referendaRouter: Router = Router();

referendaRouter.get("/", (_req, res) => {
  try {
    const data = getReferenda();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update a single referendum (all editable fields)
referendaRouter.patch("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category, subcategory, notes, hide_in_spends } = req.body;
    updateReferendum(id, { category, subcategory, notes, hide_in_spends });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Bulk import from CSV
referendaRouter.post("/import", (req, res) => {
  try {
    const { items } = req.body as { items: ReferendumImportItem[] };
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }
    const count = bulkUpdateReferenda(items);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
