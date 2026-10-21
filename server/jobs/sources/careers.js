// Big companies' own career sites, through the public JSON their search pages use (no HTML scraping):
//   - Microsoft (apply.careers.microsoft.com, an Eightfold site)
//   - Amazon (amazon.jobs search.json)
//   - Companies on Workday ({tenant}.wdN.myworkdayjobs.com, the "cxs" jobs API)
// These sites post rotational / development programs (e.g. Microsoft's Finance Rotation Program,
// Amazon's AFRP, Intel's Sales & Marketing Rotation Program) and new grad roles that the community
// lists, which track software roles, often miss.
//
// Their search is loose (keyword matches anywhere in the job), so every result is filtered by title:
// it must be early-career (classify), and either a program, a tech role, or, at tech companies
// (`allRoles`), any early-career role, since finance or sales jobs at Microsoft are tech-industry jobs.
// Only U.S., Canada and UK roles are kept (the feed's country filter).
//
// Microsoft answers bursts with 429 Too Many Requests, so its searches run one at a time, spaced out.

import { DAY, classify, cleanText, countriesOf, isProgram, isRelevant, mapLimit, maxAgeFor } from "../classify.js";

// Titles written for a non-English market ("Sales Path - German Speaking Market").
const OTHER_MARKET = /\b(german|french|spanish|hebrew|danish|norwegian|swedish|dutch|italian|japanese|korean|mandarin|portuguese|polish|arabic|turkish|nordic|dach|bnl)\b[^-]*\b(speaking|market|path)\b/i;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch → JSON, retrying a couple of times: these sites sometimes answer a burst with a non-JSON page. */
async function getJson(url, init = {}) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, Accept: "application/json", ...init.headers },
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 429) {
        // Rate limited: wait as long as asked (or a few seconds), then try again.
        await sleep(Math.min(Number(res.headers.get("retry-after")) * 1000 || 8000 * (attempt + 1), 30000));
        throw new Error("429 Too Many Requests");
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return JSON.parse(await res.text());
    } catch (err) {
      last = err;
      await sleep(800 * (attempt + 1));
    }
  }
  throw last;
}

function posting({ id, source, company, domain, title, location, url, postedAt, postedApprox, allRoles }) {
  title = cleanText(title);
  const level = classify(title);
  if (!level) return null;
  // U.S., Canada and UK roles (the feed's country filter); unknown places are kept.
  const where = countriesOf(cleanText(location));
  if ((where.length && !where.some((c) => c === "US" || c === "CA" || c === "UK")) || OTHER_MARKET.test(title)) return null;
  if (!allRoles && !isRelevant(title)) return null;
  if (!postedAt || Date.now() - postedAt > maxAgeFor(title)) return null;
  return {
    id,
    source,
    company,
    title,
    location: cleanText(location) || "—",
    url,
    postedAt: new Date(postedAt).toISOString(),
    postedApprox,
    level,
    sponsorship: null,
    domain,
    program: isProgram(title),
  };
}

// ---- Microsoft ----

const MS_QUERIES = ["rotation", "intern", "university", "new grad"];

async function microsoft() {
  const found = new Map();
  const searches = [
    ...MS_QUERIES.flatMap((q) => [0, 10].map((start) => [q, "United States", start])),
    ...["rotation", "intern"].flatMap((q) => [[q, "Canada", 0], [q, "United Kingdom", 0]]),
  ];
  const short = new Set(); // queries whose first page came back short: no second page needed
  for (const [q, location, start] of searches) {
    if (start > 0 && short.has(`${q}|${location}`)) continue;
    await sleep(3000);
    const params = new URLSearchParams({ domain: "microsoft.com", query: q, location, start: String(start) });
    const d = await getJson(`https://apply.careers.microsoft.com/api/pcsx/search?${params}`);
    const list = d?.data?.positions || [];
    for (const j of list) {
      const p = posting({
        id: `ms:${j.displayJobId || j.id}`,
        source: "Microsoft Careers",
        company: "Microsoft",
        domain: "microsoft.com",
        title: j.name,
        location: (j.locations || []).join(" · "),
        url: `https://apply.careers.microsoft.com/careers/job/${j.id}`,
        postedAt: j.postedTs ? j.postedTs * 1000 : null,
        postedApprox: false,
        allRoles: true,
      });
      if (p) found.set(p.id, p);
    }
    if (list.length < 10) short.add(`${q}|${location}`);
  }
  return [...found.values()];
}

// ---- Amazon ----

const AMAZON_QUERIES = ["rotational program", "leadership development program", "new grad", "university graduate", "intern", "early career"];

async function amazon() {
  const found = new Map();
  const searches = [
    ...AMAZON_QUERIES.map((q) => [q, "USA"]),
    ...["rotational program", "intern", "new grad"].flatMap((q) => [[q, "CAN"], [q, "GBR"]]),
  ];
  await mapLimit(searches, 2, async ([q, country]) => {
    const params = new URLSearchParams({ base_query: q, country, result_limit: "100", sort: "recent", offset: "0" });
    const d = await getJson(`https://www.amazon.jobs/en/search.json?${params}`);
    for (const j of d.jobs || []) {
      const p = posting({
        id: `amzn:${j.id_icims || j.id}`,
        source: "Amazon Jobs",
        company: "Amazon",
        domain: "amazon.com",
        title: j.title,
        location: j.normalized_location || j.location,
        url: `https://www.amazon.jobs${j.job_path}`,
        postedAt: Date.parse(j.posted_date) || null,
        postedApprox: true, // a date, no time
        allRoles: true,
      });
      if (p) found.set(p.id, p);
    }
  });
  return [...found.values()];
}

