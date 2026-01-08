import express from "express";
import cors from "cors";
import session from "express-session";
import { createSessionStore } from "./db/session-store.js";
import { ensureUsersTable } from "./db/auth-queries.js";

// Import route handlers
import { authRouter } from "./routes/auth.js";
import { referendaRouter } from "./routes/referenda.js";
import { treasuryRouter } from "./routes/treasury.js";
import { childBountiesRouter } from "./routes/child-bounties.js";
import { fellowshipRouter } from "./routes/fellowship.js";
import { salaryRouter } from "./routes/salary.js";
import { claimsRouter } from "./routes/claims.js";
import { spendingRouter } from "./routes/spending.js";
import { logsRouter } from "./routes/logs.js";
import { categoriesRouter } from "./routes/categories.js";
import { bountiesRouter } from "./routes/bounties.js";
import { subtreasuryRouter } from "./routes/subtreasury.js";
import { dashboardsRouter } from "./routes/dashboards.js";
import { queryRouter } from "./routes/query.js";
import { statsRouter } from "./routes/stats.js";
import { syncRouter } from "./routes/sync.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure Users table exists on startup
ensureUsersTable();

// Middleware
app.use(
  cors({
    origin: true, // Allow all origins (configure specific origins in production)
    credentials: true, // Required for cookies
  })
);
app.use(express.json());

// Session middleware
app.use(
  session({
    store: createSessionStore(),
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    name: "connect.sid",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours default
    },
  })
);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
app.use("/api/auth", authRouter);
app.use("/api/referenda", referendaRouter);
app.use("/api/treasury", treasuryRouter);
app.use("/api/child-bounties", childBountiesRouter);
app.use("/api/fellowship", fellowshipRouter);
app.use("/api/fellowship-salary", salaryRouter);
app.use("/api/claims", claimsRouter);
app.use("/api/spending", spendingRouter);
app.use("/api/logs", logsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/bounties", bountiesRouter);
app.use("/api/subtreasury", subtreasuryRouter);
app.use("/api/dashboards", dashboardsRouter);
app.use("/api/query", queryRouter);
app.use("/api/stats", statsRouter);
app.use("/api/sync", syncRouter);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: err.message });
});

// Bind to 127.0.0.1 explicitly to avoid dual-stack issues on Windows
const server = app.listen(PORT as number, "127.0.0.1", () => {
  console.log(`API server running on http://127.0.0.1:${PORT}`);
});

// Set keep-alive timeout to help with connection reuse
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
