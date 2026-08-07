import express from "express";
import "./db.js";
import { authRouter } from "./routes/auth.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);

const PORT = process.env.PORT || 4200;
app.listen(PORT, () => {
  console.log(`Vinaru accounts backend listening on http://localhost:${PORT}`);
});
