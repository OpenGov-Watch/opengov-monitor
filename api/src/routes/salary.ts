import { Router } from "express";
import { getFellowshipSalaryCycles, getFellowshipSalaryClaimants } from "../db/queries.js";

export const salaryRouter: Router = Router();

salaryRouter.get("/cycles", (_req, res) => {
  try {
    const data = getFellowshipSalaryCycles();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

salaryRouter.get("/claimants", (_req, res) => {
  try {
    const data = getFellowshipSalaryClaimants();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
