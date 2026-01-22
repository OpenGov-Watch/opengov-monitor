import express from "express";
import cors from "cors";
import session from "express-session";
import detectPort from "detect-port";
import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { createSessionStore, closeSessionStore } from "./db/session-store.js";
import { ensureUsersTable } from "./db/auth-queries.js";
import { generalLimiter, writeLimiter, authLimiter } from "./middleware/rate-limit.js";
import { getDatabase, closeDatabase, stopPeriodicCheckpoint } from "./db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import route handlers
import { authRouter } from "./routes/auth.js";
import { referendaRouter } from "./routes/referenda.js";
import { treasuryRouter } from "./routes/treasury.js";
import { childBountiesRouter } from "./routes/child-bounties.js";
import { fellowshipRouter } from "./routes/fellowship.js";
import { salaryRouter } from "./routes/salary.js";
import { claimsRouter } from "./routes/claims.js";
import { spendingRouter } from "./routes/spending.js";
import { categoriesRouter } from "./routes/categories.js";
import { bountiesRouter } from "./routes/bounties.js";
import { subtreasuryRouter } from "./routes/subtreasury.js";
import { customSpendingRouter } from "./routes/custom-spending.js";
import { treasuryNetflowsRouter } from "./routes/treasury-netflows.js";
import { crossChainFlowsRouter } from "./routes/cross-chain-flows.js";
import { localFlowsRouter } from "./routes/local-flows.js";
import { dashboardsRouter } from "./routes/dashboards.js";
import { queryRouter } from "./routes/query.js";
import { statsRouter } from "./routes/stats.js";
import { syncRouter } from "./routes/sync.js";
import dataErrorsRouter from "./routes/data-errors.js";
import { backupRouter } from "./routes/backup.js";

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT || "3001", 10);
const PORT_FILE = path.join(__dirname, "../../../data/.api-port");

// Ensure Users table exists on startup
ensureUsersTable();

// Trust proxy for secure cookies behind nginx/reverse proxy
app.set("trust proxy", 1);

// CORS configuration
// In production, nginx proxies make requests same-origin from browser perspective
// For development and cross-origin deployments, we whitelist allowed origins
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      // In production, only allow whitelisted origins (if configured)
      if (ALLOWED_ORIGINS) {
        if (ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`CORS blocked request from origin: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      } else {
        // If no whitelist configured, allow all (development mode behavior)
        callback(null, true);
      }
    },
    credentials: true, // Required for cookies
  })
);
app.use(express.json({ limit: '10mb' }));

// Session middleware
// Cross-origin auth: Set CROSS_ORIGIN_AUTH=true to enable sameSite: "none" for cross-origin cookies
const crossOriginAuth = process.env.CROSS_ORIGIN_AUTH === "true";

// Validate SESSION_SECRET in production
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && !sessionSecret) {
  console.error("FATAL: SESSION_SECRET environment variable is required in production mode");
  process.exit(1);
}

app.use(
  session({
    store: createSessionStore(),
    secret: sessionSecret || "dev-secret-change-in-production",
    name: "connect.sid",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Cross-origin cookies require secure: true even in dev
      secure: process.env.NODE_ENV === "production" || crossOriginAuth,
      // Use sameSite: "none" for cross-origin auth, "lax" for same-origin
      sameSite: crossOriginAuth ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours default
    },
  })
);

// Rate limiting
app.use("/api", generalLimiter);

// Apply stricter rate limit for write operations (except auth and query/execute which are reads)
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
      && !req.path.startsWith("/auth")
      && !req.path.startsWith("/query/execute")) {  // Exclude read-only query endpoint
    return writeLimiter(req, res, next);
  }
  next();
});

// Health check with migration info
app.get("/api/health", (_req, res) => {
  try {
    const db = getDatabase();
    const migration = db.prepare(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1'
    ).get() as { version: number; name: string; applied_at: string } | undefined;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: migration ? {
        version: migration.version,
        name: migration.name,
        applied: migration.applied_at
      } : null
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

// Mount routes with auth-specific rate limiting
app.use("/api/auth/login", authLimiter);
app.use("/api/auth", authRouter);
app.use("/api/referenda", referendaRouter);
app.use("/api/treasury", treasuryRouter);
app.use("/api/child-bounties", childBountiesRouter);
app.use("/api/fellowship", fellowshipRouter);
app.use("/api/fellowship-salary", salaryRouter);
app.use("/api/claims", claimsRouter);
app.use("/api/spending", spendingRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/bounties", bountiesRouter);
app.use("/api/subtreasury", subtreasuryRouter);
app.use("/api/custom-spending", customSpendingRouter);
app.use("/api/treasury-netflows", treasuryNetflowsRouter);
app.use("/api/cross-chain-flows", crossChainFlowsRouter);
app.use("/api/local-flows", localFlowsRouter);
app.use("/api/dashboards", dashboardsRouter);
app.use("/api/query", queryRouter);
app.use("/api/stats", statsRouter);
app.use("/api/sync", syncRouter);
app.use("/api/data-errors", dataErrorsRouter);
app.use("/api/backup", backupRouter);

// Helper to sanitize request body for logging
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== "object") return body;

  const sensitiveFields = ["password", "token", "secret", "apiKey", "api_key", "accessToken", "refreshToken"];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Always log full error details to server console
  console.error("Error:", err.message);
  console.error("Stack:", err.stack);
  console.error("Request:", {
    method: req.method,
    url: req.url,
    body: sanitizeRequestBody(req.body),
    query: req.query,
  });

  // In production, return generic error message to avoid leaking implementation details
  // In development, return the actual error message for debugging
  const clientMessage = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message;
  res.status(500).json({ error: clientMessage });
});

let server: http.Server;

// Cleanup port file
function cleanup(): void {
  try {
    if (fs.existsSync(PORT_FILE)) {
      fs.unlinkSync(PORT_FILE);
    }
  } catch {
    // Ignore cleanup errors
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("Shutdown timeout reached, forcing exit");
    process.exit(1);
  }, 2000);

  try {
    // Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log("HTTP server closed");

    // Stop periodic checkpoint interval
    stopPeriodicCheckpoint();

    // Checkpoint and close databases
    try {
      const db = getDatabase();
      db.pragma("wal_checkpoint(TRUNCATE)");
      console.log("Main database checkpointed");
    } catch (err) {
      console.warn("Failed to checkpoint main database:", err);
    }

    closeDatabase();
    console.log("Main database connections closed");

    closeSessionStore();
    console.log("Session store closed");

    cleanup();

    clearTimeout(shutdownTimeout);
    console.log("Graceful shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("Error during graceful shutdown:", err);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Start server with dynamic port detection
async function startServer() {
  const port = await detectPort(DEFAULT_PORT);

  // Bind to 127.0.0.1 explicitly to avoid dual-stack issues on Windows
  server = app.listen(port, "127.0.0.1", () => {
    console.log(`API server running on http://127.0.0.1:${port}`);

    // Write port to file for frontend to read
    try {
      fs.mkdirSync(path.dirname(PORT_FILE), { recursive: true });
      fs.writeFileSync(PORT_FILE, String(port));
    } catch (err) {
      console.error("Failed to write port file:", err);
    }
  });

  // Set keep-alive timeout to help with connection reuse
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Graceful shutdown on signals
  process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
}

startServer();
