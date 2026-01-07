import { Router } from "express";
import { getReferenda, updateReferendumCategory } from "../db/queries.js";

export const referendaRouter: Router = Router();

referendaRouter.get("/", (_req, res) => {
  try {
    const data = getReferenda();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

referendaRouter.patch("/:id/category", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category, subcategory } = req.body;
    updateReferendumCategory(id, category, subcategory);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
