import { Router } from "express";
import { getLogs, isLogDatabaseAccessible, getLogCount } from "../db/queries.js";

export const logsRouter: Router = Router();

logsRouter.get("/", (_req, res) => {
  try {
    if (!isLogDatabaseAccessible()) {
      res.json([]);
      return;
    }
    const data = getLogs();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

logsRouter.get("/count", (_req, res) => {
  try {
    if (!isLogDatabaseAccessible()) {
      res.json({ count: 0 });
      return;
    }
    const count = getLogCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
