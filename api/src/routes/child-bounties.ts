import { Router } from "express";
import { getChildBounties, updateChildBountyCategory } from "../db/queries.js";

export const childBountiesRouter: Router = Router();

childBountiesRouter.get("/", (_req, res) => {
  try {
    const data = getChildBounties();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

childBountiesRouter.patch("/:identifier/category", (req, res) => {
  try {
    const { identifier } = req.params;
    const { category, subcategory } = req.body;
    updateChildBountyCategory(identifier, category, subcategory);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
