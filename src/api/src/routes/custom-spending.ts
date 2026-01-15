import { Router } from "express";
import {
  getCustomSpending,
  getCustomSpendingById,
  createCustomSpending,
  updateCustomSpending,
  deleteCustomSpending,
} from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";

export const customSpendingRouter: Router = Router();

// Valid spending types (must match existing types in all_spending view)
const VALID_TYPES = [
  "Direct Spend",
  "Claim",
  "Bounty",
  "Subtreasury",
  "Fellowship Salary",
  "Fellowship Grants",
];

customSpendingRouter.get("/", (_req, res) => {
  try {
    const data = getCustomSpending();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

customSpendingRouter.get("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = getCustomSpendingById(id);
    if (!data) {
      res.status(404).json({ error: "Custom spending entry not found" });
      return;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

customSpendingRouter.post("/", requireAuth, (req, res) => {
  try {
    const { type, title } = req.body;

    // Validate required fields
    if (!type || typeof type !== "string" || type.trim() === "") {
      res.status(400).json({ error: "type is required" });
      return;
    }

    if (!title || typeof title !== "string" || title.trim() === "") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    // Validate type against allowed values
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({
        error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
      });
      return;
    }

    const result = createCustomSpending(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

customSpendingRouter.put("/:id", requireAuth, (req, res) => {
  try {
    const urlId = parseInt(req.params.id);
    if (isNaN(urlId)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const { type, title } = req.body;

    // Validate required fields
    if (!type || typeof type !== "string" || type.trim() === "") {
      res.status(400).json({ error: "type is required" });
      return;
    }

    if (!title || typeof title !== "string" || title.trim() === "") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    // Validate type against allowed values
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({
        error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
      });
      return;
    }

    // Ensure body has the URL id
    updateCustomSpending({ ...req.body, id: urlId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

customSpendingRouter.delete("/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    deleteCustomSpending(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
