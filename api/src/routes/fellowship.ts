import { Router } from "express";
import { getFellowshipSubtreasury } from "../db/queries.js";

export const fellowshipRouter: Router = Router();

// GET / endpoint removed - use POST /api/query/execute with sourceTable: "Fellowship"

fellowshipRouter.get("/subtreasury", (_req, res) => {
  try {
    const data = getFellowshipSubtreasury();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
