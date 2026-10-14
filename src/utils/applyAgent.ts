// Apply agent (Profile → My jobs): every day, finds roles that fit the student's graduation, start
// date and visa, scores each with the ATS match, and tailors a copy of the resume until it reaches
// the target score (85 by default), or reports that it can't honestly get there.
//
// Honesty rules, enforced here:
//   - Rewrites come from Claude (the student's own Anthropic key) or Gemini, both told they may only
//     reword facts already in a bullet.
//   - Rewrites with a placeholder like [X%] are never applied until the student fills in a real value.
//   - Missing skills are only added after the student confirms they've used them.
//   - Nothing is submitted for the student: they open the posting, review, and submit.
//
// Progress lives on this device (localStorage).

import { claudeTailor } from "./claudeTailor";
import { AtsResult, ResumeSections, TailorTips, getTailorTipsFor, runAtsDetailed } from "./ginny";
import { Posting } from "./postings";

export type QueueRole = Posting & { fit: "match" | "open" | "later"; sponsorshipNote: "sponsors" | "unknown" | null };

export type Change = { original: string; improved: string; requirement: string };
export type Pending = { original: string; improved: string; requirement: string }; // has [placeholders]

export type RoleState = {
  status: "ready" | "below" | "applied" | "skipped" | "error";
  score: number;
  firstScore: number;
  rounds: number;
  description?: string; // kept while below target, to re-score without fetching again
  sections?: ResumeSections; // tailored copy (only when it differs from the base resume)
  changes: Change[];
  pending: Pending[];
  missingSkills: { skill: string; required: boolean }[];
  confirmedSkills: string[];
  gaps: string[];
  requirements: string[];
  error?: string;
  at: string;
};

export type AgentState = {
  target: number;
  base?: ResumeSections;
  roles: Record<string, RoleState>;
  lastAutoRun?: string; // YYYY-MM-DD
};

const KEY = "tepobaby.applyAgent.v1";
export const MAX_ROUNDS = 3;

export function loadAgent(): AgentState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && typeof s === "object" && s.roles) return { target: 85, ...s };
  } catch {
    // ignore
  }
  return { target: 85, roles: {} };
}

export function saveAgent(s: AgentState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full: drop stored job descriptions (they can be fetched again) and retry.
    try {
      const slim = { ...s, roles: Object.fromEntries(Object.entries(s.roles).map(([k, r]) => [k, { ...r, description: undefined }])) };
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      // give up quietly; state stays in memory for this visit
    }
  }
}

export const today = () => new Date().toISOString().slice(0, 10);

const HAS_PLACEHOLDER = /\[[^\]]{1,40}\]/;

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

const clone = (s: ResumeSections): ResumeSections => ({
  experience: [...s.experience],
  projects: [...s.projects],
  skills: [...s.skills],
  education: [...s.education],
});

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Replaces one bullet with its rewrite. Returns false if the original bullet isn't found. */
function replaceLine(s: ResumeSections, original: string, improved: string): boolean {
  const target = norm(original);
  if (!target) return false;
  for (const k of ["experience", "projects", "skills", "education"] as const) {
    const i = s[k].findIndex((l) => norm(l) === target || (target.length > 30 && norm(l).includes(target)));
    if (i >= 0) {
      s[k][i] = improved;
      return true;
    }
  }
  return false;
}

/** Adds skills the student confirmed to the Skills section. */
function addSkills(s: ResumeSections, skills: string[]) {
  const have = norm(s.skills.join(" "));
  const add = skills.filter((k) => !have.includes(norm(k)));
  if (add.length) s.skills.push(`Additional: ${add.join(", ")}`);
}

function stateFrom(result: AtsResult, prev: Partial<RoleState>, target: number, description: string, sections?: ResumeSections): RoleState {
  const below = result.score < target;
  return {
    status: below ? "below" : "ready",
    score: result.score,
    firstScore: prev.firstScore ?? result.score,
    rounds: prev.rounds ?? 0,
    description: below ? description.slice(0, 15000) : undefined,
    sections,
    changes: prev.changes ?? [],
    pending: prev.pending ?? [],
    missingSkills: result.missingSkills.slice(0, 12),
    confirmedSkills: prev.confirmedSkills ?? [],
    gaps: result.gaps.slice(0, 4),
    requirements: result.requirements.slice(0, 12),
    at: new Date().toISOString(),
  };
}

