// `npm run relay`: lets "Generate" on the live site use Claude Code on this Mac.
//   1. Starts the relay (server/relay.js) on 127.0.0.1:8788.
//   2. Opens a Cloudflare quick tunnel to it (no Cloudflare account needed; the address changes
//      every time, which is why step 3 exists).
//   3. Tells the live site the tunnel's address (POST /api/agent/relay-register, signed with the
//      shared secret), and again every 4 minutes so the site knows the Mac is still online.
// Stop it with Ctrl+C; the live site falls back to the manual steps within a few minutes.
//
// Needs in .env.local: AGENT_RELAY_SECRET (the same value as on Vercel). Optional: AGENT_RELAY_SITE
// (default https://tepobaby.vercel.app), CLOUDFLARED_BIN.

import { spawn } from "node:child_process";
import { RELAY_PORT, startRelay } from "../server/relay.js";

const secret = process.env.AGENT_RELAY_SECRET;
const site = (process.env.AGENT_RELAY_SITE || "https://tepobaby.vercel.app").replace(/\/$/, "");
const bin = process.env.CLOUDFLARED_BIN || "cloudflared";

startRelay(secret);
console.log(`[relay] listening on 127.0.0.1:${RELAY_PORT}; opening a Cloudflare tunnel…`);

let tunnelUrl = null;

async function register() {
  if (!tunnelUrl) return;
  try {
    const res = await fetch(`${site}/api/agent/relay-register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Relay-Secret": secret },
      body: JSON.stringify({ url: tunnelUrl }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
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
    // Give Cloudflare a moment to route the new address, then register it.
    setTimeout(async () => {
      await register();
      console.log(`[relay] live: Generate on ${site} now runs on this Mac (Ctrl+C to stop)`);
    }, 5000);
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
