// AI Agent API (mounted from server/index.js).
//
//   POST /api/agent/parse     one resume PDF → sections and entries for the experience bank (not stored)
//   GET  /api/agent/bank      the signed-in student's experience bank
//   PUT  /api/agent/bank      save it
//   GET  /api/agent/access    whether this student can use the AI Agent, and which Generate engine runs
//   POST /api/agent/generate  one curation round with Claude Code (when it's installed where the server runs)
//
// Subscription: the AI Agent is a subscription feature. During the demo it's free for everyone.
// Set AGENT_SUBSCRIPTION_REQUIRED=on to require it; then only signed-in accounts listed in
// AGENT_SUBSCRIBER_EMAILS can use it (billing isn't built yet).
//
// The PDF is read in memory with the same parser and redaction as Ginny (name and contact details
// removed); only the resulting text goes back to the browser.

import express from "express";
import { MAX_PDF_BYTES, pdfToLines, sanitize } from "../ginny/resume.js";
import * as store from "../store.js";
import { engine, generateRound } from "./engine.js";

const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now);
  hits.set(key, list);
  return true;
}
const HOUR = 3600e3;
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

// ---- Turning resume lines into entries ----

const DATE = /\b((19|20)\d\d|present|current|summer|fall|spring|winter|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;
const BULLET_MARK = /^[•●▪◦\-–*·]\s*/;

/** A header line ("Software Engineering Intern, Acme (Summer 2025)") vs a bullet line. */
function looksLikeHeader(line) {
  if (BULLET_MARK.test(line)) return false;
  const words = line.split(/\s+/).length;
  return words <= 14 && !/[.;]$/.test(line) && (DATE.test(line) || /[|,–—]/.test(line) || words <= 6);
}

/** Groups Experience / Projects lines into entries with bullets (the student can fix anything). */
function toEntries(lines, kind) {
  const entries = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(BULLET_MARK, "").trim();
    if (!line) continue;
    // A bullet that wrapped onto the next line ("…from 2 hours" / "to 15 minutes"): join it back.
    const last = cur?.bullets[cur.bullets.length - 1];
    if (last && !BULLET_MARK.test(raw) && /^[a-z0-9(&]/.test(line) && !/[.!?]$/.test(last)) {
      cur.bullets[cur.bullets.length - 1] = `${last} ${line}`;
      continue;
    }
    // "Campus Events App: React and Node.js web app…" → a named project with one bullet.
    const named = kind === "project" && line.match(/^([A-Z][^:]{2,60}):\s+(.{10,})$/);
    if (named) {
      cur = { kind, title: named[1].trim(), org: "", dates: "", bullets: [named[2].trim()] };
      entries.push(cur);
      continue;
    }
    if (looksLikeHeader(raw) || !cur) {
      if (looksLikeHeader(raw)) {
        const dates = (line.match(/\(([^)]*)\)\s*$/) || line.match(/((?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|summer|fall|spring|winter)\w*\.?\s+)?(?:19|20)\d\d.*)$/i) || [])[1] || "";
        const head = dates ? line.replace(dates, "").replace(/[()|,–—\s]+$/, "").trim() : line;
        const [title, ...rest] = head.split(/\s*[,|–—@]\s*|\s+at\s+/i);
        cur = { kind, title: title || head, org: rest.join(", "), dates: dates.trim(), bullets: [] };
        entries.push(cur);
        continue;
      }
      cur = { kind, title: kind === "project" ? "Project" : "Experience", org: "", dates: "", bullets: [] };
      entries.push(cur);
    }
    cur.bullets.push(line);
  }
  return entries.filter((e) => e.bullets.length || e.title);
}

const splitSkills = (lines) =>
  [
    ...new Set(
      lines
        .join(", ")
        .replace(/^[^:]{0,30}:\s*/gm, "")
        .split(/\s*[,;|•]\s*/)
        .map((s) => s.replace(/^(languages|frameworks|tools|skills|technologies)\s*:\s*/i, "").trim())
        .filter((s) => s && s.length <= 40),
    ),
  ];

// ---- Bank validation (what the browser may save) ----

