import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const db = new Database(path.join(__dirname, "..", "accounts.sqlite"));

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    displayName TEXT NOT NULL,
    avatarColor TEXT NOT NULL,
    dob TEXT,
    mobile TEXT,
    createdAt INTEGER NOT NULL
  );
`);

const userColumns = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
if (!userColumns.includes("dob")) db.exec("ALTER TABLE users ADD COLUMN dob TEXT");
if (!userColumns.includes("mobile")) db.exec("ALTER TABLE users ADD COLUMN mobile TEXT");
