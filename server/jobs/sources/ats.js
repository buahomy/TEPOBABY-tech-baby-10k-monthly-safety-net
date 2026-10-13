// Company job boards via their public ATS APIs (no HTML scraping).
// The company list lives in server/jobs/companies.json — add slugs there to widen coverage.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classify, cleanText, fetchJson, isProgram, isRelevant, mapLimit, maxAgeFor, normalizeUrl } from "../classify.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const PROVIDERS = {
  greenhouse: {
    url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    jobs: (d) => d.jobs || [],
    map: (j) => ({
      id: j.id,
      title: j.title,
      location: j.location?.name,
      url: j.absolute_url,
      posted: j.first_published || j.updated_at,
    }),
  },
  lever: {
    // `mode=json` without descriptions is still large for big boards; skip=0&limit keeps it bounded.
    url: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json&limit=500`,
    jobs: (d) => (Array.isArray(d) ? d : []),
    map: (j) => ({
      id: j.id,
      title: j.text,
      location: j.categories?.location,
      url: j.hostedUrl,
      posted: j.createdAt,
    }),
  },
  ashby: {
    url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
    jobs: (d) => (d.jobs || []).filter((j) => j.isListed !== false),
    map: (j) => ({
      id: j.id,
      title: j.title,
      location: [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean).join(" · "),
      url: j.jobUrl,
      posted: j.publishedAt,
    }),
  },
};

export async function loadCompanies() {
  return JSON.parse(await fs.readFile(path.join(here, "..", "companies.json"), "utf8"));
}

async function fromBoard(provider, slug, company, domain, now) {
  const p = PROVIDERS[provider];
  const data = await fetchJson(p.url(slug), { timeoutMs: 30000 });
  const out = [];
  for (const raw of p.jobs(data)) {
    const j = p.map(raw);
    const posted = new Date(j.posted).getTime();
    const title = cleanText(j.title);
    if (!j.url || !posted || now - posted > maxAgeFor(title)) continue;
    if (!isRelevant(title)) continue;
    const level = classify(title);
    if (!level) continue;
    out.push({
      id: `${provider}:${slug}:${j.id}`,
      source: `${provider[0].toUpperCase()}${provider.slice(1)}`,
      company,
      title,
      location: cleanText(j.location) || "—",
      url: normalizeUrl(j.url),
      postedAt: new Date(posted).toISOString(),
      postedApprox: false,
      level,
      sponsorship: null,
      domain: domain || null,
      program: isProgram(title),
    });
  }
  return out;
}

export async function fetchCompanyBoards() {
  const now = Date.now();
  const companies = await loadCompanies();
  const boards = Object.entries(companies).flatMap(([provider, list]) =>
    PROVIDERS[provider] ? list.map((c) => ({ provider, ...c })) : [],
  );

  const results = await mapLimit(boards, 6, async (b) => {
    try {
      return { ok: true, postings: await fromBoard(b.provider, b.slug, b.name, b.domain, now) };
    } catch (err) {
      return { ok: false, board: `${b.provider}/${b.slug}`, error: err.message, postings: [] };
    }
  });

  const failed = results.filter((r) => !r.ok);
  return [
    {
      name: "Company job boards (Greenhouse, Lever, Ashby)",
      postings: results.flatMap((r) => r.postings),
      error: failed.length ? `${failed.length}/${boards.length} boards failed: ${failed.slice(0, 5).map((f) => f.board).join(", ")}` : undefined,
    },
  ];
}
