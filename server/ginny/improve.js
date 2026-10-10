// "What to improve" for an ATS analysis. Practical, prioritized suggestions computed from the same
// evidence the score uses — no AI call, so it's instant and nothing extra leaves the server.

import { findSkills } from "./skills.js";

const WEAK_OPENERS = /^(responsible for|worked on|helped( with)?|assisted( with)?|participated in|involved in|tasked with|duties included|was part of)\b/i;
const STRONG_VERBS = ["Built", "Designed", "Shipped", "Led", "Automated", "Optimized", "Reduced", "Improved", "Implemented", "Launched"];
const HAS_NUMBER = /\d|%|\$/;

// Role words recruiters and ATS filters look for in titles and summaries.
const ROLE_WORDS = [
  ["backend", /\bback-?end\b/i],
  ["frontend", /\bfront-?end\b/i],
  ["full-stack", /\bfull[- ]?stack\b/i],
  ["mobile", /\bmobile\b/i],
  ["iOS", /\bios\b/i],
  ["Android", /\bandroid\b/i],
  ["machine learning", /\bmachine learning|\bml\b/i],
  ["AI", /\bai\b|artificial intelligence/i],
  ["data", /\bdata\b/i],
  ["security", /\bsecurity\b/i],
  ["infrastructure", /\binfrastructure|\binfra\b/i],
  ["cloud", /\bcloud\b/i],
  ["embedded", /\bembedded|firmware/i],
  ["distributed systems", /\bdistributed\b/i],
  ["quantitative", /\bquant/i],
  ["product", /\bproduct\b/i],
];

const bulletsOf = (sections) => [...(sections.experience || []), ...(sections.projects || [])].map((b) => b.replace(/^[•\-–*]\s*/, "").trim()).filter((b) => b.split(/\s+/).length >= 4);

/**
 * @param ctx { sections, jobTitle, description, matchedSkills, missingSkills, required (Set),
 *              skillWeights { total, per(skill) }, gaps, components, weights, score }
 * Returns { items: [...], projected: number | null }
 */
