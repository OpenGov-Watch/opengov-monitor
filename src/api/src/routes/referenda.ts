import { Router } from "express";
import { updateReferendum, bulkUpdateReferenda, type ReferendumImportItem } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";

export const referendaRouter: Router = Router();

// GET endpoint removed - use POST /api/query/execute with sourceTable: "Referenda"

// Update a single referendum (all editable fields)
referendaRouter.patch("/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category_id, notes, hide_in_spends } = req.body;
    updateReferendum(id, { category_id, notes, hide_in_spends });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Bulk import from CSV
referendaRouter.post("/import", requireAuth, (req, res) => {
  try {
    const { items } = req.body as { items: ReferendumImportItem[] };
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array" });
    }
    const count = bulkUpdateReferenda(items);
    res.json({ success: true, count });
  } catch (error) {
    const errorMessage = (error as Error).message;
    // Validation errors (e.g., "Import rejected: ...") are client errors (400)
    // Other errors are server errors (500)
    const statusCode = errorMessage.includes("Import rejected") ? 400 : 500;
    res.status(statusCode).json({ error: errorMessage });
  }
});
