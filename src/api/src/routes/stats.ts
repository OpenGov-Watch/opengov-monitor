import { Router } from "express";
import { getRowCount, tableExists, viewExists, isDatabaseAccessible } from "../db/queries.js";
import { TABLE_NAMES, VIEW_NAMES } from "../db/types.js";

export const statsRouter: Router = Router();

// Helper to safely get row count - returns null on error
function safeGetRowCount(name: string): number | null {
  try {
    return getRowCount(name);
  } catch {
    return null;
  }
}

statsRouter.get("/", (_req, res) => {
  try {
    if (!isDatabaseAccessible()) {
      res.status(503).json({ error: "Database not accessible" });
      return;
    }

    const stats: Record<string, number | null> = {};

    // Core tables
    if (tableExists(TABLE_NAMES.referenda)) {
      stats.referenda = safeGetRowCount(TABLE_NAMES.referenda);
    }
    if (tableExists(TABLE_NAMES.treasury)) {
      stats.treasury = safeGetRowCount(TABLE_NAMES.treasury);
    }
    if (tableExists(TABLE_NAMES.childBounties)) {
      stats.childBounties = safeGetRowCount(TABLE_NAMES.childBounties);
    }
    if (tableExists(TABLE_NAMES.fellowship)) {
      stats.fellowship = safeGetRowCount(TABLE_NAMES.fellowship);
    }

    // Salary tables
    if (tableExists(TABLE_NAMES.fellowshipSalaryCycles)) {
      stats.salaryCycles = safeGetRowCount(TABLE_NAMES.fellowshipSalaryCycles);
    }
    if (tableExists(TABLE_NAMES.fellowshipSalaryClaimants)) {
      stats.salaryClaimants = safeGetRowCount(TABLE_NAMES.fellowshipSalaryClaimants);
    }

    // Views - these can fail if view definition references missing columns
    if (viewExists(VIEW_NAMES.outstandingClaims)) {
      stats.outstandingClaims = safeGetRowCount(VIEW_NAMES.outstandingClaims);
    }
    if (viewExists(VIEW_NAMES.expiredClaims)) {
      stats.expiredClaims = safeGetRowCount(VIEW_NAMES.expiredClaims);
    }
    if (viewExists(VIEW_NAMES.allSpending)) {
      stats.allSpending = safeGetRowCount(VIEW_NAMES.allSpending);
    }

    // Manual tables
    if (tableExists(TABLE_NAMES.categories)) {
      stats.categories = safeGetRowCount(TABLE_NAMES.categories);
    }
    if (tableExists(TABLE_NAMES.bounties)) {
      stats.bounties = safeGetRowCount(TABLE_NAMES.bounties);
    }
    if (tableExists(TABLE_NAMES.subtreasury)) {
      stats.subtreasury = safeGetRowCount(TABLE_NAMES.subtreasury);
    }

    // Dashboards
    if (tableExists(TABLE_NAMES.dashboards)) {
      stats.dashboards = safeGetRowCount(TABLE_NAMES.dashboards);
    }

    res.json(stats);
  } catch (error) {
    console.error("[stats:get] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});
