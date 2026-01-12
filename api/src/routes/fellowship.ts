import { Router } from "express";
import { getFellowship, getFellowshipSubtreasury } from "../db/queries.js";

export const fellowshipRouter: Router = Router();

fellowshipRouter.get("/", (_req, res) => {
  try {
    const data = getFellowship();
    res.json(data);
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
