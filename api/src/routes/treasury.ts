import { Router } from "express";
import { getTreasury } from "../db/queries.js";

export const treasuryRouter: Router = Router();

treasuryRouter.get("/", (_req, res) => {
  try {
    const data = getTreasury();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
