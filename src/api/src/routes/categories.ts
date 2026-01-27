import { Router } from "express";
import { getCategories, createCategory, updateCategory, deleteCategory, findOrCreateCategory } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";
import { getWritableDatabase } from "../db/index.js";

export const categoriesRouter: Router = Router();

// Find or create a category by category/subcategory strings
// Useful for CSV imports and backwards-compatible writes
categoriesRouter.post("/lookup", requireAuth, (req, res) => {
  try {
    const { category, subcategory } = req.body;

    if (!category || typeof category !== "string" || category.trim() === "") {
      res.status(400).json({ error: "category is required" });
      return;
    }

    const result = findOrCreateCategory(category.trim(), (subcategory || "").trim());
    res.json(result);
  } catch (error) {
    console.error("[categories:lookup] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

categoriesRouter.get("/", (_req, res) => {
  try {
    const data = getCategories();
    res.json(data);
  } catch (error) {
    console.error("[categories:get] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

categoriesRouter.post("/", requireAuth, (req, res) => {
  try {
    const { category, subcategory } = req.body;

    if (!category || typeof category !== "string" || category.trim() === "") {
      res.status(400).json({ error: "category is required" });
      return;
    }

    const result = createCategory(category, subcategory);
    res.status(201).json(result);
  } catch (error) {
    console.error("[categories:create] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

categoriesRouter.put("/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const { category, subcategory } = req.body;

    if (!category || typeof category !== "string" || category.trim() === "") {
      res.status(400).json({ error: "category is required" });
      return;
    }

    updateCategory(id, category, subcategory);
    res.json({ success: true });
  } catch (error) {
    console.error("[categories:update] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

categoriesRouter.delete("/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const result = deleteCategory(id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[categories:delete] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /categories/import - Bulk import categories
// Body: Array of { category: string, subcategory: string }
// Empty string or "Other" subcategory is stored as NULL
categoriesRouter.post("/import", requireAuth, (req, res) => {
  try {
    const items = req.body;

    if (!Array.isArray(items)) {
      res.status(400).json({ error: "Request body must be an array" });
      return;
    }

    // Validate all items first
    const errors: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.category || typeof item.category !== "string" || item.category.trim() === "") {
        errors.push(`Row ${i + 1}: category is required`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: `Validation failed for ${errors.length} row(s)`,
        details: errors.slice(0, 10) // First 10 errors
      });
      return;
    }

    // Bulk insert with INSERT OR IGNORE
    // Empty string or "Other" subcategory is stored as NULL
    const db = getWritableDatabase();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO Categories (category, subcategory)
      VALUES (?, ?)
    `);

    const insertMany = db.transaction((rows: Array<{ category: string, subcategory: string }>) => {
      for (const row of rows) {
        const subcategory = (row.subcategory || "").trim();
        // Convert empty string or "Other" to NULL
        const normalizedSubcategory = subcategory === "" || subcategory === "Other" ? null : subcategory;
        stmt.run(row.category.trim(), normalizedSubcategory);
      }
    });

    insertMany(items);

    res.json({ success: true, count: items.length });
  } catch (error) {
    console.error("[categories:import] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});
