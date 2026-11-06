// Ginny's Claude Code chat (mounted from server/index.js). Only the signed-in emails in
// CLAUDE_CHAT_EMAILS can use it; the check runs on every request, not just in the app's menu.
//
//   GET  /api/claude/status          { allowed, online } for this account
//   POST /api/claude/job             a saved job's description as plain text
//   POST /api/claude/chat            one message; streams the reply (newline-delimited JSON)
//   GET  /api/claude/file?name=      a PDF from the Mac's Desktop, to open on the phone
//   POST /api/claude/relay-register  the Mac reports its tunnel address (needs CLAUDE_RELAY_SECRET)
//
// Claude Code runs on the author's Mac (server/claudeRelay.js). Locally the relay is at 127.0.0.1;
// on Vercel it's reached through the Cloudflare tunnel address the Mac registers.

import crypto from "node:crypto";
import { Readable } from "node:stream";
import express from "express";
import { fetchJobDescription } from "./ginny/jobDescription.js";
import * as store from "./store.js";

const RELAY_FRESH_MS = 10 * 60 * 1000; // the Mac re-registers every 4 minutes
const PORT = Number(process.env.CLAUDE_RELAY_PORT) || 8788;
const MAX_JOB_TEXT = 20000;
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

const emails = () =>
  (process.env.CLAUDE_CHAT_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
const mayUse = (session) => !!process.env.CLAUDE_RELAY_SECRET && !!session?.email && emails().includes(String(session.email).toLowerCase());

const secretOk = (given) => {
  const secret = process.env.CLAUDE_RELAY_SECRET || "";
  if (!secret) return false;
  const hash = (v) => crypto.createHash("sha256").update(String(v)).digest();
  return crypto.timingSafeEqual(hash(given || ""), hash(secret));
};

async function relayUrl() {
  if (!process.env.VERCEL) return `http://127.0.0.1:${PORT}`;
  const r = await store.get("meta", "claude-relay");
  return r?.url && Date.now() - r.at < RELAY_FRESH_MS ? r.url : null;
}

const relayHeaders = () => ({ "Content-Type": "application/json", "X-Relay-Secret": process.env.CLAUDE_RELAY_SECRET });

async function online() {
  const url = await relayUrl();
  if (!url) return false;
  try {
    const res = await fetch(`${url}/health`, { headers: relayHeaders(), signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** The job, as data: a posting can't close the tag and pretend to be the student. */
function withJob(message, job) {
  const text = str(job?.text, MAX_JOB_TEXT).replace(/<\/?job_posting[^>]*>/gi, " ");
  if (!text.trim()) return message;
  const attr = (v) => str(v, 200).replace(/["<>\n]/g, " ");
  return `<job_posting company="${attr(job.company)}" title="${attr(job.title)}" url="${attr(job.url)}">\n${text}\n</job_posting>\n\n${message}`;
}

export function claudeChatRoutes(app, { readSession, requireXhr, requireUser }) {
  // Everyone else gets the same 404 as a route that doesn't exist.
  const requireOwner = (req, res, next) => (mayUse(readSession(req)) ? next() : res.status(404).json({ error: "Not found" }));

  app.get("/api/claude/status", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    const allowed = mayUse(readSession(req));
    res.json({ allowed, online: allowed ? await online() : false });
  });

  app.post("/api/claude/job", requireXhr, requireUser, requireOwner, express.json({ limit: "8kb" }), async (req, res) => {
    const url = str(req.body?.url, 2000);
    const text = (url && (await fetchJobDescription(url).catch(() => null))) || "";
    res.json({ text: text.slice(0, MAX_JOB_TEXT) });
  });

  app.post("/api/claude/chat", requireXhr, requireUser, requireOwner, express.json({ limit: "64kb" }), async (req, res) => {
    const message = str(req.body?.message, 8000).trim();
    if (!message) return res.status(400).json({ error: "Type a message." });
    const url = await relayUrl();
    if (!url) return res.status(503).json({ error: "Your Mac is offline. Run npm run relay on it." });

    const ctrl = new AbortController();
    res.on("close", () => ctrl.abort());
    try {
      const upstream = await fetch(`${url}/chat`, {
        method: "POST",
        headers: relayHeaders(),
        body: JSON.stringify({ prompt: withJob(message, req.body?.job), sessionId: req.body?.sessionId, approve: req.body?.approve }),
        signal: ctrl.signal,
      });
      if (!upstream.ok) {
        const data = await upstream.json().catch(() => ({}));
        return res.status(upstream.status === 409 ? 409 : 502).json({ error: data.error || "Couldn't reach Claude Code." });
      }
      res.set({ "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
      Readable.fromWeb(upstream.body).on("error", () => res.end()).pipe(res);
    } catch (err) {
      if (err.name === "AbortError") return res.end();
      res.status(503).json({ error: "Your Mac is offline. Run npm run relay on it." });
    }
  });

  app.get("/api/claude/file", requireUser, requireOwner, async (req, res) => {
    const name = str(req.query.name, 200);
    const url = await relayUrl();
    if (!url) return res.status(503).json({ error: "Your Mac is offline. Run npm run relay on it." });
    try {
      const upstream = await fetch(`${url}/file?name=${encodeURIComponent(name)}`, { headers: relayHeaders() });
      if (!upstream.ok) return res.status(404).json({ error: "Not found" });
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${name.replace(/[^\w.\- ]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      Readable.fromWeb(upstream.body).on("error", () => res.end()).pipe(res);
    } catch {
      res.status(503).json({ error: "Your Mac is offline. Run npm run relay on it." });
    }
  });

  app.post("/api/claude/relay-register", express.json({ limit: "2kb" }), async (req, res) => {
    if (!secretOk(req.get("X-Relay-Secret"))) return res.status(401).json({ error: "Unauthorized" });
    const url = str(req.body?.url, 200);
    if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url)) return res.status(400).json({ error: "Expected a Cloudflare tunnel address." });
    await store.set("meta", "claude-relay", { url, at: Date.now() }, 3600);
    res.json({ ok: true });
  });
}
