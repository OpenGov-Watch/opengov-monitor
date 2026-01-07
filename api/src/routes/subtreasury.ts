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
    const result = createSubtreasury(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

subtreasuryRouter.put("/:id", (req, res) => {
  try {
    updateSubtreasury(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

subtreasuryRouter.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    deleteSubtreasury(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
