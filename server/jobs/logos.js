// Company logos for postings.
//
// 1. Work out each company's website domain, in order of reliability:
//    the list's own company link → the apply link (when it's on the company's own site, not a hiring
//    platform) → companies.json → a name lookup (Clearbit company autocomplete), accepted only when
//    the name matches exactly and the website looks like the company's own.
//    Lookups are cached in server/data/domains.json so each company is looked up once.
// 2. Serve the logo through our own server (/api/logo/:domain): the site's icon at 128px via
//    Google's favicon service, with DuckDuckGo's as a fallback. Images are cached on disk, so
//    students' browsers never contact third parties and each logo is fetched once a month at most.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { USER_AGENT, mapLimit } from "./classify.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "..", "data");
const DOMAINS_FILE = path.join(DATA, "domains.json");
const LOGO_DIR = path.join(DATA, "logos");
const MONTH = 30 * 24 * 60 * 60 * 1000;

// Hiring platforms and job sites: their hostname says nothing about the company.
const NOT_COMPANY_HOSTS =
  /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|icims\.com|oraclecloud\.com|taleo\.net|smartrecruiters\.com|workable\.com|jobvite\.com|successfactors\.(com|eu)|bamboohr\.com|recruitee\.com|breezy\.hr|rippling\.com|paylocity\.com|ultipro\.com|ukg\.com|adp\.com|dayforcehcm\.com|eightfold\.ai|careerpuck\.com|simplify\.jobs|wellfound\.com|linkedin\.com|indeed\.com|glassdoor\.com|ycombinator\.com|google\.com|gem\.com|teamtailor\.com|personio\.(de|com)|pinpointhq\.com|jazzhr\.com|applytojob\.com|hire\.trakstar\.com|avature\.net|phenompeople\.com|brassring\.com|ziprecruiter\.com|handshake\.com|joinhandshake\.com|github\.com)$/i;

const TWO_PART_TLDS = /\.(co|com|org|net|ac|gov|edu)\.[a-z]{2}$/i;
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "https://careers.microsoft.com/x" → "microsoft.com"; hiring platforms → null. */
export function domainFromUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (NOT_COMPANY_HOSTS.test(host)) return null;
    const parts = host.split(".");
    const keep = TWO_PART_TLDS.test(host) ? 3 : 2;
    const domain = parts.slice(-keep).join(".");
    return DOMAIN_RE.test(domain) ? domain : null;
  } catch {
    return null;
  }
}

// ---- Name → domain lookups (cached) ----

let domainCache = null; // normalized name → { domain: string|null, at: ms }

async function loadDomainCache() {
  if (domainCache) return domainCache;
  try {
    domainCache = JSON.parse(await fs.readFile(DOMAINS_FILE, "utf8"));
  } catch {
    domainCache = {};
  }
  return domainCache;
}

const normName = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|group|holdings|technologies|technology|labs)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");

/** The website must look like the company's own: "tiktok.com" for TikTok, "shield.ai" for Shield AI. */
function domainMatchesName(domain, company) {
  const name = normName(company);
  const labels = domain.toLowerCase().split(".");
  const tld = TWO_PART_TLDS.test(domain) ? labels.slice(-2).join("") : labels.slice(-1)[0];
  const label = labels[labels.length - (TWO_PART_TLDS.test(domain) ? 3 : 2)].replace(/[^a-z0-9]/g, "");
  return label === name || label + tld === name;
}

async function lookupDomain(company) {
  const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`lookup ${res.status}`);
  const hits = await res.json();
  // A wrong logo is worse than a letter: the name must match exactly AND the website must look
  // like the company's own (so "Meter" doesn't become metergroup.com).
  const match = hits.find(
    (h) => normName(h.name || "") === normName(company) && DOMAIN_RE.test(h.domain || "") && domainMatchesName(h.domain, company),
  );
  return match ? match.domain : null;
}

// Websites we already know from server/jobs/companies.json, by company name.
let knownByName = null;
async function knownDomains() {
  if (knownByName) return knownByName;
  knownByName = {};
  try {
    const companies = JSON.parse(await fs.readFile(path.join(here, "companies.json"), "utf8"));
    for (const c of Object.values(companies).flat()) if (c.domain) knownByName[normName(c.name)] = c.domain;
  } catch {
    // no company list
  }
  return knownByName;
}

/** Fills `domain` on postings that don't have one yet. Mutates and returns the array. */
export async function addDomains(postings, { maxLookups = 1000 } = {}) {
  const cache = await loadDomainCache();
  const known = await knownDomains();
  const now = Date.now();
  for (const p of postings) {
    p.domain ||= domainFromUrl(p.url) || known[normName(p.company)] || cache[normName(p.company)]?.domain || null;
  }

  const toLookUp = [
    ...new Set(
      postings
        // Very short names ("vvd", "IMC") match too many unrelated companies.
        .filter((p) => !p.domain && normName(p.company || "").length >= 4)
        .map((p) => p.company)
        .filter((c) => {
          const hit = cache[normName(c)];
          return !hit || (hit.domain === null && now - hit.at > MONTH); // retry misses monthly
        }),
    ),
  ].slice(0, maxLookups);

  if (toLookUp.length) {
    await mapLimit(toLookUp, 4, async (company) => {
      try {
        cache[normName(company)] = { domain: await lookupDomain(company), at: now };
      } catch {
        // leave uncached; try again next run
      }
    });
    await fs.mkdir(DATA, { recursive: true, mode: 0o700 });
    await fs.writeFile(DOMAINS_FILE, JSON.stringify(cache));
    for (const p of postings) p.domain ||= cache[normName(p.company)]?.domain || null;
  }
  return postings;
}

// ---- Logo images (proxied + cached) ----

const inflight = new Map();

async function fetchIcon(domain) {
  const sources = [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
  for (const src of sources) {
    try {
      const res = await fetch(src, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10000) });
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !type.startsWith("image/")) continue;
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > 64 && body.length < 512 * 1024) return { body, type };
    } catch {
      // try the next source
    }
  }
  return null;
}

/** Returns { body, type } for a domain's logo, or null if none was found. Cached on disk. */
export async function getLogo(domain) {
  if (!DOMAIN_RE.test(domain)) return null;
  const file = path.join(LOGO_DIR, domain);
  try {
    const meta = JSON.parse(await fs.readFile(`${file}.json`, "utf8"));
    if (Date.now() - meta.at < MONTH) {
      return meta.type ? { body: await fs.readFile(`${file}.img`), type: meta.type } : null;
    }
  } catch {
    // not cached yet
  }

  if (!inflight.has(domain)) {
    inflight.set(
      domain,
      fetchIcon(domain)
        .then(async (icon) => {
          await fs.mkdir(LOGO_DIR, { recursive: true, mode: 0o700 });
          if (icon) await fs.writeFile(`${file}.img`, icon.body);
          await fs.writeFile(`${file}.json`, JSON.stringify({ at: Date.now(), type: icon?.type ?? null }));
          return icon;
        })
        .finally(() => inflight.delete(domain)),
    );
  }
  return inflight.get(domain);
}
