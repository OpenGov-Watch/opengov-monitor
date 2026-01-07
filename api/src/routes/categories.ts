import { Router } from "express";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../db/queries.js";

export const categoriesRouter: Router = Router();

categoriesRouter.get("/", (_req, res) => {
  try {
    const data = getCategories();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

categoriesRouter.post("/", (req, res) => {
  try {
    const { category, subcategory } = req.body;
    const result = createCategory(category, subcategory);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

categoriesRouter.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category, subcategory } = req.body;
    updateCategory(id, category, subcategory);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

categoriesRouter.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    deleteCategory(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
