import { WebSocketServer } from "ws";
import type { Server } from "http";
import { db } from "./db.js";
import { verifyAccessToken } from "./auth.js";

interface ServerRow {
  id: string;
  country: string;
  city: string;
  isSimulated: number;
}

function simulatedHealth(serverId: string) {
  const seed = serverId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const jitter = (Date.now() / 5000) % 10;
  return {
    cpuPercent: Math.round(10 + ((seed + jitter * 3) % 25)),
    memPercent: Math.round(20 + ((seed + jitter * 2) % 30)),
    activeUsers: Math.round((seed % 5) + jitter),
    availableBandwidthMbps: Math.round(500 - ((seed + jitter) % 100)),
    packetLossPercent: Math.round((jitter % 3) * 10) / 10,
    latencyMs: Math.round(8 + (seed % 20) + jitter),
  };
}

export function attachWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const token = url.searchParams.get("token") || "";
    if (!verifyAccessToken(token)) {
      ws.close(4001, "Unauthorized");
      return;
    }

    const interval = setInterval(() => {
      const rows = db.prepare("SELECT id, country, city, isSimulated FROM servers").all() as ServerRow[];
      const payload = {
        type: "server-health-update",
        servers: rows.map((row) => ({
          id: row.id,
          isSimulated: Boolean(row.isSimulated),
          ...simulatedHealth(row.id),
        })),
      };
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    }, 2000);

    ws.on("close", () => clearInterval(interval));
  });

  return wss;
}
