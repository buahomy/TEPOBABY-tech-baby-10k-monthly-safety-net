// Saved / applied jobs per signed-in student, keyed by Google account ID (`sub`).
// Each entry keeps a copy of the posting, so it stays in the list after the posting leaves the
// 7-day feed. A JSON file is enough for local development; swap for a real database before launch.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.SAVED_JOBS_STORE_PATH || path.join(here, "data", "saved-jobs.json");
const MAX_JOBS = 500;
const STATUSES = new Set(["saved", "applied"]);

let cache = null;
let writes = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    cache = {};
  }
  return cache;
}

function persist(all) {
  // Write-then-rename so a crash never leaves a half-written file; owner-only permissions.
  writes = writes
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(FILE), { recursive: true, mode: 0o700 });
      const tmp = `${FILE}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(all), { mode: 0o600 });
      await fs.rename(tmp, FILE);
    });
  return writes;
}

const str = (v, max) => (typeof v === "string" && v.length <= max ? v : null);

/** Validates and normalizes a job sent by the app. Throws { status: 400 } on bad input. */
function clean(job) {
  if (!job || typeof job !== "object") throw { status: 400, message: "Expected a job." };
  const id = str(job.id, 300);
  const company = str(job.company, 200);
  const title = str(job.title, 300);
  const url = str(job.url, 2000);
  if (!id || !company || !title || !url) throw { status: 400, message: "Job is missing id, company, title or url." };
  try {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error();
  } catch {
    throw { status: 400, message: "Job url must be http(s)." };
  }
  const status = job.status ?? "saved";
  if (!STATUSES.has(status)) throw { status: 400, message: "Status must be saved or applied." };
  const domain = job.domain == null ? null : str(job.domain, 253);
  const now = new Date().toISOString();
  return {
    id,
    company,
    title,
    url,
    location: str(job.location, 300) ?? "",
    domain: domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? domain.toLowerCase() : null,
    postedAt: str(job.postedAt, 40) ?? null,
    source: str(job.source, 200) ?? "",
    status,
    savedAt: str(job.savedAt, 40) ?? now,
    appliedAt: status === "applied" ? (str(job.appliedAt, 40) ?? now) : null,
  };
}

export async function listSaved(sub) {
  const all = await load();
  return Object.values(all[sub] || {}).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Saves a job or updates its status. */
export async function upsertSaved(sub, job) {
  const all = await load();
  const mine = (all[sub] ||= {});
  const next = clean(job);
  const prev = mine[next.id];
  if (!prev && Object.keys(mine).length >= MAX_JOBS) throw { status: 400, message: `You can save up to ${MAX_JOBS} jobs.` };
  // Keep the original save time; record when it was first marked applied.
  mine[next.id] = {
    ...next,
    savedAt: prev?.savedAt ?? next.savedAt,
    appliedAt: next.status === "applied" ? (prev?.appliedAt ?? next.appliedAt) : null,
  };
  await persist(all);
  return mine[next.id];
}

export async function removeSaved(sub, id) {
  const all = await load();
  if (all[sub]?.[id]) {
    delete all[sub][id];
    await persist(all);
  }
}

/** Adds jobs saved as a guest; jobs already on the account win. */
export async function importSaved(sub, jobs) {
  if (!Array.isArray(jobs)) throw { status: 400, message: "Expected a list of jobs." };
  const all = await load();
  const mine = (all[sub] ||= {});
  for (const raw of jobs.slice(0, MAX_JOBS)) {
    const job = clean(raw);
    if (!mine[job.id] && Object.keys(mine).length < MAX_JOBS) mine[job.id] = job;
  }
  await persist(all);
  return listSaved(sub);
}
