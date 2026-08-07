import { Router } from "express";
import { login, refreshAccessToken } from "../auth.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const tokens = login(email, password);
  if (!tokens) return res.status(401).json({ error: "Invalid credentials" });
  res.json(tokens);
});

authRouter.post("/refresh", (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

  const tokens = refreshAccessToken(refreshToken);
  if (!tokens) return res.status(401).json({ error: "Invalid or expired refresh token" });
  res.json(tokens);
});
