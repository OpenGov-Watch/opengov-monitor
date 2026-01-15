import { Router } from "express";

export const claimsRouter: Router = Router();

// GET /outstanding endpoint removed - use POST /api/query/execute with sourceTable: "outstanding_claims"
// GET /expired endpoint removed - use POST /api/query/execute with sourceTable: "expired_claims"
// Both are database VIEWs (read-only, no PATCH endpoints needed)