function cleanBank(b) {
  if (!b || typeof b !== "object") return null;
  const entries = (Array.isArray(b.entries) ? b.entries : []).slice(0, 60).map((e) => ({
    id: str(e?.id, 40),
    kind: ["experience", "project", "leadership"].includes(e?.kind) ? e.kind : "experience",
    title: str(e?.title, 200),
    org: str(e?.org, 200),
    dates: str(e?.dates, 80),
    link: /^https?:\/\/[^\s]+$/i.test(str(e?.link, 300)) ? str(e.link, 300) : "",
    bullets: (Array.isArray(e?.bullets) ? e.bullets : []).slice(0, 30).map((x) => ({ id: str(x?.id, 40), text: str(x?.text, 600), source: str(x?.source, 120) })),
  }));
  return {
    entries,
    skills: (Array.isArray(b.skills) ? b.skills : []).slice(0, 150).map((s) => str(s, 60)).filter(Boolean),
    education: (Array.isArray(b.education) ? b.education : []).slice(0, 12).map((s) => str(s, 300)).filter(Boolean),
    sources: (Array.isArray(b.sources) ? b.sources : []).slice(0, 20).map((s) => ({ id: str(s?.id, 40), fileName: str(s?.fileName, 120), addedAt: str(s?.addedAt, 40) })),
    updatedAt: new Date().toISOString(),
  };
}

const subscriptionRequired = () => process.env.AGENT_SUBSCRIPTION_REQUIRED === "on";
const subscribers = () =>
  (process.env.AGENT_SUBSCRIBER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** { allowed, plan, demo }: free for everyone during the demo. */
function accessFor(session) {
  if (!subscriptionRequired()) return { allowed: true, plan: "pro", demo: true };
  const subscribed = !!session?.email && subscribers().includes(String(session.email).toLowerCase());
  return { allowed: subscribed, plan: subscribed ? "pro" : "free", demo: false };
}

export function agentRoutes(app, { readSession, requireXhr, requireUser }) {
  const who = (req) => readSession(req)?.sub || `ip:${req.ip}`;
  const requireAccess = (req, res, next) =>
    accessFor(readSession(req)).allowed ? next() : res.status(402).json({ error: "The AI Agent is a subscription feature.", subscribe: true });

  app.get("/api/agent/access", (req, res) => {
    res.set("Cache-Control", "private, no-store");
    res.json({ ...accessFor(readSession(req)), engine: engine() });
  });

  app.post("/api/agent/parse", requireXhr, requireAccess, express.raw({ type: "application/pdf", limit: MAX_PDF_BYTES }), async (req, res) => {
    if (!limit(`parse:${who(req)}`, 30, HOUR)) return res.status(429).json({ error: "Too many uploads. Try again later." });
    try {
      const { sections, redactions } = sanitize(await pdfToLines(req.body));
      res.json({
        fileName: str(req.get("X-File-Name"), 120).replace(/[^\w.\- ()]/g, "") || "resume.pdf",
        entries: [...toEntries(sections.experience, "experience"), ...toEntries(sections.projects, "project")],
        skills: splitSkills(sections.skills),
        education: sections.education,
        redactions,
      });
    } catch (err) {
      if (err?.status && err.status < 500) return res.status(err.status).json({ error: err.message });
      console.error("[agent] parse failed:", err?.message);
      res.status(502).json({ error: "Couldn't read that PDF. Try another file, or type your experience in." });
    }
  });

  app.get("/api/agent/bank", requireUser, async (req, res) => {
    res.json({ bank: await store.get("bank", req.session.sub) });
  });

  app.put("/api/agent/bank", requireXhr, requireUser, express.json({ limit: "512kb" }), async (req, res) => {
    const bank = cleanBank(req.body?.bank);
    if (!bank) return res.status(400).json({ error: "Expected an experience bank." });
    await store.set("bank", req.session.sub, bank);
    res.json({ ok: true, updatedAt: bank.updatedAt });
  });

  app.post("/api/agent/generate", requireXhr, requireAccess, express.json({ limit: "512kb" }), async (req, res) => {
    if (!limit(`gen:${who(req)}`, 60, HOUR)) return res.status(429).json({ error: "Lots of Generate rounds this hour. Try again in a bit." });
    const b = req.body || {};
    const bank = cleanBank(b.bank);
    if (!bank?.entries.length) return res.status(400).json({ error: "Add your experience first." });
    const list = (v, n, m) => (Array.isArray(v) ? v : []).slice(0, n).map((x) => str(x, m)).filter(Boolean);
    try {
      res.json(
        await generateRound(
          {
            jobTitle: str(b.jobTitle, 300),
            company: str(b.company, 200),
            requirements: list(b.requirements, 14, 400),
            missingSkills: list(b.missingSkills, 15, 60),
            gaps: list(b.gaps, 6, 400),
            bank,
            target: Number(b.target) || 85,
            lastScore: Number.isFinite(b.lastScore) ? b.lastScore : null,
            round: Number(b.round) || 1,
          },
        ),
      );
    } catch (err) {
      if (err.status && err.status < 600) return res.status(err.status).json({ error: err.message });
      console.error("[agent] generate failed:", err.message);
      res.status(502).json({ error: "Generate couldn't finish this round. Try again." });
    }
  });
}
