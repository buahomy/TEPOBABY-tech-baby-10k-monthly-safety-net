// Fetches NeetCode 150 problem statements from LeetCode's public GraphQL endpoint and caches them
// (server/data/neetcode.json locally, one Upstash Redis key per problem on Vercel; re-fetched
// weekly). Subscriber-only problems come back without a statement, so those use our own write-ups
// in premium.js; their test inputs and signatures still come from LeetCode.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROBLEMS } from "./problems.js";
import { PREMIUM } from "./premium.js";
import * as store from "../store.js";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "neetcode.json");
const MAX_AGE = 7 * 24 * 3600e3;
const QUERY = `query q($slug: String!) { question(titleSlug: $slug) {
  questionFrontendId title difficulty isPaidOnly content exampleTestcaseList metaData
  codeSnippets { langSlug code } } }`;

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

let saving = Promise.resolve();
function save() {
  saving = saving.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE + ".tmp", JSON.stringify(cache));
    await fs.rename(FILE + ".tmp", FILE);
  });
  return saving;
}

async function fetchOne(slug) {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `https://leetcode.com/problems/${slug}/`,
      "User-Agent": "Mozilla/5.0 (Tepobaby interview prep)",
    },
    body: JSON.stringify({ query: QUERY, variables: { slug } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`LeetCode ${res.status}`);
  const q = (await res.json())?.data?.question;
  if (!q?.metaData) throw new Error("no question data");
  const snippet = (lang) => q.codeSnippets?.find((s) => s.langSlug === lang)?.code || "";
  return {
    id: q.questionFrontendId,
    paid: !!q.isPaidOnly,
    content: q.content || null,
    examples: q.exampleTestcaseList || [],
    meta: JSON.parse(q.metaData),
    snippets: { python3: snippet("python3"), javascript: snippet("javascript") },
    fetchedAt: Date.now(),
  };
}

/** Raw LeetCode data for one problem: from the cache, or fetched now. */
export async function getRaw(slug, { refresh = false } = {}) {
  if (store.usingRedis) {
    const hit = await store.get("neetcode", slug);
    if (hit && !refresh && Date.now() - hit.fetchedAt < MAX_AGE) return hit;
    try {
      const fresh = await fetchOne(slug);
      await store.set("neetcode", slug, fresh);
      return fresh;
    } catch (err) {
      if (hit) return hit;
      throw err;
    }
  }
  const c = await load();
  const hit = c[slug];
  if (hit && !refresh && Date.now() - hit.fetchedAt < MAX_AGE) return hit;
  try {
    c[slug] = await fetchOne(slug);
    await save();
  } catch (err) {
    if (!hit) throw err;
    console.warn(`[neetcode] refresh failed for ${slug}: ${err.message}; using cached copy`);
  }
  return c[slug];
}

export const statementFor = (slug, raw) => PREMIUM[slug]?.content || raw.content || "";

/** Fetches anything missing or stale, one request at a time so LeetCode isn't hammered. */
export async function warmCache({ log = false } = {}) {
  const c = await load();
  let fetched = 0;
  for (const p of PROBLEMS) {
    const hit = c[p.slug];
    if (hit && Date.now() - hit.fetchedAt < MAX_AGE) continue;
    try {
      await getRaw(p.slug, { refresh: true });
      fetched++;
      if (log) console.log(`[neetcode] ${p.n}. ${p.slug}`);
    } catch (err) {
      console.warn(`[neetcode] couldn't fetch ${p.slug}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return fetched;
}
