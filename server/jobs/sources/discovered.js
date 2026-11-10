// Discovered boards: company job boards (Greenhouse, Lever, Ashby) that aren't in companies.json yet.
//
// 1) From the feed itself: every posting that links to one of these boards reveals the company's board,
//    so its other early-career roles (often tech sales, AI or product roles the GitHub lists skip) get
//    pulled too. Boards are remembered, so coverage grows every day.
// 2) Brian's Job Search method (briansjobsearch.com builds Google searches limited to hiring sites):
//    one Google search a day through SerpApi, limited to Greenhouse, Lever and Ashby and to the past
//    24 hours, rotating between tech sales, AI, new grad engineering and product / data roles. It uses
//    the 8th daily SerpApi search, so the month stays inside the free 250.
//
// Roles are read from each board's public API, like the rest of the company boards. Only titles that
// say their level (new grad, intern, SDR, associate…) count here: these companies weren't vetted as
// startups.

import { fetchJson, mapLimit } from "../classify.js";
import * as store from "../../store.js";
import { PROVIDERS, fromBoard, loadCompanies } from "./ats.js";

const MAX_BOARDS = 2500;
const PATTERNS = [
  [/(?:^|\/\/)(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_app\?for=)?([\w-]+)/i, "greenhouse"],
  [/[?&]for=([\w-]+)/i, "greenhouse", /greenhouse\.io/i],
  [/(?:^|\/\/)jobs(?:\.eu)?\.lever\.co\/([\w.-]+)/i, "lever"],
  [/(?:^|\/\/)jobs\.ashbyhq\.com\/([^/?#]+)/i, "ashby"],
];
const NOT_SLUGS = new Set(["embed", "jobs", "job_app", "v1", "careers", "api"]);

/** { provider, slug } for a job-board URL, or null. */
export function boardOf(url = "") {
  for (const [re, provider, needs] of PATTERNS) {
    if (needs && !needs.test(url)) continue;
    const m = url.match(re);
    if (!m) continue;
    const slug = decodeURIComponent(m[1]).toLowerCase();
    if (!slug || NOT_SLUGS.has(slug)) continue;
    return { provider, slug };
  }
  return null;
}

const pretty = (slug) => slug.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// One search a day, rotating by weekday.
const SITES = "(site:boards.greenhouse.io OR site:job-boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com)";
const BRIAN_QUERIES = [
  `${SITES} ("sales development representative" OR "business development representative" OR "account executive" OR "solutions engineer") ("new grad" OR "entry level" OR associate OR "early career")`,
  `${SITES} ("AI engineer" OR "machine learning engineer" OR "applied AI" OR "forward deployed") ("new grad" OR "entry level" OR "early career" OR junior)`,
  `${SITES} ("software engineer" OR "software developer") ("new grad" OR "entry level" OR "early career" OR "university grad")`,
  `${SITES} ("associate product manager" OR "product analyst" OR "data analyst" OR "business analyst") ("new grad" OR "entry level" OR "early career")`,
];

/** Company name from a search result title: "Job Application for X at Acme", "Acme - X", "X @ Acme". */
function companyFromResult(r, provider) {
  const t = String(r.title || "");
  if (provider === "greenhouse") return t.match(/\bat\s+(.+?)\s*$/i)?.[1];
  if (provider === "lever") return t.split(/\s+[-–]\s+/)[0];
  return t.match(/@\s*(.+?)\s*$/)?.[1] || t.split(/\s+[|–-]\s+/).pop();
}

async function searchBoards() {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  const day = Math.floor(Date.now() / 86400e3);
  const params = new URLSearchParams({ engine: "google", q: BRIAN_QUERIES[day % BRIAN_QUERIES.length], tbs: "qdr:d", num: "100", gl: "us", hl: "en", api_key: key });
  try {
    const data = await fetchJson(`https://serpapi.com/search.json?${params}`, { timeoutMs: 30000 });
    return (data.organic_results || []).flatMap((r) => {
      const b = boardOf(r.link);
      return b ? [{ ...b, name: companyFromResult(r, b.provider) }] : [];
    });
  } catch (err) {
    console.warn("[jobs] board search failed:", err.message.replace(key, "***"));
    return [];
  }
}

export async function fetchDiscoveredBoards({ previous } = {}) {
  const now = Date.now();
  const companies = await loadCompanies();
  const tracked = new Set(Object.entries(companies).flatMap(([p, list]) => list.map((c) => `${p}:${c.slug.toLowerCase()}`)));
  const remembered = (await store.get("meta", "discoveredBoards")) || {};

  // Boards linked from yesterday's feed, plus today's search.
  const seen = [];
  for (const src of Object.values(previous?.sources || {})) {
    for (const p of src.postings || []) {
      const b = boardOf(p.url);
      if (b) seen.push({ ...b, name: p.company, domain: p.domain });
    }
  }
  const searched = await searchBoards();
  for (const b of [...seen, ...searched]) {
    const k = `${b.provider}:${b.slug}`;
    if (tracked.has(k) || !PROVIDERS[b.provider]) continue;
    const old = remembered[k];
    remembered[k] = { provider: b.provider, slug: b.slug, name: old?.name || b.name || pretty(b.slug), domain: old?.domain || b.domain || null, seenAt: new Date(now).toISOString() };
  }

  // Newest first, capped.
  const boards = Object.entries(remembered)
    .filter(([k]) => !tracked.has(k))
    .sort((a, b) => (b[1].seenAt || "").localeCompare(a[1].seenAt || ""))
    .slice(0, MAX_BOARDS);

  const results = await mapLimit(boards, 12, async ([k, b]) => {
    try {
      return { k, ok: true, postings: await fromBoard(b.provider, b.slug, b.name, b.domain, null, now) };
    } catch (err) {
      return { k, ok: false, gone: /\b404\b/.test(err.message), postings: [] };
    }
  });

  // Forget boards that no longer exist.
  const kept = Object.fromEntries(boards.filter(([k]) => !results.find((r) => r.k === k && r.gone)));
  await store.set("meta", "discoveredBoards", kept);

  const postings = results.flatMap((r) => r.postings);
  console.log(`[jobs] discovered boards: ${Object.keys(kept).length} remembered (${searched.length} from today's search), ${postings.length} roles`);
  return [{ name: "Discovered company boards", postings }];
}
