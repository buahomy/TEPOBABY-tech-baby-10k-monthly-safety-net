// Ginny (the "+" button): pick one saved job, then run ATS match analysis or Ask Gemini about it.

import { Answers, MONTHS, Profile } from "./profile";
import { SavedJob } from "./savedJobs";

const XHR = { "X-Requested-With": "XmlHttpRequest" };

export type GinnyStatus = {
  voyage: string | null;
  gemini: string | null;
  reranker: string;
  tiers: { id: string; label: string; about: string; min: number }[];
};

export type ResumeMeta = { fileName: string; uploadedAt: string; bytes?: number; redactions?: Record<string, number> };

export type AtsResult = {
  tier: { id: "strong" | "good" | "average" | "weak"; label: string; about: string };
  score: number;
  components: { skills: number | null; semantic: number | null; evidence: number | null };
  matchedSkills: string[];
  missingSkills: { skill: string; required: boolean }[];
  strengths: { requirement: string; bullet: string | null; score: number }[];
  gaps: string[];
  pipeline: {
    retrieval: string | null;
    retrievalNote: string | null;
    hardSkills: string;
    reranker: string;
    rerankMs: number;
    rerankPairs: number;
    totalMs: number;
  };
};

export type ChatMessage = { role: "user" | "model"; text: string; sources?: { title: string; url: string }[] };

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), data);
  return data as T;
}

export const getStatus = () => fetch("/api/ginny/status").then((r) => json<GinnyStatus>(r));

// ---- Selected job (one at a time) ----

const SELECTED_KEY = "tepobaby.selectedJobId";
export function loadSelectedJobId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}
export function saveSelectedJobId(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // ignore
  }
}

// ---- Resume: signed in → stored on the server; guest → stored on this device ----

const GUEST_RESUME_KEY = "tepobaby.resume";
type GuestResume = ResumeMeta & { base64: string };

function readGuestResume(): GuestResume | null {
  try {
    const raw = localStorage.getItem(GUEST_RESUME_KEY);
    return raw ? (JSON.parse(raw) as GuestResume) : null;
  } catch {
    return null;
  }
}
let guestResumeInMemory: GuestResume | null = null; // fallback when storage is full / blocked

export async function getResume(signedIn: boolean): Promise<ResumeMeta | null> {
  if (!signedIn) {
    const r = guestResumeInMemory || readGuestResume();
    return r && { fileName: r.fileName, uploadedAt: r.uploadedAt };
  }
  return (await json<{ resume: ResumeMeta | null }>(await fetch("/api/ginny/resume"))).resume;
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function uploadResume(signedIn: boolean, file: File): Promise<ResumeMeta> {
  if (file.type && file.type !== "application/pdf") throw new Error("Please upload a PDF.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Resume PDF must be under 5 MB.");
  if (signedIn) {
    const res = await fetch("/api/ginny/resume", {
      method: "PUT",
      headers: { ...XHR, "Content-Type": "application/pdf", "X-File-Name": file.name.replace(/[^\x20-\x7e]/g, "") },
      body: file,
    });
    return (await json<{ resume: ResumeMeta }>(res)).resume;
  }
  const r: GuestResume = { fileName: file.name, uploadedAt: new Date().toISOString(), base64: await toBase64(file) };
  try {
    localStorage.setItem(GUEST_RESUME_KEY, JSON.stringify(r));
    guestResumeInMemory = null;
  } catch {
    guestResumeInMemory = r; // too big for storage: keep it for this visit
  }
  return { fileName: r.fileName, uploadedAt: r.uploadedAt };
}

export async function deleteResume(signedIn: boolean) {
  guestResumeInMemory = null;
  try {
    localStorage.removeItem(GUEST_RESUME_KEY);
  } catch {
    // ignore
  }
  if (signedIn) await fetch("/api/ginny/resume", { method: "DELETE", headers: XHR });
}

// ---- ATS analysis ----

export async function runAts(signedIn: boolean, job: SavedJob, description?: string): Promise<AtsResult> {
  const body: Record<string, unknown> = { job: { title: job.title, company: job.company, url: job.url } };
  if (description) body.description = description;
  if (!signedIn) {
    const r = guestResumeInMemory || readGuestResume();
    if (r) body.resumePdf = r.base64;
  }
  const res = await fetch("/api/ginny/ats", {
    method: "POST",
    headers: { ...XHR, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await json<{ result: AtsResult }>(res)).result;
}

// ---- Ask Gemini ----

const VISA: Record<string, string> = {
  f1_cpt: "CPT (F-1)",
  f1_opt: "OPT / STEM OPT and H-1B",
  h1b: "H-1B",
  other_visa: "work visas like TN, J-1 or L-2",
  require_sponsorship: "visa sponsorship",
};

/** Non-identifying context Gemini gets about the student and job. */
export function chatContext(job: SavedJob, profile: Profile) {
  const a: Partial<Answers> = profile.answers;
  const status = a.workAuthStatus;
  return {
    role: job.title,
    company: job.company,
    location: job.location,
    level: a.academicLevel ? a.academicLevel[0].toUpperCase() + a.academicLevel.slice(1) : "",
    graduation: a.graduation ? `${MONTHS[a.graduation.month - 1]} ${a.graduation.year}` : "",
    visa: status === "us_citizen_pr" ? "U.S. citizen / permanent resident (no sponsorship needed)" : status ? (VISA[status] ?? "") : "",
  };
}

/** Suggested first questions, filled in from the selected job and the student's answers. */
export function suggestedQuestions(job: SavedJob, profile: Profile): string[] {
  const role = job.title;
  const company = job.company;
  const status = profile.answers.workAuthStatus;
  const visaQ =
    status && status !== "us_citizen_pr"
      ? `Does ${company} sponsor ${VISA[status] ?? "visas"} for ${role}? Explain in simple words.`
      : `Does ${company} require U.S. citizenship or a security clearance for ${role}? Explain in simple words.`;
  return [
    `${role} at ${company}: how many interview rounds are there, and what are they? Keep it simple.`,
    `According to Glassdoor interviews at ${company}, what questions does ${company} ask for ${role}? List NeetCode 150 problems to practice.`,
    visaQ,
  ];
}

export async function askGemini(messages: ChatMessage[], job: SavedJob, profile: Profile) {
  const res = await fetch("/api/ginny/chat", {
    method: "POST",
    headers: { ...XHR, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map(({ role, text }) => ({ role, text })),
      context: chatContext(job, profile),
    }),
  });
  return json<{ text: string; sources: { title: string; url: string }[] }>(res);
}

