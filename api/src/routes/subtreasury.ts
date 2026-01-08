import { Router } from "express";
import { getSubtreasury, getSubtreasuryById, createSubtreasury, updateSubtreasury, deleteSubtreasury } from "../db/queries.js";

export const subtreasuryRouter: Router = Router();

subtreasuryRouter.get("/", (_req, res) => {
  try {
    const data = getSubtreasury();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

subtreasuryRouter.get("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = getSubtreasuryById(id);
    if (!data) {
      res.status(404).json({ error: "Subtreasury entry not found" });
      return;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

subtreasuryRouter.post("/", (req, res) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const result = createSubtreasury(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

subtreasuryRouter.put("/:id", (req, res) => {
  try {
    const urlId = parseInt(req.params.id);
    if (isNaN(urlId)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const { title } = req.body;
    if (!title || typeof title !== "string" || title.trim() === "") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    // Ensure body has the URL id
    updateSubtreasury({ ...req.body, id: urlId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

subtreasuryRouter.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    deleteSubtreasury(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
