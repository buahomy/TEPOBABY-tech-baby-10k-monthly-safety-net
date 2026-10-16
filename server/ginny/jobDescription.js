// Fetches the full job description in real time, straight from the job posting's own website, every
// time an analysis runs, so the resume is compared against what the posting says right now (roles
// get edited or closed). Order:
//   Greenhouse / Lever / Ashby / Workday / SmartRecruiters / Eightfold public job APIs (one small
//   JSON request with the whole posting) → for any other site, one page fetch: Eightfold detected
//   from the page → the best of schema.org JobPosting and the page's main text. Returns null if
//   nothing usable is found (the app then asks the student to paste the description).

import { USER_AGENT } from "../jobs/classify.js";

// Only identical requests already in flight are shared (e.g. a double tap); nothing is kept.
const inflight = new Map(); // url → Promise<string | null>
const UA = { "User-Agent": USER_AGENT, Accept: "application/json, text/html;q=0.9" };

// cleanText collapses newlines; keep line structure for requirement extraction.
const keepLines = (html) =>
  String(html)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|li|h\d|div|ul|ol)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

async function get(url, accept = "json") {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return accept === "json" ? res.json() : res.text();
}

async function greenhouse(u) {
  // job-boards.greenhouse.io/{board}/jobs/{id}  or  boards.greenhouse.io/{board}/jobs/{id}  or  ?gh_jid=
  const m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  const id = m?.[2] || u.searchParams.get("gh_jid");
  const board = m?.[1];
  if (!id || !board) return null;
  const d = await get(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`);
  return keepLines(d.content);
}

async function lever(u) {
  const [, company, id] = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/) || [];
  if (!id) return null;
  const d = await get(`https://api.lever.co/v0/postings/${company}/${id}`);
  return [d.descriptionPlain, ...(d.lists || []).map((l) => `${l.text}\n${keepLines(l.content)}`), d.additionalPlain].filter(Boolean).join("\n");
}

async function ashby(u) {
  const [, board, id] = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/) || [];
  if (!id) return null;
  const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${board}`);
  const job = (d.jobs || []).find((j) => j.id === id);
  return job ? keepLines(job.descriptionHtml || job.descriptionPlain) : null;
}

async function workday(u) {
  // {tenant}.wd5.myworkdayjobs.com/{lang?}/{site}/job/{location}/{slug}
  const tenant = u.hostname.split(".")[0];
  const parts = u.pathname.split("/").filter(Boolean);
  const jobIdx = parts.indexOf("job");
  if (jobIdx < 1) return null;
  const site = parts[jobIdx - 1];
  const rest = parts.slice(jobIdx).join("/");
  const d = await get(`https://${u.hostname}/wday/cxs/${tenant}/${site}/${rest}`);
  return d?.jobPostingInfo?.jobDescription ? keepLines(d.jobPostingInfo.jobDescription) : null;
}

async function smartRecruiters(u) {
  // jobs.smartrecruiters.com/{company}/{id}-{slug}
  const [, company, id] = u.pathname.match(/^\/([^/]+)\/(\d+)/) || [];
  if (!id) return null;
  const d = await get(`https://api.smartrecruiters.com/v1/companies/${company}/postings/${id}`);
  const s = d?.jobAd?.sections || {};
  return ["jobDescription", "qualifications", "additionalInformation"]
    .map((k) => s[k]?.text && `${s[k].title}\n${keepLines(s[k].text)}`)
    .filter(Boolean)
    .join("\n");
}

