// AI Agent: the résumé-curation instructions the student hands to Claude Code. The app builds one
// prompt per round (rules + experience bank + job + last score); the student pastes it into Claude
// Code and pastes the JSON reply back, which the app checks against the bank before using it.
//
// The model picks and orders material from the student's experience bank for one job. It may only
// reword a bullet using facts already in it, may only list skills already in the bank, and asks the
// student for real details when the bank can't support the job's requirements.

export const CURATE_SYSTEM = [
  "You are a senior tech recruiter curating a one-page resume for a U.S. college student, for one specific job.",
  "You get the student's EXPERIENCE BANK (every experience, project, bullet and skill they have, merged from all their resume versions and anything they typed), and the job's requirements.",
  "Your job: choose and order the most relevant entries and bullets, reword bullets to match the job's language, and pick the skills to list.",
  "Hard rules:",
  "- Use only bullet IDs and entry IDs that exist in the bank. Every bullet you output must name the bullet it came from.",
  "- A reworded bullet may only use facts in its source bullet: same tools, same numbers, same scope. Never add a tool, number, employer, result or responsibility that isn't in that bullet.",
  "- No placeholders like [X%]. If a number or detail would help but isn't in the bank, ask the student for it in `questions` instead.",
  "- Skills: only skills already in the bank's skill list or named in a bank bullet.",
  "- Use the job's exact keywords only where the source bullet truly supports them.",
  "- One page: at most 3 experiences with 2–5 bullets each, and at most 2 projects with 1–3 bullets each. Most relevant first.",
  "- Each bullet: under 30 words, starts with a strong action verb, shows action → what → result.",
  "- questions: when the job needs something the bank doesn't show (a required skill, a metric, a missing responsibility), ask up to 4 short, specific questions about the student's REAL experience. kind 'skill' asks whether they've used one skill (set `skill`); kind 'detail' asks for a fact (set `entryId` to the entry it belongs to, or empty). Ask nothing if the bank already covers the job.",
].join("\n");

const bankText = (bank) =>
  [
    ...bank.entries.map((e) =>
      [
        `ENTRY ${e.id} [${e.kind}] ${[e.title, e.org].filter(Boolean).join(", ")}${e.dates ? ` (${e.dates})` : ""}`,
        ...e.bullets.map((b) => `  - ${b.id}: ${b.text}`),
      ].join("\n"),
    ),
    `SKILLS: ${bank.skills.join(", ") || "(none)"}`,
  ].join("\n\n");

/**
 * The user prompt for one curation round.
 * @param {{ jobTitle: string, company: string, requirements: string[], missingSkills: string[], gaps: string[],
 *   bank: { entries: { id: string, kind: string, title: string, org: string, dates: string, bullets: { id: string, text: string }[] }[], skills: string[] },
 *   target: number, lastScore?: number | null, round: number }} p
 */
export function curatePrompt(p) {
  return [
    `Job: ${p.jobTitle} at ${p.company}`,
    `Requirements:\n${p.requirements.map((r) => `- ${r}`).join("\n") || "(not listed)"}`,
    p.lastScore != null
      ? `Round ${p.round}. The previous curated resume scored ${p.lastScore}/100 on the ATS match; the target is ${p.target}. Fix what held it back.`
      : `Round ${p.round}. Target ATS match: ${p.target}/100.`,
    p.missingSkills.length ? `Skills the ATS found missing: ${p.missingSkills.join(", ")}` : "",
    p.gaps.length ? `Requirements with little evidence:\n${p.gaps.map((g) => `- ${g}`).join("\n")}` : "",
    `EXPERIENCE BANK:\n${bankText(p.bank)}`,
    "Return the curated resume as JSON: entries (entryId + bullets with bulletId and text), skills, a one-sentence note, and questions.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The JSON shape Claude Code replies with. */
export const CURATE_SHAPE =
  '{"entries": [{"entryId": "e1", "bullets": [{"bulletId": "b3", "text": "reworded or original bullet"}]}], "skills": ["..."], "note": "one sentence", "questions": [{"question": "...", "kind": "skill" | "detail", "skill": "", "entryId": ""}]}';

/** The whole prompt to paste into Claude Code for one round. */
export function claudeCodePrompt(p) {
  return [
    CURATE_SYSTEM,
    "",
    curatePrompt(p),
    "",
    `Reply with ONLY the JSON, no other text, in exactly this shape:\n${CURATE_SHAPE}`,
  ].join("\n");
}
