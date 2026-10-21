// AI Agent: crafts a résumé for one saved job from the student's Applicant's resources.
//
// Generate (Profile → My jobs → ✨ Generate on a saved job):
//   1. Job: the server fetches the posting's full description (Greenhouse, Lever, Ashby, Workday,
//      Eightfold sites like Microsoft…) and scores all of the student's resources against it.
//   2. Curate: Claude Code (server/agent/engine.js, or the author's Mac through the relay) picks and
//      orders the best experiences, projects, bullets and skills for the job.
//   3. Check: the reply is held to the resources (checkCuration).
//   4. Rebuild: a one-page PDF in EB Garamond (resumePdf.ts).
//   5. Score: that PDF is read back like any upload (personal details removed) and scored.
//      Below the target (85), one more round tries to fix what the score says held it back; the best
//      version is kept.
//   6. Report: the score, and suggestions for what to add to Applicant's resources to reach 85+.
//      The student adds real information and taps Generate again.
//
// Honesty rules, enforced here (not just in the prompt):
//   - Every bullet must come from a bullet in the resources. A reworded bullet can't introduce numbers
//     that aren't in its source, and placeholders are rejected (the original bullet is used instead).
//   - Skills must already be in the resources (the skill list or a bullet).
//   - Nothing is submitted for the student.

import { Bank, bankSections, bulletIndex, mergeSkills, sectionsFrom } from "./experienceBank";
import { runAtsDetailed } from "./ginny";
import { buildResumePdf, loadHeader, toBase64 } from "./resumePdf";
import { Curated, Result, TARGET } from "./agentResults";
import type { SavedJob } from "./savedJobs";

/** Claude Code's reply. */
export type RawCuration = {
  entries: { entryId: string; bullets: { bulletId: string; text: string }[] }[];
  skills: string[];
  note: string;
  suggestions: string[];
};

const MAX_ROUNDS = 2;
type Job = Pick<SavedJob, "id" | "title" | "company" | "url">;

// ---- Checking Claude Code's reply against the resources ----

const digits = (t: string) => t.match(/\d+(\.\d+)?/g) ?? [];
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();

