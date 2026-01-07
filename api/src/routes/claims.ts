import { Router } from "express";
import { getOutstandingClaims, getExpiredClaims } from "../db/queries.js";

export const claimsRouter: Router = Router();

claimsRouter.get("/outstanding", (_req, res) => {
  try {
    const data = getOutstandingClaims();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

claimsRouter.get("/expired", (_req, res) => {
  try {
    const data = getExpiredClaims();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
