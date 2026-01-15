/**
 * Test Express app for route testing with supertest.
 * Creates an isolated Express app with test database.
 */

import express from "express";
import { categoriesRouter } from "../routes/categories.js";
import { bountiesRouter } from "../routes/bounties.js";
import { subtreasuryRouter } from "../routes/subtreasury.js";
import { dashboardsRouter } from "../routes/dashboards.js";
import { queryRouter } from "../routes/query.js";

export function createTestApp(): express.Express {
  const app = express();

  // Middleware
  app.use(express.json());

  // Mount routes
  app.use("/api/categories", categoriesRouter);
  app.use("/api/bounties", bountiesRouter);
  app.use("/api/subtreasury", subtreasuryRouter);
  app.use("/api/dashboards", dashboardsRouter);
  app.use("/api/query", queryRouter);

  // Error handling
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(500).json({ error: err.message });
    }
  );

  return app;
}
