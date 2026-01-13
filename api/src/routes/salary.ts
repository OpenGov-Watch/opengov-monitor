import { Router } from "express";
import { getFellowshipSalaryCycles, getFellowshipSalaryClaimants } from "../db/queries.js";
import { buildTableQuery, parseTableQueryParams } from "../db/table-query-builder.js";
import type { FellowshipSalaryCycle, FellowshipSalaryClaimant } from "../db/types.js";

export const salaryRouter: Router = Router();

salaryRouter.get("/cycles", (req, res) => {
  try {
    // Check if advanced query parameters are provided
    const hasAdvancedParams = req.query.filters || req.query.sorts || req.query.groupBy;

    if (hasAdvancedParams) {
      // Use new advanced query builder
      const options = parseTableQueryParams(req.query);
      const { data } = buildTableQuery<FellowshipSalaryCycle>("Fellowship Salary Cycles", options);
      res.json(data);
    } else {
      // Use legacy query (maintains backward compatibility)
      const data = getFellowshipSalaryCycles();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

salaryRouter.get("/claimants", (req, res) => {
  try {
    // Check if advanced query parameters are provided
    const hasAdvancedParams = req.query.filters || req.query.sorts || req.query.groupBy;

    if (hasAdvancedParams) {
      // Use new advanced query builder
      const options = parseTableQueryParams(req.query);
      const { data } = buildTableQuery<FellowshipSalaryClaimant>("Fellowship Salary Claimants", options);
      res.json(data);
    } else {
      // Use legacy query (maintains backward compatibility)
      const data = getFellowshipSalaryClaimants();
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
