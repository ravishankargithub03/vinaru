import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const db = new Database(path.join(__dirname, "..", "vpn.sqlite"));

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    name TEXT NOT NULL,
    publicKey TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    hostname TEXT NOT NULL,
    publicIp TEXT NOT NULL,
    port INTEGER NOT NULL,
    publicKey TEXT NOT NULL,
    protocols TEXT NOT NULL,
    isSimulated INTEGER NOT NULL DEFAULT 0
  );
`);
