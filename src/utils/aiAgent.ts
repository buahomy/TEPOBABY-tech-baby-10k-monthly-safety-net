// AI Agent (Profile → My jobs). Every day it finds roles that fit the student and checks each one
// against their experience bank. Then, per role, one round at a time:
//   1. Job text: fetched by the server from the posting's own API (Greenhouse, Lever, Ashby, Workday,
//      Eightfold sites like Microsoft…).
//   2. Curate with Claude: "Generate" asks the server for each round (Claude Code headless when
//      Tepobaby runs on a computer with Claude Code, else the Claude API on the live site; see
//      server/agent/engine.js). Without either, the student copies the prompt into Claude Code and
//      pastes the JSON reply back.
//   3. Check: the reply is held to the bank (checkCuration).
//   4. Rebuild: a one-page PDF in EB Garamond (resumePdf.ts).
//   5. Rescore: that PDF is read back like any upload (personal details removed) and scored
//      (BM25 skills + Voyage AI semantic fit + reranker evidence).
//   6. Next: ready at the target (85 by default); otherwise a new prompt with the new score, until
//      changes stop helping; if only real experience can help, the student is asked questions.
//
// Honesty rules, enforced here (not just in the prompt):
//   - Every bullet must come from a bullet in the bank. A reworded bullet can't introduce numbers that
//     aren't in its source, and placeholders are rejected (the original bullet is used instead).
//   - Skills must already be in the bank (its skill list or its bullets).
//   - New facts only come from the student's own answers, which are added to the bank.
//   - Nothing is submitted for the student.

import { claudeCodePrompt } from "../../shared/agentPrompt.js";
import { Bank, BankEntry, bankSections, bulletIndex, mergeSkills, sectionsFrom, uid } from "./experienceBank";
import { ResumeSections, runAtsDetailed } from "./ginny";
import { Posting } from "./postings";
import { buildResumePdf, loadHeader, toBase64 } from "./resumePdf";

/** Claude Code's reply, as parsed from the JSON the student pastes back. */
export type RawCuration = {
  entries: { entryId: string; bullets: { bulletId: string; text: string }[] }[];
  skills: string[];
  note: string;
  questions: { question: string; kind: "skill" | "detail"; skill: string; entryId: string }[];
};

export type QueueRole = Posting & { fit: "match" | "open" | "later"; sponsorshipNote: "sponsors" | "unknown" | null };

export type Question = { id: string; question: string; kind: "skill" | "detail"; skill: string; entryId: string };

export type Curated = {
  entries: { entryId: string; kind: BankEntry["kind"]; title: string; org: string; dates: string; link?: string; bullets: { bulletId: string; text: string; original: string }[] }[];
  skills: string[];
  note: string;
  sections: ResumeSections;
  dropped?: number; // bullets left out to keep the PDF to one page
};

export type RoleState = {
  status: "working" | "ready" | "needs_info" | "topped" | "applied" | "skipped" | "error";
  score: number;
  firstScore: number;
  history: number[]; // score after each curation round
  rounds: number;
  stale?: number; // rounds in a row that didn't raise the score
  description?: string;
  requirements: string[];
  missingSkills: { skill: string; required: boolean }[];
  gaps: string[];
  curated?: Curated;
  questions: Question[];
  error?: string;
  at: string;
};

export type AgentState = {
  target: number;
  roles: Record<string, RoleState>;
  lastAutoRun?: string;
  auto?: boolean; // check new roles automatically once a day (default on)
  picked?: Record<string, QueueRole>; // saved jobs the student added to the agent by hand
};

const KEY = "tepobaby.aiAgent.v1";
export const MAX_ROUNDS = 4;
export const today = () => new Date().toISOString().slice(0, 10);

export function loadAgent(): AgentState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s?.roles) return { target: 85, ...s };
  } catch {
    // ignore
  }
  return { target: 85, roles: {} };
}

