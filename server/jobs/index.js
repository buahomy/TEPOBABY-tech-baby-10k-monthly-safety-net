// Job postings aggregator. Each source group refreshes asynchronously on its own timer (never
// blocking requests, never overlapping itself), results are merged and deduped, and connected
// apps are notified the moment the set of postings changes (see /api/postings/stream).
// The last snapshot is kept on disk so a restart serves postings immediately.

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_AGE_MS } from "./classify.js";
import { fetchCompanyBoards } from "./sources/ats.js";
import { fetchGithubLists } from "./sources/github.js";
import { fetchGoogleJobs } from "./sources/googleJobs.js";
import { fetchHackerNews } from "./sources/hackernews.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = process.env.POSTINGS_SNAPSHOT_PATH || path.join(here, "..", "data", "postings.json");
const MIN = 60 * 1000;

// Each group refreshes independently. GitHub lists use conditional requests (304 when unchanged),
// so they can be checked often; the others are spaced out to be gentle on upstream services.
const GROUPS = [
  { id: "github", every: 5 * MIN, run: fetchGithubLists },
  { id: "ats", every: 30 * MIN, run: fetchCompanyBoards },
  { id: "hn", every: 2 * 60 * MIN, run: fetchHackerNews },
  { id: "google", every: 6 * 60 * MIN, run: fetchGoogleJobs },
];

/** Emits "update" ({ updatedAt, total }) whenever the merged postings change. */
export const feedEvents = new EventEmitter();
feedEvents.setMaxListeners(0);
const running = new Set();
let signature = "";

/** groupId → { ranAt, sources: [{ name, count, error? }], postings } */
let state = {};
let merged = [];
let updatedAt = null;

function rebuild() {
  const now = Date.now();
  const byKey = new Map();
  // Earlier groups win on duplicates (curated lists carry sponsorship info).
  for (const g of GROUPS) {
    for (const p of state[g.id]?.postings || []) {
      if (now - new Date(p.postedAt).getTime() > MAX_AGE_MS) continue;
      const key = p.url.toLowerCase();
      const fuzzy = `${p.company}|${p.title}|${p.location}`.toLowerCase();
      if (byKey.has(key) || byKey.has(fuzzy)) continue;
      byKey.set(key, p);
      byKey.set(fuzzy, p);
    }
  }
  merged = [...new Set(byKey.values())].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  updatedAt = new Date().toISOString();

  const next = crypto.createHash("sha1").update(merged.map((p) => p.id).join("\n")).digest("hex");
  const changed = next !== signature;
  signature = next;
  return changed;
}

async function runGroup(g) {
  if (running.has(g.id)) return; // previous refresh still in flight
  running.add(g.id);
  const started = Date.now();
  try {
    const results = await g.run();
    state[g.id] = {
      ranAt: new Date().toISOString(),
      sources: results.map((r) => ({ name: r.name, count: r.postings.length, error: r.error })),
      postings: results.flatMap((r) => r.postings),
    };
    for (const r of results) if (r.error) console.warn(`[jobs] ${r.name}: ${r.error}`);
    const changed = rebuild();
    if (changed) {
      feedEvents.emit("update", { updatedAt, total: merged.length });
      await save();
    }
    console.log(
      `[jobs] ${g.id}: ${state[g.id].postings.length} postings in ${((Date.now() - started) / 1000).toFixed(1)}s · ${merged.length} total${changed ? " · pushed update" : " · no change"}`,
    );
  } catch (err) {
    console.error(`[jobs] ${g.id} refresh failed:`, err.message);
  } finally {
    running.delete(g.id);
  }
}

async function save() {
  try {
    await fs.mkdir(path.dirname(SNAPSHOT), { recursive: true, mode: 0o700 });
    const tmp = `${SNAPSHOT}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state));
    await fs.rename(tmp, SNAPSHOT);
  } catch (err) {
    console.warn("[jobs] could not save snapshot:", err.message);
  }
}

async function restore() {
  try {
    state = JSON.parse(await fs.readFile(SNAPSHOT, "utf8"));
    rebuild();
    console.log(`[jobs] restored ${merged.length} postings from snapshot`);
  } catch {
    state = {};
  }
}

export async function startJobFeed() {
  if (process.env.JOBS_FEED === "off") return;
  await restore();
  // Stagger the first runs; refresh any group whose snapshot is stale.
  GROUPS.forEach((g, i) => {
    const age = state[g.id]?.ranAt ? Date.now() - new Date(state[g.id].ranAt).getTime() : Infinity;
    setTimeout(
      () => {
        runGroup(g);
        setInterval(() => runGroup(g), g.every).unref();
      },
      age > g.every ? i * 2000 : g.every - age,
    ).unref();
  });
}

/** Postings for one level and time window, plus counts for every tab. */
export function queryPostings({ level, maxHours = 72, visaFriendly = false, limit = 30, offset = 0 }) {
  const now = Date.now();
  const inWindow = (p, hours) => now - new Date(p.postedAt).getTime() <= hours * 3600e3;
  const visaOk = (p) => !visaFriendly || (p.sponsorship !== "no" && p.sponsorship !== "citizens");

  const counts = {};
  for (const lv of ["underclassmen", "internship", "entry"]) {
    const pool = merged.filter((p) => p.level === lv && visaOk(p));
    counts[lv] = { fresh: pool.filter((p) => inWindow(p, 72)).length, week: pool.filter((p) => inWindow(p, 168)).length };
  }

  const matching = merged.filter((p) => p.level === level && visaOk(p) && inWindow(p, maxHours));
  return {
    updatedAt,
    total: matching.length,
    counts,
    postings: matching.slice(offset, offset + limit),
    sources: Object.values(state).flatMap((s) => s.sources || []),
  };
}
