import { Router } from "express";
import { getBounties, getBountyById, upsertBounty, updateBountyCategory, deleteBounty } from "../db/queries.js";

export const bountiesRouter: Router = Router();

bountiesRouter.get("/", (_req, res) => {
  try {
    const data = getBounties();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

bountiesRouter.get("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = getBountyById(id);
    if (!data) {
      res.status(404).json({ error: "Bounty not found" });
      return;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

bountiesRouter.post("/", (req, res) => {
  try {
    upsertBounty(req.body);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

bountiesRouter.put("/:id", (req, res) => {
  try {
    upsertBounty(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

bountiesRouter.patch("/:id/category", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category, subcategory } = req.body;
    updateBountyCategory(id, category, subcategory);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

bountiesRouter.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    deleteBounty(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
