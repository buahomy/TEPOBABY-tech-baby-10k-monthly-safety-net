// School name from a student's .edu email domain (whitman.edu → "Whitman College"), using the
// open Hipo university-domains list. Only U.S. schools are kept, cached in server/data/schools.json
// and refreshed monthly.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "schools.json");
const SOURCE = "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";
const MAX_AGE = 30 * 24 * 3600e3;

let map = null; // domain -> school name
let loading = null;

async function refresh() {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`university list ${res.status}`);
  const list = await res.json();
  const out = {};
  for (const u of list) {
    if (u.alpha_two_code !== "US") continue;
    for (const d of u.domains || []) {
      const key = String(d).toLowerCase();
      if (!out[key]) out[key] = u.name;
    }
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ fetchedAt: Date.now(), schools: out }));
  return out;
}

async function load() {
  if (map) return map;
  loading ??= (async () => {
    try {
      const cached = JSON.parse(await fs.readFile(FILE, "utf8"));
      map = cached.schools;
      if (Date.now() - cached.fetchedAt > MAX_AGE) refresh().then((m) => (map = m)).catch(() => {});
    } catch {
      map = await refresh();
    }
    return map;
  })().finally(() => (loading = null));
  return loading;
}

/** "Whitman College" for "whitman.edu" or "cs.whitman.edu"; null if unknown. */
export async function schoolForDomain(domain) {
  let d = String(domain || "").toLowerCase();
  let schools;
  try {
    schools = await load();
  } catch (err) {
    console.warn("[connect] university list unavailable:", err.message);
    return null;
  }
  // Try the full domain, then drop subdomains (mail.cs.school.edu → cs.school.edu → school.edu).
  while (d.includes(".")) {
    // "University of Michigan - Ann Arbor" → "University of Michigan", the way LinkedIn profiles list it.
    if (schools[d]) return schools[d].split(" - ")[0].trim();
    d = d.slice(d.indexOf(".") + 1);
  }
  return null;
}