async function eightfold(u, html = "") {
  // Eightfold career sites (Microsoft, Netflix, …): {host}/careers/job/{id}. The page renders in the
  // browser and its schema.org data is only a short summary; the site's job API has the full posting
  // but needs the company's domain, which the page config names (domain=netflix.com).
  const id = u.pathname.match(/\/job\/(\d+)/)?.[1] || u.searchParams.get("pid");
  if (!id) return null;
  const domains = new Set(
    [
      u.searchParams.get("domain"),
      u.searchParams.get("microsite"),
      ...[...html.matchAll(/domain=([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)].map((m) => m[1].toLowerCase()),
      u.hostname.split(".").slice(-2).join("."),
    ].filter(Boolean),
  );
  for (const domain of domains) {
    const d = await get(`https://${u.hostname}/api/apply/v2/jobs/${id}?domain=${encodeURIComponent(domain)}`).catch(() => null);
    if (d?.job_description) return keepLines(d.job_description);
  }
  return null;
}

// Some sources (often schema.org summaries) are one long paragraph. Requirement extraction reads the
// description line by line, so put each section heading and sentence on its own line.
const SECTION =
  /\b(Responsibilities|Required Qualifications|Preferred Qualifications|Minimum Qualifications|Basic Qualifications|Qualifications|Requirements|What you'll do|What you will do|Nice to have)\b:?/g;
function restoreLines(text) {
  if (text.split("\n").length >= text.length / 400) return text;
  return text
    .replace(SECTION, "\n$1\n")
    .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// What the ATS analysis needs from a description: a qualifications / requirements section and
// bullet points (requirement + skills extraction), then length.
function structure(text) {
  const lines = text.split("\n");
  return {
    bullets: lines.filter((l) => l.startsWith("•")).length,
    reqHeading: lines.some((l) => l.length <= 70 && /qualification|requirement|responsibilit|what you('ll| will)/i.test(l)),
  };
}
const quality = (text) => {
  const s = structure(text);
  return Math.min(text.length, 8000) / 8000 + (s.reqHeading ? 1 : 0) + Math.min(s.bullets, 10) / 10;
};

/** The best description a page holds: schema.org JobPosting first, unless the page's main text has more. */
function bestFromPage(html) {
  const candidates = [];
  // schema.org JobPosting (used by most career sites for Google Jobs)
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const items = [data, ...(Array.isArray(data) ? data : []), ...(data["@graph"] || [])];
      const job = items.find((x) => x && (x["@type"] === "JobPosting" || x["@type"]?.includes?.("JobPosting")));
      if (job?.description) candidates.push(restoreLines(keepLines(job.description)));
    } catch {
      // not JSON
    }
  }
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html.match(/<body[\s\S]*?<\/body>/i)?.[0] || "";
  const text = keepLines(main.replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, " "));
  if (text.length > 400) candidates.push(text);

  const usable = candidates.filter((t) => t.length > 200);
  // A structured schema.org description is the posting itself; the main text can include page clutter.
  const structured = usable.find((t) => structure(t).reqHeading || structure(t).bullets >= 3);
  return structured || usable.sort((a, b) => quality(b) - quality(a))[0] || null;
}

/** Full job description text for a posting URL, fetched live from the posting's site, or null. */
export function fetchJobDescription(url) {
  if (!inflight.has(url)) inflight.set(url, fetchLive(url).finally(() => inflight.delete(url)));
  return inflight.get(url);
}

async function fetchLive(url) {
  let u;
  try {
    u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
  } catch {
    return null;
  }
  const host = u.hostname;
  const apis = [];
  if (/greenhouse\.io$/.test(host) || u.searchParams.get("gh_jid")) apis.push(() => greenhouse(u));
  if (/lever\.co$/.test(host)) apis.push(() => lever(u));
  if (/ashbyhq\.com$/.test(host)) apis.push(() => ashby(u));
  if (/myworkdayjobs\.com$/.test(host)) apis.push(() => workday(u));
  if (/smartrecruiters\.com$/.test(host)) apis.push(() => smartRecruiters(u));
  if (/eightfold\.ai$/.test(host) || host === "apply.careers.microsoft.com") apis.push(() => eightfold(u));
  for (const api of apis) {
    const text = await attempt(api);
    if (text) return finish(text);
  }

  // Any other site: one page fetch, then the best of what it holds.
  const html = await get(url, "text").catch(() => "");
  if (/eightfold/i.test(html)) {
    const text = await attempt(() => eightfold(u, html));
    if (text) return finish(text);
  }
  return finish(bestFromPage(html));
}

async function attempt(fn) {
  try {
    const text = await fn();
    return text && text.length > 200 ? text : null;
  } catch {
    return null; // try the next way
  }
}

const finish = (text) => (text && text.length > 200 ? restoreLines(text).slice(0, 20000) : null);

