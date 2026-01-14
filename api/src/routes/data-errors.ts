import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDataErrors } from "../db/data-errors-queries.js";

const router: Router = Router();

// GET /api/data-errors - List all data errors (authenticated only)
// Optional query params: ?table_name=Treasury&error_type=missing_value
router.get("/", requireAuth, (req, res) => {
  try {
    const { table_name, error_type } = req.query;
    const errors = getDataErrors(
      table_name as string | undefined,
      error_type as string | undefined
    );
    res.json(errors);
  } catch (error) {
    console.error("Error fetching data errors:", error);
    res.status(500).json({ error: "Failed to fetch data errors" });
  }
});

export default router;
