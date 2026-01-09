/**
 * Sync Route Tests
 *
 * Tests for the /api/sync/defaults/* endpoints that serve default CSV files.
 * These tests verify that path resolution works correctly in both development
 * and production (Docker) environments.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

// Store original env
const originalEnv = process.env.NODE_ENV;

// Normalize path for cross-platform comparison
function normalizePath(p: string): string {
  return p.replace(/[\\/]/g, "/");
}

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "fs";
import { syncRouter, getDataPath } from "../sync.js";

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api/sync", syncRouter);
  return app;
}

describe("getDataPath", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("returns path relative to cwd in production", () => {
    process.env.NODE_ENV = "production";

    // Mock cwd to simulate Docker environment
    const originalCwd = process.cwd;
    process.cwd = () => "/app/api";

    try {
      const path = getDataPath();
      // path.join normalizes the path, so /app/api/../data/defaults becomes /app/data/defaults
      // Use normalizePath for cross-platform testing (Windows uses backslashes)
      expect(normalizePath(path)).toBe("/app/data/defaults");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("returns path relative to module location in development", () => {
    process.env.NODE_ENV = "development";
    const path = getDataPath();

    // In development, should resolve to data/defaults from repo root
    expect(path).toContain("data");
    expect(path).toContain("defaults");
  });

  it("handles undefined NODE_ENV as development", () => {
    delete process.env.NODE_ENV;
    const path = getDataPath();

    // Should use the development path (relative to module)
    expect(path).toContain("data");
    expect(path).toContain("defaults");
  });
});

describe("GET /api/sync/defaults/referenda", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  it("returns CSV content when file exists", async () => {
    const mockCsv = "id,category,subcategory\n1,Development,Core";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockCsv);

    const response = await request(app).get("/api/sync/defaults/referenda");

    expect(response.status).toBe(200);
    expect(response.body.content).toBe(mockCsv);
    expect(existsSync).toHaveBeenCalledWith(
      expect.stringContaining("referenda-categories.csv")
    );
  });

  it("returns 404 when file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const response = await request(app).get("/api/sync/defaults/referenda");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Default file not found");
  });

  it("returns 500 on read error", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("Permission denied");
    });

    const response = await request(app).get("/api/sync/defaults/referenda");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Permission denied");
  });
});

describe("GET /api/sync/defaults/child-bounties", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  it("returns CSV content when file exists", async () => {
    const mockCsv = "id,category,subcategory\n1,Bounty,Sub";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockCsv);

    const response = await request(app).get("/api/sync/defaults/child-bounties");

    expect(response.status).toBe(200);
    expect(response.body.content).toBe(mockCsv);
    expect(existsSync).toHaveBeenCalledWith(
      expect.stringContaining("child-bounties-categories.csv")
    );
  });

  it("returns 404 when file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const response = await request(app).get("/api/sync/defaults/child-bounties");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Default file not found");
  });

  it("returns 500 on read error", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("File corrupted");
    });

    const response = await request(app).get("/api/sync/defaults/child-bounties");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("File corrupted");
  });
});

describe("Path resolution for Docker environment", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("production path resolves correctly from /app/api to /app/data/defaults", () => {
    process.env.NODE_ENV = "production";

    // Simulate Docker environment where cwd is /app/api
    const originalCwd = process.cwd;
    process.cwd = () => "/app/api";

    try {
      const path = getDataPath();
      // path.join normalizes: /app/api + .. + data/defaults = /app/data/defaults
      expect(normalizePath(path)).toBe("/app/data/defaults");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("would fail if production path did not go up one level", () => {
    // This test documents the bug we fixed: if we used process.cwd() directly
    // without going up one level, we'd get /app/api/data/defaults which is wrong
    process.env.NODE_ENV = "production";

    const originalCwd = process.cwd;
    process.cwd = () => "/app/api";

    try {
      const path = getDataPath();
      const normalized = normalizePath(path);
      // The path should NOT be /app/api/data/defaults
      expect(normalized).not.toBe("/app/api/data/defaults");
      // It should be /app/data/defaults
      expect(normalized).toBe("/app/data/defaults");
    } finally {
      process.cwd = originalCwd;
    }
  });
});
