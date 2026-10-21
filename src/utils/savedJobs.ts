// Saved / applied jobs. Signed-in students: stored on the server per account.
// Guests: stored in this browser, and moved into the account when they sign in.

import { useCallback, useEffect, useState } from "react";
import { Posting } from "./postings";

export type JobStatus = "saved" | "applied";

/** Where an applied job is in the hiring process. */
export const STAGES = [
  { id: "applied", label: "Applied" },
  { id: "oa", label: "OA" },
  { id: "phone", label: "Phone" },
  { id: "onsite", label: "On-site" },
  { id: "final", label: "Final" },
  { id: "team_match", label: "Team match" },
  { id: "offer", label: "Offer" },
  { id: "ghosted", label: "Ghosted" },
  { id: "not_proceeding", label: "Not proceeding" },
] as const;
export type Stage = (typeof STAGES)[number]["id"];

export type SavedJob = {
  id: string;
  company: string;
  title: string;
  url: string;
  location: string;
  domain: string | null;
  postedAt: string | null;
  source: string;
  status: JobStatus;
  savedAt: string;
  appliedAt: string | null;
  stage?: Stage | null;
  stageUpdatedAt?: string | null;
  /** The résumé's ATS score for this application, when the AI Agent prepared it. */
  ats?: AtsRecord | null;
};

export type AtsRecord = { score: number; firstScore: number; history: number[]; target: number | null; rounds: number; scoredAt: string | null; via: string };

const GUEST_KEY = "tepobaby.savedJobs";
const XHR = { "Content-Type": "application/json", "X-Requested-With": "XmlHttpRequest" };

export function fromPosting(p: Posting): SavedJob {
  return {
    id: p.id,
    company: p.company,
    title: p.title,
    url: p.url,
    location: p.location,
    domain: p.domain,
    postedAt: p.postedAt,
    source: p.source,
    status: "saved",
    savedAt: new Date().toISOString(),
    appliedAt: null,
    stage: null,
    stageUpdatedAt: null,
  };
}

// ---- Guest storage ----

function readGuest(): SavedJob[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as SavedJob[]) : [];
  } catch {
    return [];
  }
}

function writeGuest(jobs: SavedJob[]) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(jobs));
  } catch {
    // storage blocked (private browsing); keep in memory for this visit
  }
}

export function clearGuestSavedJobs() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    // ignore
  }
}

// ---- Server ----

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't update your saved jobs.");
  return data as T;
}

/** After a guest signs in: copy their device's saved jobs into the account, then forget them. */
export async function moveGuestSavedJobsToAccount(): Promise<void> {
  const jobs = readGuest();
  if (!jobs.length) return;
  await api("/api/saved/import", { method: "POST", headers: XHR, body: JSON.stringify({ jobs }) });
  clearGuestSavedJobs();
}

// ---- Hook shared by the Home and Profile tabs ----

export function useSavedJobs(signedIn: boolean) {
  const [jobs, setJobs] = useState<SavedJob[]>(() => (signedIn ? [] : readGuest()));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    api<{ jobs: SavedJob[] }>("/api/saved")
      .then((d) => setJobs(d.jobs))
      .catch((e: Error) => setError(e.message));
  }, [signedIn]);

  // Guests: every change is written to this browser.
  const commit = useCallback(
    (next: SavedJob[]) => {
      setJobs(next);
      if (!signedIn) writeGuest(next);
    },
    [signedIn],
  );

  const upsert = useCallback(
    async (job: SavedJob, current: SavedJob[]) => {
      // Update in place (no reshuffling); only brand-new saves go on top.
      const exists = current.some((j) => j.id === job.id);
      const optimistic = exists ? current.map((j) => (j.id === job.id ? job : j)) : [job, ...current];
      commit(optimistic);
      if (!signedIn) return;
      try {
        const { job: saved } = await api<{ job: SavedJob }>("/api/saved", {
          method: "PUT",
          headers: XHR,
          body: JSON.stringify({ job }),
        });
        setJobs((prev) => prev.map((j) => (j.id === saved.id ? saved : j)));
        setError("");
      } catch (e) {
        setJobs(current); // undo
        setError(e instanceof Error ? e.message : "Couldn't save that job.");
      }
    },
    [commit, signedIn],
  );

  const remove = useCallback(
    async (id: string, current: SavedJob[]) => {
      commit(current.filter((j) => j.id !== id));
      if (!signedIn) return;
      try {
        await api(`/api/saved/${encodeURIComponent(id)}`, { method: "DELETE", headers: XHR });
        setError("");
      } catch (e) {
        setJobs(current); // undo
        setError(e instanceof Error ? e.message : "Couldn't remove that job.");
      }
    },
    [commit, signedIn],
  );

  const isSaved = (id: string) => jobs.some((j) => j.id === id);

  return {
    jobs,
    error,
    isSaved,
    /** Heart button: save if not saved, unsave if saved. */
    toggle: (p: Posting) => (isSaved(p.id) ? remove(p.id, jobs) : upsert(fromPosting(p), jobs)),
    /** Applying: `ats` keeps the AI Agent's résumé score with the application. */
    setStatus: (id: string, status: JobStatus, ats?: AtsRecord) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      const now = new Date().toISOString();
      upsert(
        status === "applied"
          ? { ...job, status, appliedAt: job.appliedAt ?? now, stage: job.stage ?? "applied", stageUpdatedAt: job.stageUpdatedAt ?? now, ats: ats ?? job.ats ?? null }
          : { ...job, status, appliedAt: null, stage: null, stageUpdatedAt: null },
        jobs,
      );
    },
    /** Applied jobs: update the hiring stage (OA, phone, on-site, …). */
    setStage: (id: string, stage: Stage) => {
      const job = jobs.find((j) => j.id === id);
      if (job && job.stage !== stage) upsert({ ...job, stage, stageUpdatedAt: new Date().toISOString() }, jobs);
    },
    remove: (id: string) => remove(id, jobs),
  };
}

export type SavedJobsApi = ReturnType<typeof useSavedJobs>;
