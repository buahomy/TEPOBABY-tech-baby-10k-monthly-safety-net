// Shared helpers for turning raw listings into Tepobaby postings.
//
// Posting shape (what /api/postings returns):
//   { id, source, company, title, location, url, postedAt (ISO), postedApprox (bool),
//     level: "underclassmen" | "internship" | "entry", sponsorship: "yes" | "no" | "citizens" | null }

const UNDERCLASS = /\b(freshman|freshmen|sophomore|first[- ]year|second[- ]year|underclass\w*|explore (program|intern)|early insight|discovery (program|day)|step intern|high school|pre-?university|insight program|extern(ship)?)\b/i;
const INTERN = /\b(intern|interns|internship|co-?op|summer analyst|summer associate|apprentice(ship)?)\b/i;
const ENTRY =
  /\b(new grad\w*|graduate|grad\b|entry[- ]level|junior|jr\.?|university|early[- ]career|campus|associate (software|engineer|developer|data)|(engineer|developer|analyst|scientist) (i|1)\b|level (i|1)\b|rotational|residency|fellowship)\b/i;
const TOO_SENIOR = /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp|vice president|architect|(engineer|developer|scientist) (ii|iii|iv|2|3|4))\b/i;

// Keep tech / tech-adjacent roles from broad sources (company job boards, HN, Google Jobs).
const TECH =
  /\b(software|engineer\w*|developer|swe|sde|data|machine learning|ml|ai|artificial intelligence|security|cyber|quant\w*|research|infrastructure|sre|devops|cloud|frontend|front-end|backend|back-end|full[- ]?stack|mobile|ios|android|web|product manag\w*|it support|systems|platform|firmware|embedded|robotics|computer|technology|analytics|forward deployed)\b/i;

export function isTech(title) {
  return TECH.test(title);
}

/** Level from a role title, or null if it isn't early-career. `hint` comes from curated lists. */
export function classify(title, hint) {
  if (UNDERCLASS.test(title)) return "underclassmen";
  if (hint === "internship") return "internship";
  if (hint === "entry") return TOO_SENIOR.test(title) && !ENTRY.test(title) ? null : "entry";
  if (INTERN.test(title)) return "internship";
  if (ENTRY.test(title) && !TOO_SENIOR.test(title)) return "entry";
  return null;
}

/** Simplify-style sponsorship text or emoji flags → yes / no / citizens / null (unknown). */
export function sponsorship(value = "", title = "") {
  const v = String(value).toLowerCase();
  if (v.includes("does not offer") || title.includes("🛂")) return "no";
  if (v.includes("citizenship") || title.includes("🇺🇸")) return "citizens";
  if (v.includes("offers sponsorship")) return "yes";
  return null;
}

export function cleanText(s = "") {
  return String(s)
    .replace(/<br\s*\/?>|<\/br>/gi, ", ")
    .replace(/<[^>]+>/g, "")
    .replace(/[🛂🇺🇸🔒🔥🎓]/gu, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip tracking params so the same job from two sources dedupes. */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|gh_src$)/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return url;
  }
}

export const DAY = 24 * 60 * 60 * 1000;
export const MAX_AGE_MS = 7 * DAY;

export const USER_AGENT = "TepobabyJobsBot/1.0 (+student job aggregator; contact via repo)";

// Conditional-request cache: url → { etag, lastModified, body }. With `cache: true`, unchanged
// files come back as 304 Not Modified, so frequent polling of big lists costs almost nothing.
const httpCache = new Map();

async function get(url, { timeoutMs = 20000, headers = {}, cache = false } = {}) {
  const hit = cache ? httpCache.get(url) : undefined;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      ...(hit?.etag ? { "If-None-Match": hit.etag } : {}),
      ...(hit?.lastModified ? { "If-Modified-Since": hit.lastModified } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 304 && hit) return { body: hit.body, changed: false };
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const body = await res.text();
  if (cache) {
    httpCache.set(url, { etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"), body });
  }
  return { body, changed: true };
}

export async function fetchJson(url, opts = {}) {
  const { body } = await get(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  return JSON.parse(body);
}

export async function fetchText(url, opts = {}) {
  return (await get(url, opts)).body;
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