export function saveAgent(s: AgentState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    try {
      // Storage full: drop job descriptions (they can be fetched again) and retry.
      localStorage.setItem(KEY, JSON.stringify({ ...s, roles: Object.fromEntries(Object.entries(s.roles).map(([k, r]) => [k, { ...r, description: undefined }])) }));
    } catch {
      // keep it in memory for this visit
    }
  }
}

export async function fetchQueue(p: { gradYear: number; gradMonth: number; startYear: number; startMonth: number; needsSponsorship: boolean }): Promise<QueueRole[]> {
  const q = new URLSearchParams({
    gradYear: String(p.gradYear),
    gradMonth: String(p.gradMonth),
    startYear: String(p.startYear),
    startMonth: String(p.startMonth),
    visa: p.needsSponsorship ? "1" : "0",
  });
  const res = await fetch(`/api/apply/queue?${q}`);
  if (!res.ok) throw new Error("Couldn't load today's roles.");
  return (await res.json()).roles;
}

const blank = (): Omit<RoleState, "status" | "score" | "firstScore" | "at"> => ({ history: [], rounds: 0, requirements: [], missingSkills: [], gaps: [], questions: [] });

/** First check of a role: the whole experience bank against the job. */
export async function checkRole(signedIn: boolean, role: QueueRole, bank: Bank, target: number): Promise<RoleState> {
  const { result, description } = await runAtsDetailed(signedIn, role, { sections: bankSections(bank) });
  return {
    ...blank(),
    status: result.score >= target ? "ready" : "working",
    score: result.score,
    firstScore: result.score,
    description: description.slice(0, 15000),
    requirements: result.requirements.slice(0, 14),
    missingSkills: result.missingSkills.slice(0, 15),
    gaps: result.gaps.slice(0, 6),
    at: new Date().toISOString(),
  };
}

export const errorState = (message: string): RoleState => ({ ...blank(), status: "error", score: 0, firstScore: 0, error: message, at: new Date().toISOString() });

// ---- Checking Claude Code's reply against the bank ----

const digits = (t: string) => t.match(/\d+(\.\d+)?/g) ?? [];
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();

/** Keeps only what the bank supports. Returns null when nothing usable came back. */
export function checkCuration(raw: RawCuration, bank: Bank): Curated | null {
  const index = bulletIndex(bank);
  const entryById = new Map(bank.entries.map((e) => [e.id, e]));
  const used = new Set<string>();
  const entries: Curated["entries"] = [];

  for (const ce of raw.entries) {
    const entry = entryById.get(ce.entryId);
    if (!entry) continue;
    const bullets: Curated["entries"][number]["bullets"] = [];
    for (const cb of ce.bullets) {
      const hit = index.get(cb.bulletId);
      if (!hit || hit.entry.id !== entry.id || used.has(cb.bulletId)) continue;
      used.add(cb.bulletId);
      const original = hit.bullet.text;
      let text = (cb.text || "").trim();
      const srcDigits = new Set(digits(original));
      // Reject rewrites that add numbers, use placeholders, or ramble; fall back to the student's words.
      if (!text || text.length > 400 || /\[[^\]]*\]/.test(text) || digits(text).some((d) => !srcDigits.has(d))) text = original;
      bullets.push({ bulletId: cb.bulletId, text, original });
    }
    if (bullets.length) entries.push({ entryId: entry.id, kind: entry.kind, title: entry.title, org: entry.org, dates: entry.dates, link: entry.link, bullets });
  }
  if (!entries.length) return null;

  // Skills: only ones in the bank's list or written in a bank bullet.
  const bankText = norm([bank.skills.join(" "), ...bank.entries.flatMap((e) => e.bullets.map((b) => b.text))].join(" "));
  const skills = mergeSkills(
    [],
    raw.skills.filter((s) => bank.skills.some((k) => norm(k) === norm(s)) || (norm(s).length >= 2 && bankText.includes(norm(s)))),
  );

  return { entries, skills, note: raw.note || "", sections: sectionsFrom(entries, skills, bank.education) };
}