// ---- Workday ----

// host / tenant / site come from each company's careers URL: https://{host}/{site} → /wday/cxs/{tenant}/{site}/jobs
const WORKDAY = [
  { company: "NVIDIA", domain: "nvidia.com", host: "nvidia.wd5.myworkdayjobs.com", tenant: "nvidia", site: "NVIDIAExternalCareerSite", allRoles: true },
  { company: "Salesforce", domain: "salesforce.com", host: "salesforce.wd12.myworkdayjobs.com", tenant: "salesforce", site: "External_Career_Site", allRoles: true },
  { company: "Adobe", domain: "adobe.com", host: "adobe.wd5.myworkdayjobs.com", tenant: "adobe", site: "external_experienced", allRoles: true },
  { company: "Intel", domain: "intel.com", host: "intel.wd1.myworkdayjobs.com", tenant: "intel", site: "External", allRoles: true },
  { company: "HP", domain: "hp.com", host: "hp.wd5.myworkdayjobs.com", tenant: "hp", site: "ExternalCareerSite", allRoles: true },
  { company: "Workday", domain: "workday.com", host: "workday.wd5.myworkdayjobs.com", tenant: "workday", site: "Workday", allRoles: true },
  { company: "PayPal", domain: "paypal.com", host: "paypal.wd1.myworkdayjobs.com", tenant: "paypal", site: "jobs", allRoles: true },
  { company: "Autodesk", domain: "autodesk.com", host: "autodesk.wd1.myworkdayjobs.com", tenant: "autodesk", site: "Ext", allRoles: true },
  { company: "Micron", domain: "micron.com", host: "micron.wd1.myworkdayjobs.com", tenant: "micron", site: "External", allRoles: true },
  { company: "Red Hat", domain: "redhat.com", host: "redhat.wd5.myworkdayjobs.com", tenant: "redhat", site: "jobs", allRoles: true },
  { company: "T-Mobile", domain: "t-mobile.com", host: "tmobile.wd1.myworkdayjobs.com", tenant: "tmobile", site: "External", allRoles: true },
  { company: "Capital One", domain: "capitalone.com", host: "capitalone.wd12.myworkdayjobs.com", tenant: "capitalone", site: "Capital_One" },
  { company: "Mastercard", domain: "mastercard.com", host: "mastercard.wd1.myworkdayjobs.com", tenant: "mastercard", site: "CorporateCareers" },
  { company: "Bank of America", domain: "bankofamerica.com", host: "ghr.wd1.myworkdayjobs.com", tenant: "ghr", site: "Lateral-US" },
  { company: "Fidelity", domain: "fidelity.com", host: "fmr.wd1.myworkdayjobs.com", tenant: "fmr", site: "FidelityCareers" },
  { company: "Target", domain: "target.com", host: "target.wd5.myworkdayjobs.com", tenant: "target", site: "targetcareers" },
  { company: "Boeing", domain: "boeing.com", host: "boeing.wd1.myworkdayjobs.com", tenant: "boeing", site: "EXTERNAL_CAREERS" },
  { company: "Disney", domain: "disney.com", host: "disney.wd5.myworkdayjobs.com", tenant: "disney", site: "disneycareer" },
  { company: "Chevron", domain: "chevron.com", host: "chevron.wd5.myworkdayjobs.com", tenant: "chevron", site: "jobs" },
];

const WORKDAY_QUERIES = ["rotation program", "development program", "new grad", "university graduate", "intern"];

/** "Posted Today" / "Posted Yesterday" / "Posted 3 Days Ago" / "Posted 30+ Days Ago" → epoch ms. */
function workdayPosted(s = "") {
  if (/today/i.test(s)) return Date.now();
  if (/yesterday/i.test(s)) return Date.now() - DAY;
  const m = s.match(/(\d+)\+?\s*days?/i);
  return m ? Date.now() - Number(m[1]) * DAY : null;
}

async function workdayCompany(c) {
  const found = new Map();
  for (const q of WORKDAY_QUERIES) {
    const d = await getJson(`https://${c.host}/wday/cxs/${c.tenant}/${c.site}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }),
    });
    for (const j of d.jobPostings || []) {
      if (!j.externalPath) continue;
      const p = posting({
        id: `wd:${c.tenant}:${j.bulletFields?.[0] || j.externalPath}`,
        source: `${c.company} Careers (Workday)`,
        company: c.company,
        domain: c.domain,
        title: j.title,
        location: j.locationsText,
        url: `https://${c.host}/${c.site}${j.externalPath}`,
        postedAt: workdayPosted(j.postedOn),
        postedApprox: true,
        allRoles: c.allRoles,
      });
      if (p) found.set(p.id, p);
    }
  }
  return [...found.values()];
}

export async function fetchCareerSites() {
  const results = [];
  const run = async (name, fn) => {
    try {
      results.push({ name, postings: await fn() });
    } catch (err) {
      results.push({ name, postings: [], error: err.message });
    }
  };
  await Promise.all([
    run("Microsoft Careers", microsoft),
    run("Amazon Jobs", amazon),
    (async () => {
      const failed = [];
      const lists = await mapLimit(WORKDAY, 4, async (c) => {
        try {
          return await workdayCompany(c);
        } catch {
          failed.push(c.company);
          return [];
        }
      });
      results.push({
        name: "Company career sites (Workday)",
        postings: lists.flat(),
        error: failed.length ? `${failed.length}/${WORKDAY.length} sites failed: ${failed.join(", ")}` : undefined,
      });
    })(),
  ]);
  return results;
}
