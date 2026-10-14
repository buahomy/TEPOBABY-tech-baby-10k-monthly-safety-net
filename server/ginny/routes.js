// Ginny API routes (mounted from server/index.js).
//
//   GET    /api/ginny/status        which pieces are configured (Voyage, Gemini, reranker)
//   GET    /api/ginny/resume        signed-in student's stored resume (metadata only)
//   PUT    /api/ginny/resume        upload / replace the resume PDF (signed in; body = PDF bytes)
//   DELETE /api/ginny/resume        delete it
//   POST   /api/ginny/ats           ATS match analysis for one job
//   POST   /api/ginny/tailor        opt-in Gemini rewrites of the resume for the selected job
//   POST   /api/ginny/chat          Ask Gemini about the selected job
//
// Guests can use both tools too: their resume stays on their device and is sent with each
// analysis, processed in memory, and never stored on the server.

import express from "express";
import { analyze, TIERS } from "./ats.js";
import { askGemini, GEMINI_MODEL, geminiEnabled, tailorResume } from "./gemini.js";
import { fetchJobDescription } from "./jobDescription.js";
import { RERANK_MODEL, warmReranker } from "./rerank.js";
import { MAX_PDF_BYTES, deleteResume, loadResume, pdfToLines, publicMeta, sanitize, saveResume } from "./resume.js";
import { VOYAGE_MODEL, voyageEnabled } from "./voyage.js";

// Simple in-memory rate limit per user / IP.
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

/**
 * An edited copy of the student's own resume sections (the Apply agent's tailored version), or
 * null. Same shape the server builds from the PDF: { experience, projects, skills, education }.
 */
function editedSections(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out = {};
  let total = 0;
  for (const k of ["experience", "projects", "skills", "education"]) {
    const lines = (Array.isArray(v[k]) ? v[k] : []).slice(0, 80).map((x) => str(x, 600).trim()).filter(Boolean);
    total += lines.join("").length;
    out[k] = lines;
  }
  return total >= 80 && total <= 40000 ? out : null;
}

