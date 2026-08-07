import { db } from "./db.js";

const existing = db.prepare("SELECT COUNT(*) as count FROM servers").get() as { count: number };

if (existing.count === 0) {
  db.prepare(
    `INSERT INTO servers (id, country, city, hostname, publicIp, port, publicKey, protocols, isSimulated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "local-dev-1",
    "Local",
    "Dev Machine",
    "127.0.0.1",
    "127.0.0.1",
    51820,
    "SAA+gW6cLUzWSiglS7VBB2kzkaXCvVm2UQqJ6KJl+DM=",
    JSON.stringify(["wireguard"]),
    1
  );
  console.log("Seeded local-dev-1 server entry.");
}
