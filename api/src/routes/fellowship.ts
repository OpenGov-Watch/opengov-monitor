import { Router } from "express";
import { getFellowship, getFellowshipSubtreasury } from "../db/queries.js";
import { buildTableQuery, parseTableQueryParams } from "../db/table-query-builder.js";
import type { Fellowship } from "../db/types.js";

export const fellowshipRouter: Router = Router();

fellowshipRouter.get("/", (req, res) => {
  try {
    // Check if advanced query parameters are provided
    const hasAdvancedParams = req.query.filters || req.query.sorts || req.query.groupBy;

    if (hasAdvancedParams) {
      // Use new advanced query builder
      const options = parseTableQueryParams(req.query);
      const { data } = buildTableQuery<Fellowship>("Fellowship", options);
      res.json(data);
    } else {
      // Use legacy query (maintains backward compatibility)
      const data = getFellowship();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

fellowshipRouter.get("/subtreasury", (_req, res) => {
  try {
    const data = getFellowshipSubtreasury();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
