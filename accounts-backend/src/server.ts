import express from "express";
import "./db.js";
import { authRouter } from "./routes/auth.js";

const app = express();

// Mobile WebView / Capacitor needs CORS; Electron main process does not.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);

const PORT = Number(process.env.PORT || 4200);
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Vinaru accounts backend listening on http://${HOST}:${PORT}`);
});
