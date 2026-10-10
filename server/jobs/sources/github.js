// Community-maintained GitHub lists of student roles.
// Simplify-style repos publish structured data at .github/scripts/listings.json (exact posting
// timestamps, sponsorship, active flag), which beats parsing the README tables. Repos without it
// fall back to parsing the README's Markdown table.

import { DAY, MAX_AGE_MS, classify, cleanText, fetchJson, fetchText, normalizeUrl, sponsorship } from "../classify.js";

const RAW = "https://raw.githubusercontent.com";

// hint: what the list contains, used when the title alone is ambiguous.
export const JSON_LISTS = [
  { repo: "SimplifyJobs/Summer2027-Internships", branch: "dev", hint: "internship" },
  { repo: "SimplifyJobs/New-Grad-Positions", branch: "dev", hint: "entry" },
  { repo: "pittcsc/Summer2027-Internships", branch: "dev", hint: "internship" },
  { repo: "vanshb03/Summer2027-Internships", branch: "dev", hint: "internship" },
];

export const MARKDOWN_LISTS = [{ repo: "speedyapply/2027-SWE-College-Jobs", branch: "main", hint: null }];

async function fromJsonList({ repo, branch, hint }, now) {
  const rows = await fetchJson(`${RAW}/${repo}/${branch}/.github/scripts/listings.json`, { timeoutMs: 45000, cache: true });
  const out = [];
  for (const r of rows) {
    if (r.active === false || r.is_visible === false || !r.url || !r.date_posted) continue;
    const posted = r.date_posted * 1000;
    if (now - posted > MAX_AGE_MS) continue;
    const title = cleanText(r.title);
    const level = classify(title, hint);
    if (!level) continue;
    out.push({
      id: `gh:${r.id}`,
      source: repo,
      company: cleanText(r.company_name),
      title,
      location: (r.locations || []).map(cleanText).join(" · ") || "—",
      url: normalizeUrl(r.url),
      postedAt: new Date(posted).toISOString(),
      postedApprox: false,
      level,
      sponsorship: sponsorship(r.sponsorship, r.title),
    });
  }
  return out;
}

/** Parses "| Company | Position | Location | ... | <a href=URL> | 3d |" rows (speedyapply format). */
async function fromMarkdownList({ repo, branch, hint }, now) {
  const md = await fetchText(`${RAW}/${repo}/${branch}/README.md`, { timeoutMs: 45000, cache: true });
  const out = [];
  let lastCompany = "";
  for (const line of md.split("\n")) {
    if (!line.startsWith("|") || /^\|\s*-/.test(line) || /\|\s*Company\s*\|/i.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const href = line.match(/href="([^"]+)"[^>]*>\s*<img[^>]*alt="Apply"/i)?.[1];
    const age = cells[cells.length - 1].match(/^(\d+)\s*d$/i)?.[1];
    if (!href || age === undefined) continue;

    const companyCell = cleanText(cells[0]);
    const company = companyCell === "↳" ? lastCompany : companyCell;
    lastCompany = company;
    const rawTitle = cells[1];
    const title = cleanText(rawTitle);
    const level = classify(title, hint);
    // Only whole days are known; place it mid-day so "0d" doesn't outrank exact timestamps.
    const posted = now - Number(age) * DAY - DAY / 2;
    if (!level || now - posted > MAX_AGE_MS) continue;

    out.push({
      id: `md:${normalizeUrl(href)}`,
      source: repo,
      company,
      title,
      location: cleanText(cells[2]) || "—",
      url: normalizeUrl(href),
      postedAt: new Date(posted).toISOString(),
      postedApprox: true, // the list only gives whole days
      level,
      sponsorship: sponsorship("", rawTitle),
    });
  }
  return out;
}

export async function fetchGithubLists() {
  const now = Date.now();
  const jobs = [
    ...JSON_LISTS.map((l) => ({ name: l.repo, run: () => fromJsonList(l, now) })),
    ...MARKDOWN_LISTS.map((l) => ({ name: l.repo, run: () => fromMarkdownList(l, now) })),
  ];
  return Promise.all(
    jobs.map(async (j) => {
      try {
        return { name: j.name, postings: await j.run() };
      } catch (err) {
        return { name: j.name, postings: [], error: err.message };
      }
    }),
  );
}
