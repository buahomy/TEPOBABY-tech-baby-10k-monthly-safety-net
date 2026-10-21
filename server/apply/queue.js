// Apply agent: today's list of roles a student can apply to, from the live job feed.
//
// Fit rules (from the student's onboarding answers, sent by the app):
//   - Full-time roles only: Entry-level and Rotational Programs (no internships / underclassmen).
//   - Sponsorship: students who need it (OPT, H-1B…) never see roles that say "no sponsorship" or
//     "U.S. citizens only", nor titles that require a clearance or citizenship. Roles that don't say
//     are kept and flagged, since most postings don't.
//   - Timing: titles naming a class year or start date before the student can start are dropped
//     (e.g. "New Grad 2025" or "Summer 2026" for a December 2026 graduate starting January 2027).
//     Titles naming the student's own cohort or start are boosted.

import { allPostings } from "../jobs/index.js";

const CLEARANCE = /\b(clearance|ts\/sci|top secret|secret clearance|polygraph|u\.?s\.? citizen(ship)?( required| only)?)\b/i;
const SEASONS = { winter: 1, spring: 3, summer: 6, fall: 9, autumn: 9 };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Earliest start a title implies, as a month index (year * 12 + month), or null if it doesn't say. */
function titleStart(title) {
  const t = title.toLowerCase();
  const season = t.match(/\b(winter|spring|summer|fall|autumn|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s*'?(20\d\d|\d\d)\b/);
  if (season) {
    const word = season[1].slice(0, 3);
    const month = SEASONS[season[1]] || MONTHS[word];
    const year = Number(season[2].length === 2 ? `20${season[2]}` : season[2]);
    if (month) return year * 12 + month;
  }
  return null;
}

/** Class year a title targets ("New Grad 2026", "2027 University Graduate"), or null. */
function titleClassYear(title) {
  const m = title.match(/\b(20\d\d)\b/);
  return m ? Number(m[1]) : null;
}

/**
 * @param {{ gradYear:number, gradMonth:number, startYear:number, startMonth:number, needsSponsorship:boolean, limit?:number }} p
 */
export function applyQueue({ gradYear, gradMonth, startYear, startMonth, needsSponsorship, limit = 150 }) {
  const startIdx = startYear * 12 + startMonth;
  const out = [];
  for (const p of allPostings()) {
    if (!(p.level === "entry" || p.program) || p.level === "internship" || p.level === "underclassmen") continue;
    // U.S. roles only (sponsorship rules here are about U.S. visas); unknown places count as U.S.
    if (p.countries?.length && !p.countries.includes("US")) continue;
    if (needsSponsorship) {
      if (p.sponsorship === "no" || p.sponsorship === "citizens") continue;
      if (CLEARANCE.test(p.title)) continue;
    }

    const start = titleStart(p.title);
    const year = titleClassYear(p.title);
    // Starts before the student can start (two months of slack for "Winter 2027" vs January).
    if (start !== null && start < startIdx - 2) continue;
    // A class year before the student's graduation year ("New Grad 2025" for a 2026 graduate).
    if (start === null && year !== null && year < gradYear) continue;

    let fit = "open"; // no date in the title
    if (start !== null) fit = start <= startIdx + 2 ? "match" : "later";
    else if (year !== null) fit = year === gradYear || year === startYear ? "match" : "later";

    out.push({
      ...p,
      fit, // match: names your class or start · later: starts later in the year · open: doesn't say
      sponsorshipNote: p.sponsorship === "yes" ? "sponsors" : needsSponsorship ? "unknown" : null,
    });
  }
  const rank = { match: 0, open: 1, later: 2 };
  out.sort((a, b) => rank[a.fit] - rank[b.fit] || (b.sponsorship === "yes") - (a.sponsorship === "yes") || b.postedAt.localeCompare(a.postedAt));
  return out.slice(0, limit);
}
