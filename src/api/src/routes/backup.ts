import { Router } from "express";
import { getDatabase, getLastWriteTimestamp, DB_PATH } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { existsSync, statSync, createReadStream } from "fs";

export const backupRouter: Router = Router();

// GET /api/backup/download - Download checkpointed database
backupRouter.get("/download", requireAuth, (req, res) => {
  try {
    // Use DB_PATH from db/index.ts (supports both local and production paths)
    if (!existsSync(DB_PATH)) {
      res.status(404).json({ error: "Database not found" });
      return;
    }

    // Try to checkpoint before download (use PASSIVE mode to avoid blocking)
    try {
      const db = getDatabase();
      // Use PASSIVE mode instead of TRUNCATE - it doesn't block and is more compatible with Windows
      const result = db.pragma("wal_checkpoint(PASSIVE)");
      console.log("WAL checkpoint result:", result);
    } catch (checkpointError) {
      // Log warning but don't fail - backup will still contain most recent data
      console.warn("WAL checkpoint failed (backup will still proceed):", checkpointError);
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `opengov-backup-${timestamp}.db`;

    // Set response headers
    const stats = statSync(DB_PATH);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    // Stream file
    const stream = createReadStream(DB_PATH);
    stream.pipe(res);

    stream.on("error", (error) => {
      console.error("Backup download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream backup" });
      }
    });
  } catch (error) {
    console.error("Backup error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/backup/info - Get database info (size, last write)
backupRouter.get("/info", requireAuth, (req, res) => {
  try {
    // Use DB_PATH from db/index.ts
    if (!existsSync(DB_PATH)) {
      res.status(404).json({ error: "Database not found" });
      return;
    }

    const stats = statSync(DB_PATH);
    const lastWrite = getLastWriteTimestamp();

    res.json({
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      modified: stats.mtime,
      lastWrite: lastWrite ? new Date(lastWrite).toISOString() : null,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
