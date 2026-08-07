import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

export function seedDevUser() {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get("dev@vinaru.local");
  if (!existing) {
    const passwordHash = bcrypt.hashSync("dev-password", 10);
    db.prepare("INSERT INTO users (email, passwordHash, createdAt) VALUES (?, ?, ?)").run(
      "dev@vinaru.local",
      passwordHash,
      Date.now()
    );
    console.log("Seeded dev user: dev@vinaru.local / dev-password");
  }
}

export function login(email: string, password: string) {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | { id: number; email: string; passwordHash: string }
    | undefined;
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return null;
  }
  return issueTokens(user.id, user.email);
}

export function issueTokens(userId: number, email: string) {
  const accessToken = jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ sub: userId, email, type: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
  return { accessToken, refreshToken };
}

export function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as { sub: number; email: string; type?: string };
    if (payload.type !== "refresh") return null;
    return issueTokens(payload.sub, payload.email);
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: number; email: string };
  } catch {
    return null;
  }
}

export function requireAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const payload = verifyAccessToken(header.slice(7));
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  req.user = payload;
  next();
}
