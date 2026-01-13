import { Router } from "express";
import { getReferenda, updateReferendum, bulkUpdateReferenda, type ReferendumImportItem } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";
import { buildTableQuery, parseTableQueryParams } from "../db/table-query-builder.js";
import type { Referendum } from "../db/types.js";

export const referendaRouter: Router = Router();

referendaRouter.get("/", (req, res) => {
  try {
    // Check if advanced query parameters are provided
    const hasAdvancedParams = req.query.filters || req.query.sorts || req.query.groupBy;

    if (hasAdvancedParams) {
      // Use new advanced query builder
      const options = parseTableQueryParams(req.query);
      const { data } = buildTableQuery<Referendum>("Referenda", options);
      res.json(data);
    } else {
      // Use legacy query (maintains backward compatibility)
      const data = getReferenda();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

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
    res.status(500).json({ error: (error as Error).message });
  }
});