/** Keeps only what the resources support. Returns null when nothing usable came back. */
export function checkCuration(raw: RawCuration, bank: Bank): Curated | null {
  const index = bulletIndex(bank);
  const entryById = new Map(bank.entries.map((e) => [e.id, e]));
  const used = new Set<string>();
  const entries: Curated["entries"] = [];

  for (const ce of raw.entries) {
    const entry = entryById.get(ce.entryId);
    if (!entry || !Array.isArray(ce.bullets)) continue;
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

  // Skills: only ones in the resources' list or written in a bullet.
  const bankText = norm([bank.skills.join(" "), ...bank.entries.flatMap((e) => e.bullets.map((b) => b.text))].join(" "));
  const skills = mergeSkills(
    [],
    raw.skills.filter((s) => bank.skills.some((k) => norm(k) === norm(s)) || (norm(s).length >= 2 && bankText.includes(norm(s)))),
  );

  return { entries, skills, note: raw.note || "", sections: sectionsFrom(entries, skills, bank.education) };
}

function toRaw(data: Partial<RawCuration> | null): RawCuration {
  if (!data || !Array.isArray(data.entries)) throw new Error("Claude Code's reply couldn't be read. Try Generate again.");
  return {
    entries: data.entries,
    skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
    note: typeof data.note === "string" ? data.note : "",
    suggestions: Array.isArray(data.suggestions) ? data.suggestions.map(String).filter((x) => x.trim()) : [],
  };
}

/** One curation round from Claude Code, run by the server. */
async function curateRound(
  job: Job,
  ctx: { requirements: string[]; missingSkills: string[]; gaps: string[] },
  bank: Bank,
  lastScore: number | null,
  round: number,
): Promise<RawCuration> {
  const res = await fetch("/api/agent/generate", {
    method: "POST",
    headers: { "X-Requested-With": "XmlHttpRequest", "Content-Type": "application/json" },
    body: JSON.stringify({ jobTitle: job.title, company: job.company, ...ctx, bank, target: TARGET, lastScore, round }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Generate couldn't finish. Try again.");
  return toRaw(data.curated);
}

/** What to add to Applicant's resources: Claude Code's suggestions, then what the ATS found missing. */
function suggestionsFor(claude: string[], missing: { skill: string; required: boolean }[], gaps: string[]): string[] {
  const out = [...claude];
  const required = missing.filter((m) => m.required).map((m) => m.skill);
  const nice = missing.filter((m) => !m.required).map((m) => m.skill);
  const mentioned = (s: string) => out.some((x) => norm(x).includes(norm(s)));
  const req = required.filter((s) => !mentioned(s)).slice(0, 6);
  if (req.length) out.push(`Required skills the résumé doesn't show: ${req.join(", ")}. Add them to Skills, or a bullet that uses them, if you have them.`);
  const opt = nice.filter((s) => !mentioned(s)).slice(0, 6);
  if (opt.length) out.push(`Nice-to-have skills: ${opt.join(", ")}.`);
  // Requirements with little evidence, when Claude Code's own suggestions don't already cover enough.
  for (const g of gaps.slice(0, Math.max(0, 4 - claude.length))) out.push(`Little evidence for: "${g.length > 160 ? `${g.slice(0, 157)}…` : g}". A bullet showing this would help.`);
  return out.slice(0, 8);
}

/**
 * ✨ Generate for one saved job: score the resources, curate with Claude Code, rebuild the PDF,
 * rescore (one more round if under the target), and report the best version with suggestions.
 */
export async function generateResume(signedIn: boolean, job: Job, bank: Bank, onStep: (msg: string) => void, previous?: Result): Promise<Result> {
  if (!bank.entries.some((e) => e.bullets.length)) throw new Error("Add your experience to Applicant's resources first.");

  onStep("Reading the job posting");
  const first = await runAtsDetailed(signedIn, job, { sections: bankSections(bank), description: previous?.description });
  const description = first.description.slice(0, 15000);
  const ctx = {
    requirements: first.result.requirements.slice(0, 14),
    missingSkills: first.result.missingSkills.slice(0, 15).map((m) => m.skill),
    gaps: first.result.gaps.slice(0, 6),
  };

  let best: { score: number; curated: Curated; missing: Result["missingSkills"]; gaps: string[]; claude: string[] } | null = null;
  const history: number[] = [];
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    onStep(round === 1 ? "Claude Code is writing your résumé" : `Round ${round}: improving it (scored ${best?.score})`);
    const raw = await curateRound(job, ctx, bank, best?.score ?? null, round);
    const curated = checkCuration(raw, bank);
    if (!curated) {
      if (best) break;
      throw new Error("Claude Code's résumé didn't match your resources. Try Generate again.");
    }
    onStep("Building the PDF and checking the ATS score");
    const pdf = await buildResumePdf(loadHeader(), curated, bank.education);
    curated.dropped = pdf.dropped;
    const { result } = await runAtsDetailed(signedIn, job, { pdfBase64: toBase64(pdf.bytes), description });
    history.push(result.score);
    if (!best || result.score > best.score) {
      best = { score: result.score, curated, missing: result.missingSkills.slice(0, 15), gaps: result.gaps.slice(0, 6), claude: raw.suggestions.slice(0, 5) };
    }
    if (best.score >= TARGET) break;
    // Next round: what this score says is still missing.
    ctx.missingSkills = result.missingSkills.slice(0, 15).map((m) => m.skill);
    ctx.gaps = result.gaps.slice(0, 6);
  }

  return {
    score: best!.score,
    baseline: first.result.score,
    history,
    curated: best!.curated,
    missingSkills: best!.missing,
    gaps: best!.gaps,
    suggestions: best!.score >= TARGET ? [] : suggestionsFor(best!.claude, best!.missing, best!.gaps),
    description,
    at: new Date().toISOString(),
  };
}

/** The curated résumé as plain text (the student adds their own name and contact header). */
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
