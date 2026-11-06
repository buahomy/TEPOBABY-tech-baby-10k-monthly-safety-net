// `npm run relay`: lets Ginny's Claude Code chat on the live site reach Claude Code on this Mac.
//   1. Starts the relay (server/claudeRelay.js) on 127.0.0.1:8788.
//   2. Keeps the Mac awake while it runs (caffeinate).
//   3. Opens a Cloudflare quick tunnel to it (no Cloudflare account; the address changes every time).
//   4. Tells the live site the address (POST /api/claude/relay-register, with the shared secret), and
//      again every 4 minutes so the site knows the Mac is still online.
// Stop it with Ctrl+C; the chat shows "offline".
//
// Needs in .env.local: CLAUDE_RELAY_SECRET (the same value as on Vercel). Optional:
// CLAUDE_RELAY_SITE (default https://tepobaby.vercel.app), CLOUDFLARED_BIN.

import { spawn } from "node:child_process";
import { RELAY_PORT, startRelay } from "../server/claudeRelay.js";

const secret = process.env.CLAUDE_RELAY_SECRET;
const site = (process.env.CLAUDE_RELAY_SITE || "https://tepobaby.vercel.app").replace(/\/$/, "");
const bin = process.env.CLOUDFLARED_BIN || "cloudflared";

startRelay(secret);
console.log(`[relay] listening on 127.0.0.1:${RELAY_PORT}; opening a Cloudflare tunnel…`);
spawn("caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" }).on("error", () => {});

let tunnelUrl = null;

async function register() {
  if (!tunnelUrl) return;
  try {
    const res = await fetch(`${site}/api/claude/relay-register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Relay-Secret": secret },
      body: JSON.stringify({ url: tunnelUrl }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    console.log("[relay] live site knows this Mac is online");
  } catch (err) {
    console.warn("[relay] couldn't reach the live site:", err.message);
  }
}

const tunnel = spawn(bin, ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${RELAY_PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
const watch = (chunk) => {
  const m = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && m[0] !== tunnelUrl) {
    tunnelUrl = m[0];
    console.log(`[relay] tunnel ready: ${tunnelUrl}`);
    setTimeout(register, 5000); // give Cloudflare a moment to route the new address
  }
};
tunnel.stdout.on("data", watch);
tunnel.stderr.on("data", watch);
tunnel.on("exit", (code) => {
  console.error(`[relay] tunnel stopped (${code}).`);
  process.exit(1);
});

setInterval(register, 4 * 60 * 1000);
process.on("SIGINT", () => {
  tunnel.kill();
  process.exit(0);
});