export function ginnyRoutes(app, { readSession, requireXhr, requireUser }) {
  warmReranker();
  const who = (req) => readSession(req)?.sub || `ip:${req.ip}`;

  const fail = (res, err, what) => {
    if (err?.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error(`[ginny] ${what} failed:`, err?.message);
    res.status(502).json({ error: `Ginny couldn't finish the ${what}. Please try again.` });
  };

  app.get("/api/ginny/status", (_req, res) => {
    res.json({
      voyage: voyageEnabled() ? VOYAGE_MODEL : null,
      gemini: geminiEnabled() ? GEMINI_MODEL : null,
      reranker: RERANK_MODEL,
      tiers: TIERS.map(({ id, label, about, min }) => ({ id, label, about, min })),
    });
  });

  // ---- Resume (signed-in students: stored privately on the server) ----
  app.get("/api/ginny/resume", requireUser, async (req, res) => {
    res.json({ resume: publicMeta(await loadResume(req.session.sub)) });
  });

  app.put(
    "/api/ginny/resume",
    requireXhr,
    requireUser,
    express.raw({ type: "application/pdf", limit: MAX_PDF_BYTES }),
    async (req, res) => {
      if (!limit(`up:${req.session.sub}`, 20, HOUR)) return res.status(429).json({ error: "Too many uploads. Try again later." });
      try {
        const meta = await saveResume(req.session.sub, req.body, req.get("X-File-Name"));
        res.json({ resume: publicMeta(meta) });
      } catch (err) {
        fail(res, err, "upload");
      }
    },
  );

  app.delete("/api/ginny/resume", requireXhr, requireUser, async (req, res) => {
    await deleteResume(req.session.sub);
    res.json({ ok: true });
  });

  // ---- ATS analysis ----
  app.post("/api/ginny/ats", requireXhr, express.json({ limit: "8mb" }), async (req, res) => {
    if (!limit(`ats:${who(req)}`, 80, HOUR)) return res.status(429).json({ error: "You've run a lot of analyses. Try again in a bit." });
    const job = req.body?.job || {};
    const title = str(job.title, 300);
    const company = str(job.company, 200);
    const url = str(job.url, 2000);
    if (!title || !company) return res.status(400).json({ error: "Pick a job first." });

    try {
      // Resume: an edited copy (Apply agent), the stored one for signed-in students, otherwise the
      // PDF sent from the device.
      const session = readSession(req);
      let sections = editedSections(req.body?.sections);
      if (sections) {
        // use it
      } else if (session) {
        const stored = await loadResume(session.sub);
        if (!stored) return res.status(409).json({ error: "Upload your resume first.", needResume: true });
        sections = stored.sanitized.sections;
      } else {
        const b64 = str(req.body?.resumePdf, 8 * 1024 * 1024);
        if (!b64) return res.status(409).json({ error: "Upload your resume first.", needResume: true });
        sections = sanitize(await pdfToLines(Buffer.from(b64, "base64"))).sections;
      }

      let description = str(req.body?.description, 30000).trim();
      if (description.length < 200) description = (url && (await fetchJobDescription(url))) || "";
      if (description.length < 200) {
        return res.status(422).json({ error: "Couldn't load this job's description. Paste it below to continue.", needDescription: true });
      }

      // The description is returned so re-scores of the same job don't fetch it again.
      res.json({ result: await analyze({ sections, jobTitle: title, company, description }), description, sections });
    } catch (err) {
      fail(res, err, "analysis");
    }
  });

  // ---- Tailored rewrites (opt-in: sends the sanitized resume sections to Gemini) ----
  app.post("/api/ginny/tailor", requireXhr, express.json({ limit: "8mb" }), async (req, res) => {
    if (!geminiEnabled()) return res.status(503).json({ error: "Tailored suggestions need GEMINI_API_KEY on the server." });
    if (!limit(`tailor:${who(req)}`, 40, HOUR)) return res.status(429).json({ error: "You've asked for a lot of rewrites. Try again in a bit." });
    const job = req.body?.job || {};
    const list = (v, n, m) => (Array.isArray(v) ? v : []).slice(0, n).map((x) => str(x, m)).filter(Boolean);
    try {
      const session = readSession(req);
      let sections = editedSections(req.body?.sections);
      if (sections) {
        // the Apply agent's edited copy
      } else if (session) {
        const stored = await loadResume(session.sub);
        if (!stored) return res.status(409).json({ error: "Upload your resume first.", needResume: true });
        sections = stored.sanitized.sections;
      } else {
        const b64 = str(req.body?.resumePdf, 8 * 1024 * 1024);
        if (!b64) return res.status(409).json({ error: "Upload your resume first.", needResume: true });
        sections = sanitize(await pdfToLines(Buffer.from(b64, "base64"))).sections;
      }
      // Only Experience / Projects / Skills / Education, with identifiers already redacted.
      const resumeText = Object.entries(sections)
        .filter(([, v]) => v.length)
        .map(([k, v]) => `${k.toUpperCase()}\n${v.join("\n")}`)
        .join("\n\n");
      const tips = await tailorResume({
        jobTitle: str(job.title, 300),
        company: str(job.company, 200),
        requirements: list(req.body?.requirements, 12, 400),
        missingSkills: list(req.body?.missingSkills, 15, 60),
        gaps: list(req.body?.gaps, 6, 400),
        resumeText,
      });
      res.json({ tips });
    } catch (err) {
      if (err.status === 429) return res.status(429).json({ error: "Gemini's free quota is used up for now. Try again later." });
      if (err.busy) return res.status(503).json({ error: "Gemini is busy right now. Try again in a minute." });
      fail(res, err, "suggestions");
    }
  });

  // ---- Ask Gemini ----
  app.post("/api/ginny/chat", requireXhr, express.json({ limit: "64kb" }), async (req, res) => {
    if (!geminiEnabled()) return res.status(503).json({ error: "Ask Gemini isn't set up yet (missing GEMINI_API_KEY)." });
    if (!limit(`chat:${who(req)}`, 40, HOUR)) return res.status(429).json({ error: "You've asked a lot of questions. Try again in a bit." });

    const messages = (Array.isArray(req.body?.messages) ? req.body.messages : [])
      .slice(-12)
      .map((m) => ({ role: m?.role === "model" ? "model" : "user", text: str(m?.text, 4000) }))
      .filter((m) => m.text);
    if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "Ask a question first." });

    const c = req.body?.context || {};
    const ctx = {
      role: str(c.role, 200),
      company: str(c.company, 200),
      location: str(c.location, 200),
      level: str(c.level, 40),
      graduation: str(c.graduation, 40),
      visa: str(c.visa, 120),
    };
    try {
      res.json(await askGemini(messages, ctx));
    } catch (err) {
      if (err.status === 429) return res.status(429).json({ error: "Gemini's free quota is used up for now. Try again later." });
      if (err.busy) return res.status(503).json({ error: "Gemini is busy right now. Try again in a minute." });
      fail(res, err, "answer");
    }
  });
}
