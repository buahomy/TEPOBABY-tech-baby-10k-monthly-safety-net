// Optional: Google Jobs via SerpApi (paid). Google Jobs indexes LinkedIn, Indeed, Glassdoor and
// company sites, so this is the legitimate way to cover them (scraping those sites directly is
// against their terms). Enabled only when SERPAPI_KEY is set.

import { DAY, classify, cleanText, fetchJson, isProgram, isRelevant, normalizeUrl } from "../classify.js";
import { domainFromUrl } from "../logos.js";

const QUERIES = [
  "software engineer intern",
  "software engineer new grad",
  "entry level software engineer",
  "data science intern",
  "rotational program new grad",
  // Research & universities: undergraduate research, lab and research-intern roles.
  "undergraduate research assistant",
  "research intern university",
];

const ATS =
  /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|myworkdaysite\.com|icims\.com|smartrecruiters\.com|workable\.com|jobvite\.com|oraclecloud\.com|successfactors\.(com|eu)|eightfold\.ai|taleo\.net|brassring\.com|avature\.net|phenompeople\.com|ultipro\.com|paylocity\.com|bamboohr\.com|recruitee\.com|breezy\.hr|rippling\.com|dayforcehcm\.com|jazzhr\.com|applytojob\.com|teamtailor\.com|pinpointhq\.com|careers-page\.com)/i;
const MAJOR_BOARDS = /(linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com|monster\.com|dice\.com|wellfound\.com|builtin\.com)/i; // not Handshake: it's limited to each school's own students

const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Best place to apply: the company's own site → its hiring platform → LinkedIn / Indeed / Glassdoor /
 * other major boards. Reposting sites (BeBee, JobLeads, Jobrapido, Adzuna, Learn4Good, Trabajo…) and
 * unknown sites aren't trusted: if they're the only option, the posting is dropped (returns null).
 */
function pickApply(options, company) {
  const name = squash(company).replace(/(inc|llc|corp|corporation|company|technologies)$/, "");
  const host = (o) => {
    try {
      return new URL(o.link).hostname.toLowerCase();
    } catch {
      return "";
    }
  };
  const score = (o) => {
    const h = host(o);
    if (name.length >= 3 && squash(h).includes(name)) return 0; // e.g. pinterestcareers.com, jobs.nvidia.com
    if (ATS.test(h)) return 1;
    if (MAJOR_BOARDS.test(h)) return 2;
    return 3; // reposting or unknown site
  };
  const best = [...options].filter((o) => o.link).sort((a, b) => score(a) - score(b))[0];
  if (!best || score(best) === 3) return null;
  return { link: best.link, ownSite: score(best) === 0 };
}

/** "3 days ago" / "12 hours ago" → epoch ms (approximate). */
function parseAgo(s = "") {
  const m = s.match(/(\d+)\s*(hour|day|minute)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return Date.now() - n * (unit === "day" ? DAY : unit === "hour" ? 3600e3 : 60e3);
}

export async function fetchGoogleJobs() {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  const postings = [];
  const errors = [];
  let dropped = 0;
  for (const q of QUERIES) {
    try {
      const params = new URLSearchParams({
        engine: "google_jobs",
        q,
        location: "United States",
        chips: "date_posted:week",
        api_key: key,
      });
      const data = await fetchJson(`https://serpapi.com/search.json?${params}`, { timeoutMs: 30000 });
      for (const j of data.jobs_results || []) {
        const title = cleanText(j.title);
        // Posting age is in detected_extensions.posted_at or, in newer responses, in `extensions`.
        const ago = j.detected_extensions?.posted_at || (j.extensions || []).find((e) => /\bago\b/i.test(e));
        const posted = parseAgo(ago);
        const apply = pickApply(j.apply_options || [], j.company_name || "");
        // Only postings with a trustworthy place to apply (not a reposting site).
        if (!apply) {
          dropped++;
          continue;
        }
        const url = apply.link;
        if (!posted || !url || !isRelevant(title)) continue;
        const level = classify(title, /intern/i.test(q) ? undefined : "entry");
        if (!level) continue;
        postings.push({
          id: `gj:${j.job_id}`,
          source: `Google Jobs${j.via ? ` (${cleanText(j.via).replace(/^via /i, "")})` : ""}`,
          company: cleanText(j.company_name),
          title,
          location: cleanText(j.location) || "—",
          url: normalizeUrl(url),
          postedAt: new Date(posted).toISOString(),
          postedApprox: true,
          level,
          sponsorship: null,
          // Logo only from the company's own site; otherwise the name lookup decides.
          domain: apply?.ownSite ? domainFromUrl(apply.link) : null,
          program: isProgram(title),
          research: /research/i.test(q) || undefined,
        });
      }
    } catch (err) {
      errors.push(err.message.replace(key, "***"));
    }
  }
  if (dropped) console.log(`[jobs] google: skipped ${dropped} postings that only link to reposting sites`);
  return [{ name: "Google Jobs (SerpApi)", postings, error: errors[0] }];
}