export function improvements(ctx) {
  const items = [];
  const { sections } = ctx;
  const bullets = bulletsOf(sections);
  const proofText = bullets.join("\n");
  const skillsOnly = (sections.skills || []).join("\n");

  // Points one skill adds to the final score (skills = 40% of the blend, re-normalized).
  const pointsFor = (skill) =>
    ctx.skillWeights.total ? Math.round((100 * ctx.weights.skills * ctx.skillWeights.per(skill)) / ctx.skillWeights.total / ctx.weights.sum) : 0;

  // 1) Missing required skills
  const missingReq = ctx.missingSkills.filter((m) => m.required).map((m) => m.skill);
  if (missingReq.length) {
    items.push({
      priority: "high",
      category: "Keywords",
      title: `Add ${missingReq.slice(0, 5).join(", ")}, if you've really used them`,
      detail:
        "These are required by the posting and don't appear anywhere in your resume, so an ATS keyword filter will likely mark you down. If you've used them in a class, project, hackathon or job, add them to Skills and to a bullet that shows how. If you haven't, that's a real gap: a small weekend project is the fastest honest fix.",
      impact: missingReq.reduce((a, s) => a + pointsFor(s), 0),
    });
  }

  // 2) Missing preferred skills
  const missingPref = ctx.missingSkills.filter((m) => !m.required).map((m) => m.skill);
  if (missingPref.length) {
    items.push({
      priority: "medium",
      category: "Keywords",
      title: `Nice-to-haves you could mention: ${missingPref.slice(0, 6).join(", ")}`,
      detail: "Not required, but each one you can honestly show moves you up. Use the exact spelling from the posting (ATS filters match strings).",
      impact: missingPref.reduce((a, s) => a + pointsFor(s), 0),
    });
  }

  // 3) Skills listed but never shown in a bullet
  const unproven = ctx.matchedSkills.filter((s) => findSkills(skillsOnly).includes(s) && !findSkills(proofText).includes(s));
  if (unproven.length) {
    items.push({
      priority: "medium",
      category: "Evidence",
      title: `Show ${unproven.slice(0, 5).join(", ")} in a bullet, not just the Skills list`,
      detail:
        "Recruiters and Eightfold-style matchers weigh skills you prove in Experience or Projects more than a keyword list. Add a bullet that says what you built with each one.",
      examples: unproven.slice(0, 2).map((s) => `Used ${s} to [build / speed up / automate] [what], [result with a number].`),
    });
  }

  // 4) Requirements with little evidence
  if (ctx.gaps.length) {
    items.push({
      priority: ctx.gaps.length >= 3 ? "high" : "medium",
      category: "Evidence",
      title: `${ctx.gaps.length} requirement${ctx.gaps.length > 1 ? "s" : ""} with no clear proof in your resume`,
      detail: "For each one you can honestly claim, add or reword a bullet so it uses the posting's words and shows the result.",
      examples: ctx.gaps.slice(0, 3).map((g) => {
        const sk = findSkills(g);
        return `For "${g.slice(0, 90)}${g.length > 90 ? "…" : ""}": ${sk.length ? `Used ${sk.slice(0, 2).join(" and ")} to` : "Did"} [action] [what], [measurable result].`;
      }),
    });
  }

  // 5) Quantify impact
  const noNumbers = bullets.filter((b) => !HAS_NUMBER.test(b));
  if (bullets.length && noNumbers.length / bullets.length > 0.4) {
    items.push({
      priority: "medium",
      category: "Impact",
      title: `Add numbers to ${noNumbers.length} of ${bullets.length} bullets`,
      detail: "Bullets with scale or results (users, requests, %, time saved, $) read as impact, not tasks. Even estimates help, as long as they're honest.",
      examples: noNumbers.slice(0, 3).map((b) => `"${b.slice(0, 80)}${b.length > 80 ? "…" : ""}" → add how many / how much / how fast.`),
    });
  }

  // 6) Weak openers
  const weak = bullets.filter((b) => WEAK_OPENERS.test(b));
  if (weak.length) {
    items.push({
      priority: "low",
      category: "Wording",
      title: `Start ${weak.length} bullet${weak.length > 1 ? "s" : ""} with a strong action verb`,
      detail: `"Responsible for" and "Worked on" describe duties, not results. Try: ${STRONG_VERBS.slice(0, 6).join(", ")}.`,
      examples: weak.slice(0, 2).map((b) => `"${b.slice(0, 70)}…"`),
    });
  }

  // 7) Long bullets
  const long = bullets.filter((b) => b.split(/\s+/).length > 35);
  if (long.length) {
    items.push({
      priority: "low",
      category: "Format",
      title: `Tighten ${long.length} long bullet${long.length > 1 ? "s" : ""} (35+ words)`,
      detail: "Aim for one or two lines: action → what → result. Recruiters skim in seconds.",
    });
  }

  // 8) Role language
  const resumeText = Object.values(sections).flat().join("\n");
  const roleWords = ROLE_WORDS.filter(([, re]) => re.test(ctx.jobTitle) && !re.test(resumeText)).map(([w]) => w);
  if (roleWords.length) {
    items.push({
      priority: "medium",
      category: "Alignment",
      title: `Mirror the role: mention ${roleWords.join(", ")} work`,
      detail: `The job title is "${ctx.jobTitle}", but your resume never says ${roleWords.map((w) => `"${w}"`).join(" or ")}. If any project or internship involved it, say so in that bullet or project title.`,
    });
  }

  // 9) Missing sections
  const missingSections = ["projects", "skills", "education"].filter((k) => !(sections[k] || []).length);
  if (missingSections.length) {
    items.push({
      priority: missingSections.includes("skills") ? "high" : "medium",
      category: "Format",
      title: `Add a ${missingSections.map((k) => k[0].toUpperCase() + k.slice(1)).join(" and ")} section`,
      detail: "ATS parsers look for standard section headings. Use the exact names (Experience, Projects, Skills, Education) so nothing gets missed.",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.priority] - order[b.priority] || (b.impact || 0) - (a.impact || 0));

  // Projected score if the student adds the required skills they actually have.
  const projected = missingReq.length ? Math.min(100, ctx.score + missingReq.reduce((a, s) => a + pointsFor(s), 0)) : null;
  return { items: items.slice(0, 9), projected };
}
