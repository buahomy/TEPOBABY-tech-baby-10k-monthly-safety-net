// Recruiter demo: one tap from the welcome screen to a full app, no questions and no sign-in.
// It's a guest session with a sample student's answers and a few real saved jobs from today's feed,
// so Ginny's ATS (with a sample résumé), Ask Gemini, Connect and the voice interview all have
// something to work with. Costly features are capped on the server (server/demo.js).

import type { Answers } from "./profile";
import { saveAnswersAsGuest } from "./profile";
import { fromPosting, writeGuestSavedJobs } from "./savedJobs";
import { saveSelectedJobId } from "./ginny";
import type { Posting } from "./postings";

const KEY = "tepobaby.demo";

/** A senior on F-1 OPT looking for internships and new grad roles: shows the visa features too. */
const DEMO_ANSWERS: Answers = {
  academicLevel: "senior",
  graduation: { month: 5, year: 2027 },
  positionTypes: ["summer_internship", "full_time_new_grad"],
  startTerm: "summer_2027",
  workAuthorized: "yes",
  needsSponsorship: "yes",
  workAuthStatus: "f1_opt",
  gender: "prefer_not_to_say",
  raceEthnicity: "prefer_not_to_say",
  lgbtq: "prefer_not_to_say",
  firstGen: "prefer_not_to_say",
};

export const isDemo = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export function endDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Sets up the demo guest; returns the profile to open the app with. */
export async function startDemo() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // private browsing: the demo still works for this visit
  }
  const profile = await saveAnswersAsGuest(DEMO_ANSWERS, true);
  // Real roles from today's feed, from job boards whose descriptions Ginny can read.
  try {
    const lists = await Promise.all(
      ["entry", "internship"].map((level) =>
        fetch(`/api/postings?level=${level}&window=week&limit=80`)
          .then((r) => r.json())
          .then((d: { postings?: Posting[] }) => d.postings ?? [])
          .catch(() => [] as Posting[]),
      ),
    );
    const all = lists.flat();
    const readable = (p: Posting) => /greenhouse|lever|ashby|myworkdayjobs|amazon\.jobs|careers\.microsoft/i.test(p.url);
    // Software and data roles, so the sample résumé (Python, React, Go, AWS) gets a fair first score.
    const tech = (p: Posting) => /software|developer|full[- ]?stack|front[- ]?end|back[- ]?end|\bswe\b|data (scien|engineer)|machine learning|\bml\b/i.test(p.title);
    // Best: tech roles on boards Ginny can read; then any readable role; then anything.
    const ranked = [...all.filter((p) => readable(p) && tech(p)), ...all.filter(readable), ...all];
    const pick = ranked.filter((p, i) => ranked.findIndex((q) => q.id === p.id) === i).slice(0, 3);
    if (pick.length) {
      writeGuestSavedJobs(pick.map(fromPosting));
      saveSelectedJobId(pick[0].id);
    }
  } catch {
    // no saved jobs: the visitor can heart a few from Home
  }
  return profile;
}
