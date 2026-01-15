/**
 * Authentication routes.
 *
 * Handles login, logout, and current user info.
 */

import { Router } from "express";
import { authenticateUser } from "../middleware/auth.js";

export const authRouter: Router = Router();

// Session durations
const SESSION_DEFAULT = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_REMEMBER = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * POST /api/auth/login
 * Authenticate user and create session.
 */
authRouter.post("/login", async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    if (!username || typeof username !== "string" || username.trim() === "") {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    if (!password || typeof password !== "string") {
      res.status(400).json({ error: "Password is required" });
      return;
    }

    const user = await authenticateUser(username.trim(), password);

    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    // Set session data
    req.session.userId = user.id;
    req.session.username = user.username;

    // Extend session if "remember me" is checked
    if (rememberMe) {
      req.session.cookie.maxAge = SESSION_REMEMBER;
    } else {
      req.session.cookie.maxAge = SESSION_DEFAULT;
    }

    // Explicitly save session before responding to ensure persistence
    req.session.save((err) => {
      if (err) {
        console.error("Failed to save session:", err);
        res.status(500).json({ error: "Failed to create session" });
        return;
      }
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
        },
      });
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/auth/logout
 * Destroy session and clear cookie.
 */
authRouter.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info.
 */
authRouter.get("/me", (req, res) => {
  if (req.session?.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
      },
    });
  } else {
    res.json({ authenticated: false });
  }
});
