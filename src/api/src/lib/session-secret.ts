import crypto from "crypto";
import fs from "fs";
import path from "path";

const SECRET_FILENAME = ".session-secret";

/**
 * Get or generate the session secret.
 * Priority: ENV var > persisted file > generate new
 */
export function getSessionSecret(dataDir: string): string {
  // 1. Check environment variable (allows override)
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  const secretPath = path.join(dataDir, SECRET_FILENAME);

  // 2. Try to read from persisted file
  if (fs.existsSync(secretPath)) {
    const secret = fs.readFileSync(secretPath, "utf-8").trim();
    if (secret.length >= 32) {
      console.log("Using persisted session secret from", secretPath);
      return secret;
    }
  }

  // 3. Generate new secret and persist
  const secret = crypto.randomBytes(32).toString("base64");

  // Ensure directory exists
  fs.mkdirSync(dataDir, { recursive: true });

  // Write with restrictive permissions (owner read/write only)
  fs.writeFileSync(secretPath, secret, { mode: 0o600 });
  console.log("Generated new session secret, persisted to", secretPath);

  return secret;
}
