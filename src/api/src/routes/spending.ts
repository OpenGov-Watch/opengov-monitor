import { Router } from "express";
import { getAllSpending } from "../db/queries.js";

export const spendingRouter: Router = Router();

spendingRouter.get("/", (_req, res) => {
  try {
    const data = getAllSpending();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
