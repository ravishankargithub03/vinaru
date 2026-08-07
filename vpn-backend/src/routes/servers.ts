import { Router } from "express";
import { db } from "../db.js";

export const serversRouter = Router();

interface ServerRow {
  id: string;
  country: string;
  city: string;
  hostname: string;
  publicIp: string;
  port: number;
  publicKey: string;
  protocols: string;
  isSimulated: number;
}

// Real server fleets report these via a monitoring agent; until we have one,
// values are synthesized per-request so the UI has something real-shaped to render.
function simulatedHealth(serverId: string) {
  const seed = serverId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const jitter = (Date.now() / 5000) % 10;
  return {
    status: "online" as const,
    cpuPercent: Math.round(10 + ((seed + jitter * 3) % 25)),
    memPercent: Math.round(20 + ((seed + jitter * 2) % 30)),
    activeUsers: Math.round((seed % 5) + jitter),
    availableBandwidthMbps: Math.round(500 - ((seed + jitter) % 100)),
    packetLossPercent: Math.round((jitter % 3) * 10) / 10,
    latencyMs: Math.round(8 + (seed % 20) + jitter),
  };
}

serversRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM servers").all() as ServerRow[];
  res.json(
    rows.map((row) => ({
      id: row.id,
      country: row.country,
      city: row.city,
      hostname: row.hostname,
      protocols: JSON.parse(row.protocols),
      isSimulated: Boolean(row.isSimulated),
      ...simulatedHealth(row.id),
    }))
  );
});

serversRouter.get("/:id/health", (req, res) => {
  const row = db.prepare("SELECT * FROM servers WHERE id = ?").get(req.params.id) as ServerRow | undefined;
  if (!row) return res.status(404).json({ error: "Server not found" });
  res.json({ id: row.id, isSimulated: Boolean(row.isSimulated), ...simulatedHealth(row.id) });
});

// Returns the peer info the client needs to build its own WireGuard config.
// On a real deployment, this would also register the client's public key as
// an allowed peer on the target server (e.g. via `wg set` over an admin API
// or SSH). We don't have a live WireGuard interface to register against yet,
// so that step is a documented no-op for isSimulated servers.
serversRouter.post("/:id/config", (req, res) => {
  const row = db.prepare("SELECT * FROM servers WHERE id = ?").get(req.params.id) as ServerRow | undefined;
  if (!row) return res.status(404).json({ error: "Server not found" });

  const { clientPublicKey } = req.body as { clientPublicKey?: string };
  if (!clientPublicKey) return res.status(400).json({ error: "clientPublicKey is required" });

  if (!row.isSimulated) {
    // TODO: register clientPublicKey as a peer on the real server (wg set / management API).
  }

  res.json({
    isSimulated: Boolean(row.isSimulated),
    serverPublicKey: row.publicKey,
    endpoint: `${row.hostname}:${row.port}`,
    allowedIPs: ["0.0.0.0/0", "::/0"],
    dns: ["1.1.1.1", "1.0.0.1"],
    clientAddress: "10.66.0.2/32",
    persistentKeepalive: 25,
  });
});
