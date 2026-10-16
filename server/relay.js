// AI Agent relay: lets the live site's "Generate" use Claude Code on the author's Mac.
//
//   live site (Vercel) ──HTTPS──► Cloudflare quick tunnel ──► this relay (127.0.0.1:8788) ──► claude -p
//
// It's a separate tiny server, so the tunnel exposes nothing else on the Mac: one route,
// POST /generate, which needs the shared AGENT_RELAY_SECRET and runs Claude Code with no tools.
// Started by `npm run relay` (scripts/relay.mjs), which also opens the tunnel and tells the live site
// where to reach it. The live site only forwards requests from the emails in AGENT_RELAY_EMAILS.

import crypto from "node:crypto";
import http from "node:http";
import { engine, generateRound } from "./agent/engine.js";

export const RELAY_PORT = Number(process.env.AGENT_RELAY_PORT) || 8788;
const MAX_BODY = 512 * 1024;

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function startRelay(secret) {
  if (!secret || secret.length < 32) throw new Error("AGENT_RELAY_SECRET must be at least 32 characters.");
  if (!engine()) throw new Error("Claude Code isn't available on this computer (is `claude` installed and signed in?).");

  const server = http.createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
    if (req.method !== "POST" || req.url !== "/generate") return send(404, { error: "Not found" });
    if (!safeEqual(req.headers["x-relay-secret"] || "", secret)) return send(401, { error: "Unauthorized" });

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on("end", async () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        return send(400, { error: "Bad request" });
      }
      const started = Date.now();
      try {
        const out = await generateRound(input);
        console.log(`[relay] ${input.company || "?"} round ${input.round || 1}: ${((Date.now() - started) / 1000).toFixed(0)}s`);
        send(200, out);
      } catch (err) {
        console.error("[relay] generate failed:", err.message);
        send(err.status || 502, { error: err.message || "Generate failed" });
      }
    });
  });
  server.listen(RELAY_PORT, "127.0.0.1");
  return server;
}
