#!/usr/bin/env node

/**
 * Development orchestration script
 *
 * Starts API server first (with dynamic port detection), waits for it to write
 * its port file, then starts the frontend with the correct proxy configuration.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT_FILE = path.join(__dirname, "../../data/.api-port");
const POLL_INTERVAL = 100; // ms
const TIMEOUT = 30000; // 30 seconds max wait

// ANSI color codes
const BLUE = "\x1b[34m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function log(prefix, color, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${prefix}]${RESET} ${message}`);
}

function cleanup() {
  try {
    if (fs.existsSync(PORT_FILE)) {
      fs.unlinkSync(PORT_FILE);
    }
  } catch {
    // Ignore cleanup errors
  }
}

async function waitForPortFile(timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const port = parseInt(fs.readFileSync(PORT_FILE, "utf-8").trim(), 10);
      if (!isNaN(port)) {
        return port;
      }
    } catch {
      // File doesn't exist yet
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
  throw new Error(`Timeout waiting for API server to start (${timeout}ms)`);
}

async function main() {
  // Clean up old port file
  cleanup();

  const processes = [];

  // Handle exit signals
  const handleExit = async () => {
    log("dev", BOLD, "Shutting down...");

    // Send SIGTERM to all processes
    processes.forEach((p) => {
      try {
        p.kill("SIGTERM");
      } catch {
        // Process may have already exited
      }
    });

    // Wait 2 seconds for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Force kill any remaining processes
    processes.forEach((p) => {
      try {
        if (!p.killed) {
          p.kill("SIGKILL");
        }
      } catch {
        // Process already exited
      }
    });

    cleanup();
    process.exit(0);
  };

  process.on("SIGINT", () => void handleExit());
  process.on("SIGTERM", () => void handleExit());

  // Start API server
  log("api", BLUE, "Starting API server...");
  const apiProcess = spawn("pnpm", ["api:dev"], {
    cwd: path.join(__dirname, "../.."),
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  processes.push(apiProcess);

  apiProcess.stdout.on("data", (data) => {
    data
      .toString()
      .trim()
      .split("\n")
      .forEach((line) => {
        if (line) log("api", BLUE, line);
      });
  });

  apiProcess.stderr.on("data", (data) => {
    data
      .toString()
      .trim()
      .split("\n")
      .forEach((line) => {
        if (line) log("api", BLUE, line);
      });
  });

  apiProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      log("api", BLUE, `Process exited with code ${code}`);
      handleExit();
    }
  });

  // Wait for port file
  try {
    const port = await waitForPortFile(TIMEOUT);
    log("dev", BOLD, `API server ready on port ${port}`);
  } catch (err) {
    log("dev", BOLD, `Error: ${err.message}`);
    handleExit();
    return;
  }

  // Start frontend
  log("frontend", GREEN, "Starting frontend...");
  const frontendProcess = spawn("pnpm", ["frontend:dev"], {
    cwd: path.join(__dirname, "../.."),
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  processes.push(frontendProcess);

  frontendProcess.stdout.on("data", (data) => {
    data
      .toString()
      .trim()
      .split("\n")
      .forEach((line) => {
        if (line) log("frontend", GREEN, line);
      });
  });

  frontendProcess.stderr.on("data", (data) => {
    data
      .toString()
      .trim()
      .split("\n")
      .forEach((line) => {
        if (line) log("frontend", GREEN, line);
      });
  });

  frontendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      log("frontend", GREEN, `Process exited with code ${code}`);
      handleExit();
    }
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
