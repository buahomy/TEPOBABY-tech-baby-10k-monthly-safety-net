// Visa sponsorship for each posting, read from its full job description.
//
// The lists rarely say anymore (Simplify's field reads "Other"), so after each daily update every
// posting whose status is unknown gets its description fetched (the same posting APIs Ginny uses:
// Greenhouse, Lever, Ashby, Workday, Eightfold/Microsoft, SmartRecruiters, or the page) and checked
// with sponsorshipFromText(): U.S. citizens / clearance only, no sponsorship, sponsors, or unknown.
//
// Results are cached per posting (server/data/sponsorship.json locally, Upstash Redis on Vercel),
// so each posting is read once. Each run has a time budget; whatever's left is done next run.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJobDescription } from "../ginny/jobDescription.js";
import * as store from "../store.js";
import { mapLimit, sponsorshipFromText } from "./classify.js";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "sponsorship.json");
const KEEP_MS = 45 * 24 * 3600e3; // forget postings after 45 days
const RETRY_MS = 3 * 24 * 3600e3; // retry descriptions that couldn't be read

/** id → { s: "citizens" | "no" | "yes" | null, at, read: boolean } */
let cache = null;

async function load() {
  if (cache) return cache;
  try {
    cache = store.usingRedis ? (await store.get("meta", "sponsorship")) || {} : JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

async function save() {
  const now = Date.now();
  for (const [id, v] of Object.entries(cache)) if (now - v.at > KEEP_MS) delete cache[id];
  if (store.usingRedis) await store.set("meta", "sponsorship", cache);
  else {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(cache));
  }
}

/** Fills in what's already known, without any network calls. Mutates the postings. */
export async function applyKnownSponsorship(postings) {
  const c = await load();
  for (const p of postings) if (!p.sponsorship && c[p.id]?.s) p.sponsorship = c[p.id].s;
  return postings;
}

/**
 * Reads the descriptions of postings whose sponsorship is still unknown, until `budgetMs` runs out.
 * Returns { checked, found }.
 */
export async function enrichSponsorship(postings, { budgetMs = 120000, concurrency = 8 } = {}) {
  const c = await load();
  const started = Date.now();
  const now = Date.now();
  const todo = postings.filter((p) => !p.sponsorship && (!c[p.id] || (!c[p.id].read && now - c[p.id].at > RETRY_MS)));
  let checked = 0;
  let found = 0;
  await mapLimit(todo, concurrency, async (p) => {
    if (Date.now() - started > budgetMs) return;
    const text = await fetchJobDescription(p.url).catch(() => null);
    const s = text ? sponsorshipFromText(text) : null;
    c[p.id] = { s, at: Date.now(), read: !!text };
    checked++;
    if (s) {
      p.sponsorship = s;
      found++;
    }
  });
  await applyKnownSponsorship(postings);
  if (checked) await save();
  return { checked, found, left: todo.length - checked };
}
