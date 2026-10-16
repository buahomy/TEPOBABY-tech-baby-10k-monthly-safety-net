// AI Agent (Profile → My jobs). Every day it finds roles that fit the student, checks each one, and for
// each role runs this pipeline:
//   1. Job text: fetched by the server from the posting's own API (Greenhouse, Lever, Ashby, Workday,
//      Microsoft…).
//   2. Curate: Claude (or Gemini) builds a one-page resume for this job from the experience bank,
//      rewording and reordering only.
//   3. Rebuild: the resume becomes a one-page PDF in EB Garamond (resumePdf.ts).
//   4. Rescore: that PDF is read back exactly like an uploaded resume (text, personal details removed)
//      and scored by the ATS match (BM25 skills + Voyage AI semantic fit + evidence).
//   5. Repeat with the score's feedback until it reaches the target (85 by default) or changes stop
//      helping; if only the student's real experience can help, they're asked specific questions.
//   6. Ready to apply: the PDF, form answers and the posting link.
//
// Honesty rules, enforced here (not just in the prompt):
//   - Every bullet must come from a bullet in the bank. A reworded bullet can't introduce numbers that
//     aren't in its source, and placeholders are rejected (the original bullet is used instead).
//   - Skills must already be in the bank (its skill list or its bullets).
//   - New facts only come from the student's own answers, which are added to the bank.
//   - Nothing is submitted for the student.

import { claudeCurate, RawCuration } from "./claude";
import { Bank, BankEntry, bankSections, bulletIndex, mergeSkills, sectionsFrom, uid } from "./experienceBank";
import { ResumeSections, runAtsDetailed } from "./ginny";
import { Posting } from "./postings";
import { buildResumePdf, loadHeader, toBase64 } from "./resumePdf";

export type QueueRole = Posting & { fit: "match" | "open" | "later"; sponsorshipNote: "sponsors" | "unknown" | null };

export type Question = { id: string; question: string; kind: "skill" | "detail"; skill: string; entryId: string };

export type Curated = {
  entries: { entryId: string; kind: BankEntry["kind"]; title: string; org: string; dates: string; bullets: { bulletId: string; text: string; original: string }[] }[];
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
  description?: string;
  requirements: string[];
  missingSkills: { skill: string; required: boolean }[];
  gaps: string[];
  curated?: Curated;
  questions: Question[];
  error?: string;
  at: string;
};

export type AgentState = { target: number; roles: Record<string, RoleState>; lastAutoRun?: string };

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

// ---- Who curates ----

/** Claude on the student's own key when they've added one; otherwise Gemini through Tepobaby. */
export type Writer = { claudeKey: string | null };

/** Gemini can't answer right now and there's no Anthropic key to switch to. */
export class NeedClaudeKeyError extends Error {}

async function geminiCurate(input: Parameters<typeof claudeCurate>[1]): Promise<RawCuration> {
  const res = await fetch("/api/agent/curate", {
    method: "POST",
    headers: { "X-Requested-With": "XmlHttpRequest", "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, jobTitle: input.jobTitle, bank: input.bank }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ([429, 502, 503, 504].includes(res.status)) throw new NeedClaudeKeyError(`${data.error || "Gemini is unavailable right now."} Add your Anthropic API key so Claude can keep going.`);
    throw new Error(data.error || "Couldn't curate this resume.");
  }
  const c = data.curated || {};
  return { entries: c.entries || [], skills: c.skills || [], note: c.note || "", questions: c.questions || [] };
}

const curate = (writer: Writer, input: Parameters<typeof claudeCurate>[1]) => (writer.claudeKey ? claudeCurate(writer.claudeKey, input) : geminiCurate(input));

// ---- Checking what the model returned against the bank ----

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
    if (bullets.length) entries.push({ entryId: entry.id, kind: entry.kind, title: entry.title, org: entry.org, dates: entry.dates, bullets });
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

// ---- The loop ----

/**
 * Curates and re-scores until the target, the round limit, or a point where only the student's real
 * experience can help. `onRound` reports progress after each round.
 */
export async function runLoop(
  signedIn: boolean,
  role: QueueRole,
  start: RoleState,
  bank: Bank,
  target: number,
  writer: Writer,
  onRound: (st: RoleState, msg: string) => void,
  stopped: () => boolean,
): Promise<RoleState> {
  let st: RoleState = { ...start, status: "working", questions: [] };
  let best = st.curated ? st.score : -1;
  let stale = 0; // rounds in a row that didn't raise the score

  while (st.rounds < MAX_ROUNDS && !stopped()) {
    const round = st.rounds + 1;
    onRound(st, `${writer.claudeKey ? "Claude" : "Gemini"} is curating ${role.company}, round ${round}`);
    const raw = await curate(writer, {
      jobTitle: role.title,
      company: role.company,
      requirements: st.requirements,
      missingSkills: st.missingSkills.map((m) => m.skill),
      gaps: st.gaps,
      bank,
      target,
      lastScore: st.history.length ? st.score : null,
      round,
    });
    const curated = checkCuration(raw, bank);
    const questions = toQuestions(raw.questions, bank);
    if (!curated) {
      st = { ...st, rounds: round, questions };
      continue;
    }

    // Rebuild the one-page PDF and score that PDF, read back like any uploaded resume.
    onRound(st, `Rebuilding the PDF and rescoring ${role.company}, round ${round}`);
    const pdf = await buildResumePdf(loadHeader(), curated, bank.education);
    curated.dropped = pdf.dropped;
    const { result } = await runAtsDetailed(signedIn, role, { pdfBase64: toBase64(pdf.bytes), description: st.description });
    const improved = result.score > best;
    stale = improved ? 0 : stale + 1;
    st = {
      ...st,
      rounds: round,
      history: [...st.history, result.score],
      // Keep the best version: a round that scores lower is discarded.
      ...(improved ? { score: result.score, curated, missingSkills: result.missingSkills.slice(0, 15), gaps: result.gaps.slice(0, 6) } : {}),
      questions,
      at: new Date().toISOString(),
    };
    if (improved) best = result.score;

    if (st.score >= target) return { ...st, status: "ready", questions: [] };
    // Stuck and the model needs facts the bank doesn't have: ask the student now.
    if (!improved && questions.length) return { ...st, status: "needs_info" };
    // Changes stopped helping: two rounds in a row without a higher score.
    if (stale >= 2) break;
  }
  if (stopped()) return st;
  return { ...st, status: st.score >= target ? "ready" : st.questions.length ? "needs_info" : "topped" };
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
