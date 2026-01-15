import { Router } from "express";
import { getBounties, getBountyById, upsertBounty, updateBountyCategory, deleteBounty } from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";

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

bountiesRouter.post("/", requireAuth, (req, res) => {
  try {
    const { id } = req.body;

    if (id === undefined || id === null) {
      res.status(400).json({ error: "id is required" });
      return;
    }

    const numericId = typeof id === "string" ? parseInt(id) : id;
    if (typeof numericId !== "number" || isNaN(numericId)) {
      res.status(400).json({ error: "id must be a number" });
      return;
    }

    upsertBounty(req.body);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

bountiesRouter.put("/:id", requireAuth, (req, res) => {
  try {
    const urlId = parseInt(req.params.id);
    if (isNaN(urlId)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const { id: bodyId } = req.body;
    if (bodyId !== undefined && bodyId !== urlId) {
      res.status(400).json({ error: "id in body must match id in URL" });
      return;
    }

    // Ensure body has the URL id
    upsertBounty({ ...req.body, id: urlId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

bountiesRouter.patch("/:id/category", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const { category_id } = req.body;
    updateBountyCategory(id, category_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

bountiesRouter.delete("/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    deleteBounty(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
