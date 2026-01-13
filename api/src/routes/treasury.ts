import { Router } from "express";
import { getTreasury } from "../db/queries.js";
import { buildTableQuery, parseTableQueryParams } from "../db/table-query-builder.js";
import type { TreasurySpend } from "../db/types.js";

export const treasuryRouter: Router = Router();

treasuryRouter.get("/", (req, res) => {
  try {
    // Check if advanced query parameters are provided
    const hasAdvancedParams = req.query.filters || req.query.sorts || req.query.groupBy;

    if (hasAdvancedParams) {
      // Use new advanced query builder
      const options = parseTableQueryParams(req.query);
      const { data } = buildTableQuery<TreasurySpend>("Treasury", options);
      res.json(data);
    } else {
      // Use legacy query (maintains backward compatibility)
      const data = getTreasury();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
