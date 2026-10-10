// Company logos for postings.
//
// 1. Work out each company's website domain, in order of reliability:
//    the list's own company link → the apply link (when it's on the company's own site, not a hiring
//    platform) → companies.json → a name lookup (Clearbit company autocomplete), accepted only when
//    the name matches exactly and the website looks like the company's own.
//    Lookups are cached (server/data/domains.json locally, Upstash Redis on Vercel) so each company
//    is looked up once.
// 2. Serve the logo through our own server (/api/logo/:domain). Launchpad organizations use their
//    own website's icon (apple-touch-icon or largest site icon, or an explicit `logo`); everything
//    falls back to Google's favicon service at 128px, then DuckDuckGo's. Images are cached (on disk
//    locally, in Upstash Redis on Vercel), so students' browsers never contact third parties and each
//    logo is fetched once a month at most.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { USER_AGENT, mapLimit } from "./classify.js";
import * as store from "../store.js";

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
    domainCache = store.usingRedis ? (await store.get("meta", "domains")) || {} : JSON.parse(await fs.readFile(DOMAINS_FILE, "utf8"));
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
    if (store.usingRedis) await store.set("meta", "domains", cache);
    else {
      await fs.mkdir(DATA, { recursive: true, mode: 0o700 });
      await fs.writeFile(DOMAINS_FILE, JSON.stringify(cache));
    }
    for (const p of postings) p.domain ||= cache[normName(p.company)]?.domain || null;
  }
  return postings;
}

// ---- Logo images (proxied + cached) ----

const inflight = new Map();

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36";

/**
 * Reads a site's homepage and returns its own icon URLs, best first: apple-touch-icon, then the
 * largest declared icon. Only used for launchpad entries (our own curated list of websites).
 */
async function siteIconUrls(siteUrl) {
  try {
    const res = await fetch(siteUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return [];
    const html = (await res.text()).slice(0, 1_000_000);
    const found = [];
    for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
      const rel = tag.match(/rel=["']([^"']+)/i)?.[1]?.toLowerCase() || "";
      const href = tag.match(/href=["']([^"']+)/i)?.[1];
      if (!href || !/icon/.test(rel)) continue;
      const size = Number(tag.match(/sizes=["'](\d+)/i)?.[1] || 0);
      const rank = (rel.includes("apple-touch-icon") ? 1000 : 0) + size;
      try {
        const url = new URL(href.replace(/&amp;/g, "&"), res.url);
        if (/^https?:$/.test(url.protocol) && !/\.svg(\?|$)/i.test(url.pathname)) found.push({ url: url.toString(), rank });
      } catch {
        // bad href
      }
    }
    return found.sort((a, b) => b.rank - a.rank).map((f) => f.url);
  } catch {
    return [];
  }
}

async function fetchImage(src) {
  try {
    const res = await fetch(src, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(10000) });
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    // Raster images only: SVG can carry scripts.
    if (!res.ok || !/^image\/(png|jpeg|webp|gif|x-icon|vnd\.microsoft\.icon)$/.test(type)) return null;
    const body = Buffer.from(await res.arrayBuffer());
    return body.length > 64 && body.length < 1024 * 1024 ? { body, type } : null;
  } catch {
    return null;
  }
}

/**
 * Logo for a domain. `opts.logo` is an explicit image URL from our data; `opts.site` is the
 * organization's homepage, whose own icons are tried next. Then the favicon services.
 */
async function fetchIcon(domain, opts = {}) {
  const sources = [
    ...(opts.logo ? [opts.logo] : []),
    ...(opts.site ? await siteIconUrls(opts.site) : []),
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
  for (const src of sources) {
    const icon = await fetchImage(src);
    if (icon) return icon;
  }
  return null;
}

/** Returns { body, type } for a domain's logo, or null if none was found. Cached for a month. */
export async function getLogo(domain, opts = {}) {
  if (!DOMAIN_RE.test(domain)) return null;
  const file = path.join(LOGO_DIR, domain);
  try {
    if (store.usingRedis) {
      const hit = await store.get("logos", domain);
      if (hit && Date.now() - hit.at < MONTH) return hit.type ? { body: Buffer.from(hit.b64, "base64"), type: hit.type } : null;
    } else {
      const meta = JSON.parse(await fs.readFile(`${file}.json`, "utf8"));
      if (Date.now() - meta.at < MONTH) {
        return meta.type ? { body: await fs.readFile(`${file}.img`), type: meta.type } : null;
      }
    }
  } catch {
    // not cached yet
  }

  if (!inflight.has(domain)) {
    inflight.set(
      domain,
      fetchIcon(domain, opts)
        .then(async (icon) => {
          if (store.usingRedis) {
            await store.set("logos", domain, { at: Date.now(), type: icon?.type ?? null, b64: icon ? icon.body.toString("base64") : null }, 31 * 24 * 3600);
          } else {
            await fs.mkdir(LOGO_DIR, { recursive: true, mode: 0o700 });
            if (icon) await fs.writeFile(`${file}.img`, icon.body);
            await fs.writeFile(`${file}.json`, JSON.stringify({ at: Date.now(), type: icon?.type ?? null }));
          }
          return icon;
        })
        .finally(() => inflight.delete(domain)),
    );
  }
  return inflight.get(domain);
}
