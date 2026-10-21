// Everything a signed-in student sets up in the app, tied to their Google account instead of the
// device: app state (AI Agent progress, PDF header, feed view, Connect details, Technical practice,
// Ginny's selected job) and their original resume PDFs. Stored with server/store.js (Upstash Redis on
// Vercel), one entry per student per item, so it follows them to any device they sign in on.
//
//   GET    /api/me/data              every saved item for this account
//   PUT    /api/me/data/:key         save one (body { value: string | null })
//   GET    /api/me/files             ids of the stored resume PDFs
//   PUT    /api/me/files/:id         store one (body = PDF bytes)
//   GET    /api/me/files/:id         the PDF
//   DELETE /api/me/files/:id         remove it
//
// Only the keys listed in KEYS can be stored. API keys (e.g. a personal OpenAI key) are never sent here.

import express from "express";
import * as store from "./store.js";

export const KEYS = [
  "tepobaby.aiAgent.v2",
  "tepobaby.resumeHeader",
  "tepobaby.feed.view",
  "tepobaby.connect.v1",
  "tepobaby.neetcode.v1",
  "tepobaby.neetcode.drafts.v1",
  "tepobaby.neetcode.lang",
  "tepobaby.technical.sub",
  "tepobaby.selectedJobId",
];
const MAX_VALUE = 900 * 1024; // characters (code drafts and agent progress can be big)

const MAX_PDF = 5 * 1024 * 1024;
const MAX_FILES = 25;
const CHUNK = 384 * 1024; // bytes per stored piece, so no single entry gets too large

const fileId = (v) => (/^[a-z0-9_-]{2,40}$/i.test(String(v)) ? String(v) : null);

export function userDataRoutes(app, { requireXhr, requireUser }) {
  app.get("/api/me/data", requireUser, async (req, res) => {
    const values = {};
    await Promise.all(
      KEYS.map(async (k) => {
        const v = await store.get("userdata", `${req.session.sub}|${k}`);
        if (typeof v === "string") values[k] = v;
      }),
    );
    res.set("Cache-Control", "private, no-store");
    res.json({ values });
  });

  app.put("/api/me/data/:key", requireXhr, requireUser, express.json({ limit: "1mb" }), async (req, res) => {
    const key = String(req.params.key);
    if (!KEYS.includes(key)) return res.status(400).json({ error: "Unknown item." });
    const value = req.body?.value;
    if (value === null) {
      await store.del("userdata", `${req.session.sub}|${key}`);
      return res.json({ ok: true });
    }
    if (typeof value !== "string" || value.length > MAX_VALUE) return res.status(400).json({ error: "Too large to save." });
    await store.set("userdata", `${req.session.sub}|${key}`, value);
    res.json({ ok: true });
  });

  // ---- Resume PDFs ----

  const listKey = (sub) => `${sub}|files`;

  app.get("/api/me/files", requireUser, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    res.json({ ids: (await store.get("userfile", listKey(req.session.sub))) || [] });
  });

  app.put("/api/me/files/:id", requireXhr, requireUser, express.raw({ type: "application/pdf", limit: MAX_PDF }), async (req, res) => {
    const id = fileId(req.params.id);
    const buf = req.body;
    if (!id || !Buffer.isBuffer(buf) || buf.length < 8 || buf.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "Expected a PDF." });
    const sub = req.session.sub;
    const ids = (await store.get("userfile", listKey(sub))) || [];
    if (!ids.includes(id) && ids.length >= MAX_FILES) return res.status(400).json({ error: `You can keep up to ${MAX_FILES} resume PDFs.` });
    const chunks = Math.ceil(buf.length / CHUNK);
    for (let i = 0; i < chunks; i++) await store.set("userfile", `${sub}|${id}|${i}`, buf.subarray(i * CHUNK, (i + 1) * CHUNK).toString("base64"));
    await store.set("userfile", `${sub}|${id}|meta`, { chunks, size: buf.length });
    if (!ids.includes(id)) await store.set("userfile", listKey(sub), [...ids, id]);
    res.json({ ok: true });
  });

  app.get("/api/me/files/:id", requireUser, async (req, res) => {
    const id = fileId(req.params.id);
    const meta = id && (await store.get("userfile", `${req.session.sub}|${id}|meta`));
    if (!meta) return res.status(404).json({ error: "Not found" });
    const parts = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => store.get("userfile", `${req.session.sub}|${id}|${i}`)));
    if (parts.some((p) => typeof p !== "string")) return res.status(404).json({ error: "Not found" });
    res.set({ "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    res.send(Buffer.concat(parts.map((p) => Buffer.from(p, "base64"))));
  });

  app.delete("/api/me/files/:id", requireXhr, requireUser, async (req, res) => {
    const id = fileId(req.params.id);
    if (!id) return res.status(400).json({ error: "Bad id" });
    const sub = req.session.sub;
    const meta = await store.get("userfile", `${sub}|${id}|meta`);
    for (let i = 0; i < (meta?.chunks || 0); i++) await store.del("userfile", `${sub}|${id}|${i}`);
    await store.del("userfile", `${sub}|${id}|meta`);
    const ids = (await store.get("userfile", listKey(sub))) || [];
    await store.set("userfile", listKey(sub), ids.filter((x) => x !== id));
    res.json({ ok: true });
  });
}
