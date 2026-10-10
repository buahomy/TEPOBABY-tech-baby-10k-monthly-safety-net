// Job postings aggregator.
//
// Schedule: once a day, every morning at 7:00 AM Eastern Time (America/New_York, so it follows
// daylight saving), i.e. 30–31 updates a month. Override the time with JOBS_DAILY_TIME="HH:MM".
// If the server was off at the scheduled time, it catches up as soon as it starts.
//
// Each daily update runs every source asynchronously in parallel (it never blocks requests and
// never overlaps a previous update). As each source finishes, results are merged and deduped and
// connected apps are notified right away (see /api/postings/stream). The last snapshot is kept on
// disk so a restart serves postings immediately.

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_AGE_MS } from "./classify.js";
import { addDomains } from "./logos.js";
import { fetchCompanyBoards } from "./sources/ats.js";
import { fetchGithubLists } from "./sources/github.js";
import { fetchGoogleJobs } from "./sources/googleJobs.js";
import { fetchHackerNews } from "./sources/hackernews.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = process.env.POSTINGS_SNAPSHOT_PATH || path.join(here, "..", "data", "postings.json");

export const TIME_ZONE = "America/New_York";
export const DAILY_TIME = /^\d{1,2}:\d{2}$/.test(process.env.JOBS_DAILY_TIME || "") ? process.env.JOBS_DAILY_TIME : "07:00";

// Order matters for duplicates: earlier sources win (curated lists carry sponsorship info).
const SOURCES = [
  { id: "github", run: fetchGithubLists },
  { id: "ats", run: fetchCompanyBoards },
  { id: "hn", run: fetchHackerNews },
  { id: "google", run: fetchGoogleJobs },
];

/** Emits "update" ({ updatedAt, total }) whenever the merged postings change. */
export const feedEvents = new EventEmitter();
feedEvents.setMaxListeners(0);

/** { lastRunAt, sources: { [id]: { ranAt, sources: [{ name, count, error? }], postings } } } */
let state = { lastRunAt: null, sources: {} };
let merged = [];
let updatedAt = null;
let signature = "";
let updating = false;

// ---- Eastern Time schedule ----

/** Offset in minutes between UTC and `TIME_ZONE` at the given instant (e.g. -240 during EDT). */
function zoneOffsetMinutes(at) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** The scheduled time on the Eastern-Time calendar day containing `at`, as a UTC Date. */
function scheduledOnDayOf(at) {
  const [hh, mm] = DAILY_TIME.split(":").map(Number);
  const local = new Date(at.getTime() + zoneOffsetMinutes(at) * 60000); // wall clock, read as UTC
  const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hh, mm);
  // Convert the wall-clock time back to UTC using the offset in effect at that moment.
  return new Date(guess - zoneOffsetMinutes(new Date(guess)) * 60000);
}

export function nextRunAt(now = new Date()) {
  const today = scheduledOnDayOf(now);
  return today > now ? today : scheduledOnDayOf(new Date(now.getTime() + 24 * 3600e3));
}

function previousRunAt(now = new Date()) {
  const today = scheduledOnDayOf(now);
  return today <= now ? today : scheduledOnDayOf(new Date(now.getTime() - 24 * 3600e3));
}

// ---- Merge ----

function rebuild() {
  const now = Date.now();
  const byKey = new Map();
  for (const s of SOURCES) {
    for (const p of state.sources[s.id]?.postings || []) {
      if (now - new Date(p.postedAt).getTime() > MAX_AGE_MS) continue;
      const key = p.url.toLowerCase();
      const fuzzy = `${p.company}|${p.title}|${p.location}`.toLowerCase();
      if (byKey.has(key) || byKey.has(fuzzy)) continue;
      byKey.set(key, p);
      byKey.set(fuzzy, p);
    }
  }
  merged = [...new Set(byKey.values())].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  updatedAt = state.lastRunAt;

  const next = crypto
    .createHash("sha1")
    .update(merged.map((p) => `${p.id}:${p.domain || ""}`).join("\n"))
    .digest("hex");
  const changed = next !== signature;
  signature = next;
  return changed;
}

async function runSource(s) {
  const started = Date.now();
  try {
    const results = await s.run();
    const postings = await addDomains(results.flatMap((r) => r.postings));
    state.sources[s.id] = {
      ranAt: new Date().toISOString(),
      sources: results.map((r) => ({ name: r.name, count: r.postings.length, error: r.error })),
      postings,
    };
    for (const r of results) if (r.error) console.warn(`[jobs] ${r.name}: ${r.error}`);
    state.lastRunAt = new Date().toISOString();
    const changed = rebuild();
    if (changed) feedEvents.emit("update", { updatedAt, total: merged.length });
    console.log(
      `[jobs] ${s.id}: ${postings.length} postings in ${((Date.now() - started) / 1000).toFixed(1)}s · ${merged.length} total${changed ? " · pushed update" : ""}`,
    );
  } catch (err) {
    console.error(`[jobs] ${s.id} update failed:`, err.message);
  }
}

/** Runs every source in parallel; resolves when all have finished. */
export async function runDailyUpdate() {
  if (updating) return;
  updating = true;
  console.log(`[jobs] daily update started (${new Date().toLocaleString("en-US", { timeZone: TIME_ZONE })} ET)`);
  try {
    await Promise.allSettled(SOURCES.map(runSource));
    state.lastRunAt = new Date().toISOString();
    rebuild();
    await save();
  } finally {
    updating = false;
  }
}

function scheduleNext() {
  const at = nextRunAt();
  console.log(`[jobs] next update ${at.toLocaleString("en-US", { timeZone: TIME_ZONE })} ET`);
  setTimeout(async () => {
    await runDailyUpdate();
    scheduleNext();
  }, at.getTime() - Date.now()).unref();
}

// ---- Persistence ----

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
    const saved = JSON.parse(await fs.readFile(SNAPSHOT, "utf8"));
    if (saved && saved.sources) {
      state = saved;
      rebuild();
      console.log(`[jobs] restored ${merged.length} postings from ${state.lastRunAt}`);
    }
  } catch {
    // no snapshot yet
  }
}

export async function startJobFeed() {
  if (process.env.JOBS_FEED === "off") return;
  await restore();
  const missed = !state.lastRunAt || new Date(state.lastRunAt) < previousRunAt();
  if (missed) runDailyUpdate(); // catch up without delaying startup
  scheduleNext();
}

// ---- Queries ----

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
    nextUpdateAt: nextRunAt().toISOString(),
    schedule: `Daily at ${DAILY_TIME} ET`,
    total: matching.length,
    counts,
    postings: matching.slice(offset, offset + limit),
    sources: Object.values(state.sources).flatMap((s) => s.sources || []),
  };
}

/** Only domains that appear in current postings are served by /api/logo. */
export function knownDomain(domain) {
  return merged.some((p) => p.domain === domain);
}