const toQuestions = (raw: RawCuration["questions"], bank: Bank): Question[] =>
  raw
    .filter((q) => q.question?.trim())
    .slice(0, 4)
    .map((q) => ({
      id: uid("q"),
      question: q.question.trim(),
      kind: q.kind === "skill" && q.skill?.trim() ? "skill" : "detail",
      skill: q.skill?.trim() || "",
      entryId: bank.entries.some((e) => e.id === q.entryId) ? q.entryId : "",
    }));

// ---- One round ----

/** The prompt to paste into Claude Code for this role's next round. */
export function nextPrompt(role: QueueRole, st: RoleState, bank: Bank, target: number): string {
  return claudeCodePrompt({
    jobTitle: role.title,
    company: role.company,
    requirements: st.requirements,
    missingSkills: st.missingSkills.map((m) => m.skill),
    gaps: st.gaps,
    bank,
    target,
    lastScore: st.history.length ? st.score : null,
    round: st.rounds + 1,
  });
}

/** One round from the server's engine (Claude Code locally, the Claude API on the live site). */
export async function generateRound(role: QueueRole, st: RoleState, bank: Bank, target: number): Promise<RawCuration> {
  const res = await fetch("/api/agent/generate", {
    method: "POST",
    headers: { "X-Requested-With": "XmlHttpRequest", "Content-Type": "application/json" },
    body: JSON.stringify({
      jobTitle: role.title,
      company: role.company,
      requirements: st.requirements,
      missingSkills: st.missingSkills.map((m) => m.skill),
      gaps: st.gaps,
      bank,
      target,
      lastScore: st.history.length ? st.score : null,
      round: st.rounds + 1,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Generate couldn't finish this round.");
  return parseReply(JSON.stringify(data.curated));
}

/**
 * "Generate": curate → rebuild PDF → rescore, back to back, until the role is ready, needs the
 * student's info, or stops improving. `onRound` reports each round.
 */
export async function runGenerate(
  signedIn: boolean,
  role: QueueRole,
  start: RoleState,
  bank: Bank,
  target: number,
  onRound: (st: RoleState, msg: string) => void,
  stopped: () => boolean,
): Promise<RoleState> {
  let st: RoleState = { ...start, status: "working" };
  while (st.status === "working" && !stopped()) {
    onRound(st, `Round ${st.rounds + 1}: Claude is writing ${role.company}'s resume`);
    const raw = await generateRound(role, st, bank, target);
    onRound(st, `Round ${st.rounds + 1}: rebuilding the PDF and checking the ATS score`);
    st = await scoreReply(signedIn, role, st, bank, target, raw);
    onRound(st, `Round ${st.rounds}: scored ${st.history[st.history.length - 1]}`);
  }
  return st;
}

/** A saved job, as a role the agent can work on. */
export const roleFromSaved = (j: { id: string; company: string; title: string; url: string; location: string; domain: string | null; postedAt: string | null; source: string }): QueueRole => ({
  id: j.id,
  source: j.source,
  company: j.company,
  title: j.title,
  location: j.location,
  url: j.url,
  postedAt: j.postedAt || new Date().toISOString(),
  postedApprox: true,
  level: "entry",
  sponsorship: null,
  domain: j.domain,
  fit: "open",
  sponsorshipNote: null,
});

/** Reads Claude Code's pasted reply (tolerates code fences or text around the JSON). */
export function parseReply(text: string): RawCuration {
  const raw = text.replace(/```(json)?/gi, "").trim();
  let data: Partial<RawCuration> | null = null;
  try {
    data = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        data = JSON.parse(m[0]);
      } catch {
        data = null;
      }
    }
  }
  if (!data || !Array.isArray(data.entries)) throw new Error("That doesn't look like Claude Code's JSON reply. Copy its whole answer and paste it again.");
  return {
    entries: data.entries,
    skills: Array.isArray(data.skills) ? data.skills : [],
    note: typeof data.note === "string" ? data.note : "",
    questions: Array.isArray(data.questions) ? data.questions : [],
  };
}

/**
 * One round: holds the reply to the bank, rebuilds the one-page PDF, rescores that PDF, and decides
 * what's next (ready, another round, questions for the student, or tops out).
 */
export async function scoreReply(signedIn: boolean, role: QueueRole, st: RoleState, bank: Bank, target: number, raw: RawCuration): Promise<RoleState> {
  const round = st.rounds + 1;
  const curated = checkCuration(raw, bank);
  const questions = toQuestions(raw.questions, bank);
  if (!curated) throw new Error("None of the reply's bullets match your experience bank. Copy a fresh prompt and try again.");

  const pdf = await buildResumePdf(loadHeader(), curated, bank.education);
  curated.dropped = pdf.dropped;
  const { result } = await runAtsDetailed(signedIn, role, { pdfBase64: toBase64(pdf.bytes), description: st.description });
  const best = st.curated ? st.score : -1;
  const improved = result.score > best;
  const stale = improved ? 0 : (st.stale ?? 0) + 1;
  const next: RoleState = {
    ...st,
    rounds: round,
    stale,
    history: [...st.history, result.score],
    // Keep the best version: a round that scores lower is discarded.
    ...(improved ? { score: result.score, curated, missingSkills: result.missingSkills.slice(0, 15), gaps: result.gaps.slice(0, 6) } : {}),
    questions,
    at: new Date().toISOString(),
  };
  if (next.score >= target) return { ...next, status: "ready", questions: [] };
  if (!improved && questions.length) return { ...next, status: "needs_info" };
  // Changes stopped helping: two rounds in a row without a higher score, or the round limit.
  if (stale >= 2 || round >= MAX_ROUNDS) return { ...next, status: questions.length ? "needs_info" : "topped" };
  return { ...next, status: "working" };
}

/** Adds the student's answers to the bank: skills they've used, and new bullets with real details. */
export function addAnswers(bank: Bank, questions: Question[], answers: Record<string, { yes?: boolean; text?: string }>): Bank {
  let skills = bank.skills;
  const entries = bank.entries.map((e) => ({ ...e, bullets: [...e.bullets] }));
  let extra = entries.find((e) => e.title === "Added from your answers");
  for (const q of questions) {
    const a = answers[q.id];
    if (!a) continue;
    if (q.kind === "skill" && a.yes) skills = mergeSkills(skills, [q.skill]);
    const text = a.text?.trim();
    if (!text) continue;
    const target = entries.find((e) => e.id === q.entryId);
    if (target) target.bullets.push({ id: uid("b"), text, source: "your answer" });
    else {
      if (!extra) {
        extra = { id: uid("e"), kind: "experience", title: "Added from your answers", org: "", dates: "", bullets: [] };
        entries.push(extra);
      }
      extra.bullets.push({ id: uid("b"), text, source: "your answer" });
    }
  }
  return { ...bank, entries, skills };
}

/** The curated resume as plain text (the student adds their own name and contact header). */
export function resumeText(c: Curated, education: string[]): string {
  const block = (title: string, kind: (k: string) => boolean) => {
    const list = c.entries.filter((e) => kind(e.kind));
    if (!list.length) return "";
    return `${title}\n${list
      .map((e) => `${[e.title, e.org].filter(Boolean).join(", ")}${e.dates ? ` (${e.dates})` : ""}\n${e.bullets.map((b) => `• ${b.text}`).join("\n")}`)
      .join("\n\n")}`;
  };
  return [
    block("EXPERIENCE", (k) => k !== "project"),
    block("PROJECTS", (k) => k === "project"),
    c.skills.length ? `SKILLS\n${c.skills.join(", ")}` : "",
    education.length ? `EDUCATION\n${education.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
