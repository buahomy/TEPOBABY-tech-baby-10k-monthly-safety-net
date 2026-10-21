// Universities: research and student roles straight from schools' own career sites (Workday), for
// students looking for research experience, lab jobs, fellowships and post-bacc roles.
//
// Schools with a public Workday job API: Cornell, Brown and Penn (Ivy League), plus UChicago, UW,
// WashU and Georgetown. Harvard, Yale, Princeton, Columbia and Dartmouth run other systems without a
// public feed; their research roles come through the Google Jobs research searches instead.
// These sites list every staff job, so only student / research / intern / fellowship titles are kept.

import { DAY, cleanText, mapLimit } from "../classify.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36";

const SCHOOLS = [
  { name: "Cornell University", domain: "cornell.edu", host: "cornell.wd1.myworkdayjobs.com", tenant: "cornell", site: "CornellCareerPage", ivy: true },
  { name: "Brown University", domain: "brown.edu", host: "brown.wd5.myworkdayjobs.com", tenant: "brown", site: "staff-careers-brown", ivy: true },
  { name: "University of Pennsylvania", domain: "upenn.edu", host: "wd1.myworkdaysite.com", tenant: "upenn", site: "careers-at-penn", ivy: true, page: "recruiting" },
  { name: "University of Chicago", domain: "uchicago.edu", host: "uchicago.wd5.myworkdayjobs.com", tenant: "uchicago", site: "External" },
  { name: "University of Washington", domain: "washington.edu", host: "wd5.myworkdaysite.com", tenant: "uw", site: "UWHires", page: "recruiting" },
  { name: "Washington University in St. Louis", domain: "wustl.edu", host: "wustl.wd1.myworkdayjobs.com", tenant: "wustl", site: "External" },
  { name: "Georgetown University", domain: "georgetown.edu", host: "georgetown.wd1.myworkdayjobs.com", tenant: "georgetown", site: "Georgetown_Admin_Careers" },
];

const QUERIES = ["research assistant", "undergraduate research", "intern", "fellowship", "student research"];

// Roles a student or new grad would take: research, lab, intern, fellowship and pre-doctoral roles.
// Staff jobs that merely mention students ("Student Services Assistant", "Undergraduate Coordinator",
// "Medical Assistant, Student Health") and senior research roles are skipped.
const STUDENT =
  /\b(undergraduate research|summer (research|program|scholars?|fellows?|intern\w*)|reu\b|research (assistant|aide|intern\w*|program|fellow\w*|technician|trainee)|(lab|laboratory) (assistant|aide|technician)|pre-?doctoral|post-?bacc\w*|fellow(ship)?s?\b|intern(ship)?s?\b|student (research\w*|worker|employee|employment|intern\w*)|work[- ]study|apprentice\w*)/i;
const STAFF = /\b(student (services|health|affairs|success|life|accounts|financial)|coordinator|counselor|social worker|medical assistant|advis[oe]r|administrator|recruiter|nurse|clinical)\b/i;
const SENIOR = /\b(senior|sr\.?|lead|manager|director|head|chief|principal|professor|faculty|lecturer|postdoc\w*|post-doctoral|dean|supervisor|iii|iv)\b/i;

/** "Posted Today" / "Posted 3 Days Ago" / "Posted 30+ Days Ago" → epoch ms. */
function posted(s = "") {
  if (/today/i.test(s)) return Date.now();
  if (/yesterday/i.test(s)) return Date.now() - DAY;
  const m = s.match(/(\d+)\+?\s*days?/i);
  return m ? Date.now() - Number(m[1]) * DAY : null;
}

async function fromSchool(s) {
  const api = `https://${s.host}/wday/cxs/${s.tenant}/${s.site}/jobs`;
  const found = new Map();
  for (const q of QUERIES) {
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const d = await res.json();
    for (const j of d.jobPostings || []) {
      const title = cleanText(j.title);
      if (!j.externalPath || !STUDENT.test(title) || STAFF.test(title) || SENIOR.test(title)) continue;
      const at = posted(j.postedOn);
      if (!at || Date.now() - at > 30 * DAY) continue;
      // Interns, summer and undergraduate programs → Internship; research assistants, fellows,
      // pre-doctoral and post-bacc roles → Entry-level.
      const level = /\b(intern\w*|summer|undergraduate|reu|work[- ]study|student)\b/i.test(title) ? "internship" : "entry";
      const pagePath = s.page ? `/${s.page}/${s.tenant}/${s.site}` : `/${s.site}`;
      found.set(j.externalPath, {
        id: `uni:${s.tenant}:${j.bulletFields?.[0] || j.externalPath}`,
        source: `${s.name} Careers`,
        company: s.name,
        title,
        location: cleanText(j.locationsText) || "—",
        url: `https://${s.host}${pagePath}${j.externalPath}`,
        postedAt: new Date(at).toISOString(),
        postedApprox: true,
        level,
        sponsorship: null,
        domain: s.domain,
        research: true,
      });
    }
  }
  return [...found.values()];
}

export async function fetchUniversities() {
  const failed = [];
  const lists = await mapLimit(SCHOOLS, 3, async (s) => {
    try {
      return await fromSchool(s);
    } catch {
      failed.push(s.name);
      return [];
    }
  });
  return [
    {
      name: "University career sites (Cornell, Brown, Penn, UChicago, UW, WashU, Georgetown)",
      postings: lists.flat(),
      error: failed.length ? `${failed.length}/${SCHOOLS.length} schools failed: ${failed.join(", ")}` : undefined,
    },
  ];
}
