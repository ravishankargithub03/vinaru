#!/usr/bin/env node
// Single entry point for the whole Vinaru project: starts both backend
// services and the desktop app together, so you don't need three separate
// terminals. Run with: node start.js

const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const ROOT = __dirname;
const IS_WINDOWS = process.platform === "win32";

const SERVICES = [
  { name: "vpn-backend", cwd: path.join(ROOT, "vpn-backend"), cmd: "npm", args: ["run", "start"], color: 36, healthUrl: "http://localhost:4100/health" },
  { name: "accounts", cwd: path.join(ROOT, "accounts-backend"), cmd: "npm", args: ["run", "start"], color: 35, healthUrl: "http://localhost:4200/health" },
  { name: "app", cwd: path.join(ROOT, "app"), cmd: "npm", args: ["run", "start"], color: 32 },
];

const children = [];
let shuttingDown = false;

function log(name, color, line) {
  console.log(`\x1b[${color}m[${name}]\x1b[0m ${line}`);
}

function pipeOutput(name, color, stream, isError) {
  stream.on("data", (data) => {
    const text = data.toString();
    for (const line of text.split("\n")) {
      if (line.trim()) (isError ? console.error : console.log)(`\x1b[${color}m[${name}]\x1b[0m ${line}`);
    }
  });
}

function checkHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(name, url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHealth(url)) {
      log(name, 90, "ready");
      return true;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  log(name, 33, `did not report healthy within ${timeoutMs / 1000}s — continuing anyway`);
  return false;
}

function startService(service) {
  const child = spawn(service.cmd, service.args, {
    cwd: service.cwd,
    shell: IS_WINDOWS,
    env: process.env,
  });
  children.push(child);
  pipeOutput(service.name, service.color, child.stdout, false);
  pipeOutput(service.name, service.color, child.stderr, true);
  child.on("exit", (code) => {
    log(service.name, service.color, `exited (code ${code})`);
    if (!shuttingDown) shutdown();
  });
  return child;
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nShutting down all Vinaru services...");
  for (const child of children) {
    if (!child.killed) {
      IS_WINDOWS ? spawn("taskkill", ["/pid", child.pid, "/f", "/t"]) : child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  console.log("Starting Vinaru — VPN backend, accounts backend, and the desktop app...\n");

  const backends = SERVICES.filter((s) => s.healthUrl);
  backends.forEach(startService);

  await Promise.all(backends.map((s) => waitForHealth(s.name, s.healthUrl)));

  const appService = SERVICES.find((s) => s.name === "app");
  startService(appService);
}

main();
