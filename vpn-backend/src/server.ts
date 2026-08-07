import express from "express";
import { createServer } from "http";
import "./db.js";
import "./seed.js";
import { seedDevUser } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { serversRouter } from "./routes/servers.js";
import { attachWebSocketServer } from "./ws.js";

seedDevUser();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/servers", serversRouter);

const PORT = process.env.PORT || 4100;
const httpServer = createServer(app);
attachWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Vinaru VPN backend listening on http://localhost:${PORT}`);
});