/** First ATS check of a role. Also captures the base resume sections the first time. */
export async function checkRole(signedIn: boolean, role: QueueRole, agent: AgentState): Promise<{ state: RoleState; base: ResumeSections }> {
  const { result, description, sections } = await runAtsDetailed(signedIn, role, agent.base ? { sections: agent.base } : {});
  return { state: stateFrom(result, {}, agent.target, description), base: agent.base ?? sections };
}

/**
 * One improvement round: asks Gemini for rewrites of the current tailored copy, applies the ones that
 * need no new facts, queues the ones with [placeholders] for the student, and re-scores.
 */
/** Which model writes the rewrites: Claude on the student's own key, or Gemini through Tepobaby. */
export type Writer = { kind: "claude"; apiKey: string } | { kind: "gemini" };

/** The resume as text, in the same shape the server sends to Gemini. */
const sectionText = (s: ResumeSections) =>
  (Object.entries(s) as [string, string[]][])
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k.toUpperCase()}\n${v.join("\n")}`)
    .join("\n\n");

async function tipsFor(writer: Writer, role: QueueRole, st: RoleState, current: ResumeSections): Promise<TailorTips> {
  const facts = { requirements: st.requirements, missingSkills: st.missingSkills, gaps: st.gaps };
  if (writer.kind === "gemini") return getTailorTipsFor(role, facts, current);
  return claudeTailor(writer.apiKey, {
    jobTitle: role.title,
    company: role.company,
    requirements: facts.requirements,
    missingSkills: facts.missingSkills.map((m) => m.skill),
    gaps: facts.gaps,
    resumeText: sectionText(current),
  });
}

export async function improveRole(signedIn: boolean, role: QueueRole, st: RoleState, agent: AgentState, writer: Writer): Promise<RoleState> {
  const current = clone(st.sections ?? agent.base!);
  const tips = await tipsFor(writer, role, st, current);

  const changes = [...st.changes];
  const pending = [...st.pending];
  for (const r of tips.rewrites) {
    if (!r.original || !r.improved || r.original === r.improved) continue;
    if (HAS_PLACEHOLDER.test(r.improved)) {
      if (!pending.some((p) => p.original === r.original)) pending.push(r);
      continue;
    }
    if (replaceLine(current, r.original, r.improved)) changes.push({ original: r.original, improved: r.improved, requirement: r.requirement });
  }

  const { result, description } = await runAtsDetailed(signedIn, role, { sections: current, description: st.description });
  const next = stateFrom(result, { ...st, changes, pending, rounds: st.rounds + 1 }, agent.target, description || st.description || "", current);
  // Keep the best version: a round that lowers the score is undone.
  if (result.score < st.score && st.sections) return { ...st, rounds: st.rounds + 1, pending, at: next.at };
  return next;
}

/** Applies what the student filled in / confirmed, then re-scores. */
export async function applyStudentInput(
  signedIn: boolean,
  role: QueueRole,
  st: RoleState,
  agent: AgentState,
  filled: { original: string; improved: string }[],
  skills: string[],
): Promise<RoleState> {
  const current = clone(st.sections ?? agent.base!);
  const changes = [...st.changes];
  for (const f of filled) {
    if (HAS_PLACEHOLDER.test(f.improved)) continue;
    const p = st.pending.find((x) => x.original === f.original);
    if (replaceLine(current, f.original, f.improved)) changes.push({ original: f.original, improved: f.improved, requirement: p?.requirement || "" });
  }
  const confirmed = [...new Set([...st.confirmedSkills, ...skills])];
  addSkills(current, skills);
  const pending = st.pending.filter((p) => !filled.some((f) => f.original === p.original && !HAS_PLACEHOLDER.test(f.improved)));
  const { result, description } = await runAtsDetailed(signedIn, role, { sections: current, description: st.description });
  return stateFrom(result, { ...st, changes, pending, confirmedSkills: confirmed }, agent.target, description || st.description || "", current);
}

/** The tailored resume as plain text (personal details were removed; the student adds their header). */
export function resumeText(s: ResumeSections): string {
  const block = (title: string, lines: string[]) => (lines.length ? `${title}\n${lines.map((l) => `• ${l}`).join("\n")}` : "");
  return [block("EXPERIENCE", s.experience), block("PROJECTS", s.projects), block("SKILLS", s.skills), block("EDUCATION", s.education)].filter(Boolean).join("\n\n");
}
