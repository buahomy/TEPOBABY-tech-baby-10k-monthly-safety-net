// `node scripts/discover-startups.mjs`: finds the public job boards (Ashby, Greenhouse, Lever) of
// Y Combinator startups that are hiring, and adds them to server/jobs/companies.json, so the daily
// feed reads their roles straight from the startup's own board.
//
// Company list: yc-oss/api (a community mirror of YC's public directory, updated daily), the
// companies marked as hiring. For each one, a few likely board names are tried (its YC slug, its
// name, its website's domain); a board counts only if it has open roles and, where the board says
// its name, the name matches. Run it again any time to pick up newly hiring startups.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "jobs", "companies.json");
const YC = "https://yc-oss.github.io/api/companies/hiring.json";
const CONCURRENCY = 24;

const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "TepobabyJobFeed/1.0" }, signal: AbortSignal.timeout(15000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** The board name on each platform, if that board exists and has open roles. */
const PROBES = {
  ashby: async (slug) => {
    const d = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
    return d?.jobs?.length ? { count: d.jobs.length } : null;
  },
  greenhouse: async (slug, name) => {
    const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`);
    if (!d?.jobs?.length) return null;
    const board = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}`);
    // Greenhouse slugs are shared across all companies: make sure it's this one.
    if (board?.name && !squash(board.name).includes(squash(name).slice(0, 6)) && !squash(name).includes(squash(board.name).slice(0, 6))) return null;
    return { count: d.jobs.length };
  },
  lever: async (slug) => {
    const d = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json&limit=5`);
    return Array.isArray(d) && d.length ? { count: d.length } : null;
  },
};

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}

const companies = JSON.parse(fs.readFileSync(FILE, "utf8"));
const known = new Set(Object.values(companies).flat().flatMap((c) => [squash(c.name), squash(c.slug), c.domain]));

const yc = (await getJson(YC)) || [];
const todo = yc.filter((c) => c.status === "Active" && c.isHiring && !known.has(squash(c.name)) && !known.has(domainOf(c.website)));
console.log(`${yc.length} hiring YC companies; checking ${todo.length} new ones…`);

let done = 0;
const found = await mapLimit(todo, CONCURRENCY, async (c) => {
  const domain = domainOf(c.website);
  const slugs = [...new Set([c.slug, squash(c.name), c.name?.toLowerCase().trim().replace(/\s+/g, "-"), domain?.split(".")[0]].filter(Boolean))];
  let hit = null;
  for (const ats of ["ashby", "greenhouse", "lever"]) {
    for (const slug of slugs) {
      if (await PROBES[ats](slug, c.name)) {
        hit = { ats, slug };
        break;
      }
    }
    if (hit) break;
  }
  if (++done % 100 === 0) console.log(`  ${done}/${todo.length}`);
  if (!hit) return null;
  return { ats: hit.ats, entry: { slug: hit.slug, name: c.name, domain, startup: `YC ${String(c.batch || "").replace(/^(Winter|Summer|Spring|Fall) (\d{2})(\d{2})$/, (_, s, _a, y) => `${s[0]}${y}`)}`.trim() } };
});

const added = { ashby: 0, greenhouse: 0, lever: 0 };
for (const f of found.filter(Boolean)) {
  companies[f.ats] = companies[f.ats] || [];
  if (companies[f.ats].some((c) => c.slug === f.entry.slug)) continue;
  companies[f.ats].push(f.entry);
  added[f.ats]++;
}
for (const k of Object.keys(companies)) companies[k].sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(FILE, `${JSON.stringify(companies, null, 2)}\n`);
console.log(`Added ${added.ashby} Ashby, ${added.greenhouse} Greenhouse and ${added.lever} Lever boards → ${FILE}`);
