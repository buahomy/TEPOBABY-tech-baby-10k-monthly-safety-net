// Fetches the full job description in real time, straight from the job posting's own website, every
// time an analysis runs, so the resume is compared against what the posting says right now (roles
// get edited or closed). Order:
//   Greenhouse / Lever / Ashby public APIs → Workday's public job API → Microsoft's public jobs API → schema.org JobPosting on
//   the page → the page's main text. Returns null if nothing usable is found (the app then asks
//   the student to paste the description).

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

async function microsoft(u) {
  // apply.careers.microsoft.com/careers/job/{id}: the page is JavaScript-only, but the same site
  // serves each posting from its public jobs API.
  const id = u.pathname.match(/\/job\/(\d+)/)?.[1];
  if (!id) return null;
  const d = await get(`https://apply.careers.microsoft.com/api/apply/v2/jobs/${id}?domain=microsoft.com`);
  return d?.job_description ? keepLines(d.job_description) : null;
}

async function genericPage(url) {
  const html = await get(url, "text");
  // schema.org JobPosting (used by most career sites for Google Jobs)
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const items = [data, ...(Array.isArray(data) ? data : []), ...(data["@graph"] || [])];
      const job = items.find((x) => x && (x["@type"] === "JobPosting" || x["@type"]?.includes?.("JobPosting")));
      if (job?.description) return keepLines(job.description);
    } catch {
      // not JSON
    }
  }
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html.match(/<body[\s\S]*?<\/body>/i)?.[0] || "";
  const text = keepLines(main.replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, " "));
  return text.length > 400 ? text.slice(0, 20000) : null;
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
  const tries = [];
  if (/greenhouse\.io$/.test(host) || u.searchParams.get("gh_jid")) tries.push(() => greenhouse(u));
  if (/lever\.co$/.test(host)) tries.push(() => lever(u));
  if (/ashbyhq\.com$/.test(host)) tries.push(() => ashby(u));
  if (/myworkdayjobs\.com$/.test(host)) tries.push(() => workday(u));
  if (/(^|\.)careers\.microsoft\.com$/.test(host)) tries.push(() => microsoft(u));
  tries.push(() => genericPage(url));

  let text = null;
  for (const t of tries) {
    try {
      text = await t();
      if (text && text.length > 200) break;
    } catch {
      // try the next way
    }
  }
  return text && text.length > 200 ? text.slice(0, 20000) : null;
}

