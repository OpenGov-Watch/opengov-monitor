import { Router } from "express";

export const salaryRouter: Router = Router();

// GET /cycles endpoint removed - use POST /api/query/execute with sourceTable: "Fellowship Salary Cycles"
// GET /claimants endpoint removed - use POST /api/query/execute with sourceTable: "Fellowship Salary Claimants"
// Both tables are read-only (no PATCH endpoints needed)
