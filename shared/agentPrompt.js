// AI Agent: the résumé-curation instructions for Claude Code. For one saved job, the app sends the
// student's Applicant's resources (every experience, project, bullet and skill) and the job's
// requirements; Claude Code picks and orders the best material, and the app checks the reply against
// the resources before using it.
//
// The model may only reword a bullet using facts already in it, may only list skills already in the
// resources, and suggests what real information the student could add to reach the target score.

export const CURATE_SYSTEM = [
  "You are a senior tech recruiter curating a one-page resume for a U.S. college student, for one specific job.",
  "You get the student's APPLICANT'S RESOURCES (every experience, project, bullet and skill they have) and the job's requirements.",
  "Your job: choose and order the most relevant entries and bullets, reword bullets to match the job's language, and pick the skills to list.",
  "Hard rules:",
  "- Use only bullet IDs and entry IDs that exist in the bank. Every bullet you output must name the bullet it came from.",
  "- A reworded bullet may only use facts in its source bullet: same tools, same numbers, same scope. Never add a tool, number, employer, result or responsibility that isn't in that bullet.",
  "- No placeholders like [X%]. If a number or detail would help but isn't in the resources, say so in `suggestions` instead.",
  "- Skills: only skills already in the bank's skill list or named in a bank bullet.",
  "- Use the job's exact keywords only where the source bullet truly supports them.",
  "- One page: at most 3 experiences with 2–5 bullets each, and at most 2 projects with 1–3 bullets each. Most relevant first.",
  "- Each bullet: under 30 words, starts with a strong action verb, shows action → what → result.",
  "- suggestions: up to 5 short, specific things the student could add to their Applicant's resources to reach the target score, only if true for them: a required skill or tool, a metric on a named bullet, a responsibility or kind of project the job asks for. Write them to the student: name an entry by its title and organization (never by ID), quote a few words of a bullet to point at it, and don't say 'bank'. Empty if the resources already cover the job.",
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
    `APPLICANT'S RESOURCES:\n${bankText(p.bank)}`,
    "Return the curated resume as JSON: entries (entryId + bullets with bulletId and text), skills, a one-sentence note, and suggestions.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The JSON shape Claude Code replies with. */
export const CURATE_SHAPE =
  '{"entries": [{"entryId": "e1", "bullets": [{"bulletId": "b3", "text": "reworded or original bullet"}]}], "skills": ["..."], "note": "one sentence", "suggestions": ["..."]}';
