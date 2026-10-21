// Everything a signed-in student sets up in the app, tied to their Google account instead of the
// device: app state (feed view, Connect details, Technical practice, Ginny's selected job). Stored with
// server/store.js (Upstash Redis on Vercel), one entry per student per item, so it follows them to any
// device they sign in on.
//
//   GET    /api/me/data              every saved item for this account
//   PUT    /api/me/data/:key         save one (body { value: string | null })
//
// Only the keys listed in KEYS can be stored. API keys (e.g. a personal OpenAI key) are never sent here.

import express from "express";
import * as store from "./store.js";

export const KEYS = [
  "tepobaby.feed.view",
  "tepobaby.connect.v1",
  "tepobaby.neetcode.v1",
  "tepobaby.neetcode.drafts.v1",
  "tepobaby.neetcode.lang",
  "tepobaby.technical.sub",
  "tepobaby.selectedJobId",
];
const MAX_VALUE = 900 * 1024; // characters (code drafts can be big)

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
}
