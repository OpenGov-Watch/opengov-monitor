import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

function getApiPort(): number {
  const portFile = path.resolve(__dirname, "../data/.api-port");
  try {
    const port = parseInt(fs.readFileSync(portFile, "utf-8").trim(), 10);
    if (!isNaN(port)) {
      return port;
    }
  } catch {
    // Port file doesn't exist yet, use default
  }
  return 3001;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Allow fallback to next available port
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${getApiPort()}`,
        changeOrigin: true,
        // Handle proxy errors gracefully
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error:", err.message);
            if (res && "writeHead" in res && !res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "API server unavailable" }));
            }
          });
        },
      },
    },
  },
});
