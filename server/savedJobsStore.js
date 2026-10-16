// Saved / applied jobs per signed-in student, keyed by Google account ID (`sub`).
// Each entry keeps a copy of the posting, so it stays in the list after the posting leaves the
// 7-day feed. Applied jobs are never pruned or refreshed by the daily job update: they stay until
// the student removes them, with their hiring stage (OA, phone, on-site, … offer).
// Stored with server/store.js (Upstash Redis on Vercel, a JSON file locally), one entry per student.

import * as store from "./store.js";

const MAX_JOBS = 500;
const STATUSES = new Set(["saved", "applied"]);
// Where an applied job is in the hiring process.
export const STAGES = ["applied", "oa", "phone", "onsite", "final", "team_match", "offer", "ghosted", "not_proceeding"];

const mineOf = async (sub) => (await store.get("saved-jobs", sub)) || {};
const saveMine = (sub, mine) => store.set("saved-jobs", sub, mine);

const str = (v, max) => (typeof v === "string" && v.length <= max ? v : null);

/** The résumé's ATS score for this application (from the AI Agent), or null. */
function cleanAts(a) {
  if (!a || typeof a !== "object") return null;
  const n = (v) => (Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null);
  const score = n(a.score);
  if (score === null) return null;
  return {
    score,
    firstScore: n(a.firstScore) ?? score,
    history: (Array.isArray(a.history) ? a.history : []).slice(0, 12).map(n).filter((x) => x !== null),
    target: n(a.target),
    rounds: Number.isInteger(a.rounds) && a.rounds >= 0 && a.rounds < 50 ? a.rounds : 0,
    scoredAt: str(a.scoredAt, 40) ?? null,
    via: str(a.via, 40) ?? "AI Agent",
  };
}

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
  const stage = status === "applied" ? (job.stage ?? "applied") : null;
  if (stage !== null && !STAGES.includes(stage)) throw { status: 400, message: "Unknown application stage." };
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
    stage,
    stageUpdatedAt: stage ? (str(job.stageUpdatedAt, 40) ?? now) : null,
    ats: cleanAts(job.ats),
  };
}

export async function listSaved(sub) {
  return Object.values(await mineOf(sub)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Saves a job or updates its status. */
export async function upsertSaved(sub, job) {
  const mine = await mineOf(sub);
  const next = clean(job);
  const prev = mine[next.id];
  if (!prev && Object.keys(mine).length >= MAX_JOBS) throw { status: 400, message: `You can save up to ${MAX_JOBS} jobs.` };
  // Keep the original save / apply times; stamp the stage time only when the stage changes.
  mine[next.id] = {
    ...next,
    savedAt: prev?.savedAt ?? next.savedAt,
    appliedAt: next.status === "applied" ? (prev?.appliedAt ?? next.appliedAt) : null,
    stageUpdatedAt: next.stage ? (prev?.stage === next.stage ? (prev.stageUpdatedAt ?? next.stageUpdatedAt) : new Date().toISOString()) : null,
    ats: next.ats ?? prev?.ats ?? null,
  };
  await saveMine(sub, mine);
  return mine[next.id];
}

export async function removeSaved(sub, id) {
  const mine = await mineOf(sub);
  if (mine[id]) {
    delete mine[id];
    await saveMine(sub, mine);
  }
}

/** Adds jobs saved as a guest; jobs already on the account win. */
export async function importSaved(sub, jobs) {
  if (!Array.isArray(jobs)) throw { status: 400, message: "Expected a list of jobs." };
  const mine = await mineOf(sub);
  for (const raw of jobs.slice(0, MAX_JOBS)) {
    const job = clean(raw);
    if (!mine[job.id] && Object.keys(mine).length < MAX_JOBS) mine[job.id] = job;
  }
  await saveMine(sub, mine);
  return listSaved(sub);
}
