import { Router } from "express";

export const treasuryRouter: Router = Router();

// GET endpoint removed - use POST /api/query/execute with sourceTable: "Treasury"
// Treasury table is read-only (no PATCH endpoints needed)
