import { Router } from "express";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export const syncRouter: Router = Router();

// Get the data directory path - exported for testing
export function getDataPath(): string {
  // In production (Docker), CWD is /app/api, so go up one level to /app
  // In development, use relative path from compiled location
  if (process.env.NODE_ENV === "production") {
    return join(process.cwd(), "..", "data", "defaults");
  }
  // In ES modules, we need to compute __dirname
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Go up from api/dist/routes to api/, then to root, then to data/
  return join(__dirname, "..", "..", "..", "data", "defaults");
}

// GET /api/sync/defaults/referenda - Read default referenda CSV
syncRouter.get("/defaults/referenda", (_req, res) => {
  try {
    const filePath = join(getDataPath(), "referenda-categories.csv");
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "Default file not found" });
    }
    const content = readFileSync(filePath, "utf-8");
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/sync/defaults/child-bounties - Read default child bounties CSV
syncRouter.get("/defaults/child-bounties", (_req, res) => {
  try {
    const filePath = join(getDataPath(), "child-bounties-categories.csv");
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "Default file not found" });
    }
    const content = readFileSync(filePath, "utf-8");
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/sync/defaults/treasury-netflows - Read default treasury netflows CSV
syncRouter.get("/defaults/treasury-netflows", (_req, res) => {
  try {
    const filePath = join(getDataPath(), "polkadot_treasury_netflows_2025_Q4.csv");
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "Default file not found" });
    }
    const content = readFileSync(filePath, "utf-8");
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
