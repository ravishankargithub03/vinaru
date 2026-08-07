import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

const AVATAR_COLORS = ["#3b7cf6", "#ef4b4b", "#f2b807", "#2ecc71", "#a855f7", "#ec4899"];

interface UserRow {
  id: number;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarColor: string;
  dob: string | null;
  mobile: string | null;
  createdAt: number;
}

function publicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarColor: row.avatarColor,
    dob: row.dob,
    mobile: row.mobile,
    createdAt: row.createdAt,
  };
}

export function isEmailTaken(email: string) {
  return !!db.prepare("SELECT id FROM users WHERE email = ?").get(email);
}

export function register(email: string, password: string, displayName: string, dob: string, mobile: string) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return { error: "An account with this email already exists" as const };

  const passwordHash = bcrypt.hashSync(password, 10);
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const createdAt = Date.now();
  const result = db
    .prepare(
      "INSERT INTO users (email, passwordHash, displayName, avatarColor, dob, mobile, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(email, passwordHash, displayName, avatarColor, dob, mobile, createdAt);

  const user = publicUser({
    id: Number(result.lastInsertRowid),
    email,
    passwordHash,
    displayName,
    avatarColor,
    dob,
    mobile,
    createdAt,
  });
  return { user, ...issueTokens(user.id, user.email) };
}

export function login(email: string, password: string) {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  if (!row || !bcrypt.compareSync(password, row.passwordHash)) {
    return { error: "Invalid email or password" as const };
  }
  return { user: publicUser(row), ...issueTokens(row.id, row.email) };
}

export function getUserById(id: number) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? publicUser(row) : null;
}

export function issueTokens(userId: number, email: string) {
  const accessToken = jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ sub: userId, email, type: "refresh" }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
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
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
  const payload = verifyAccessToken(header.slice(7));
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  req.user = payload;
  next();
}
