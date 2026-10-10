// Where the server keeps data.
// - On Vercel (or anywhere with Upstash Redis configured): Upstash Redis over its REST API, since
//   serverless functions have no lasting disk. Vercel's Upstash integration sets KV_REST_API_URL /
//   KV_REST_API_TOKEN; UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN work too.
// - Locally: JSON files in server/data/ (git-ignored), as before. A "collection" is one file
//   ({ key: value }), so existing profiles.json / saved-jobs.json keep working.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const usingRedis = !!(REDIS_URL && REDIS_TOKEN);
export const onVercel = !!process.env.VERCEL;

if (onVercel && !usingRedis) {
  console.warn("[store] No Upstash Redis configured: data won't persist on Vercel. Connect Upstash Redis to the project.");
}

// ---- Upstash Redis (REST) ----

async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`Redis ${command[0]} failed: ${body.error || res.status}`);
  return body.result;
}

// ---- Local JSON files ----

const files = new Map(); // collection -> Promise<object>
let writes = Promise.resolve();

const fileFor = (collection) => path.join(DATA, `${collection}.json`);

function loadFile(collection) {
  if (!files.has(collection)) {
    files.set(
      collection,
      fs
        .readFile(fileFor(collection), "utf8")
        .then((t) => JSON.parse(t))
        .catch((err) => {
          if (err.code === "ENOENT") return {};
          throw err;
        }),
    );
  }
  return files.get(collection);
}

function saveFile(collection, all) {
  // Write-then-rename so a crash never leaves a half-written file; owner-only permissions.
  writes = writes
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(DATA, { recursive: true, mode: 0o700 });
      const file = fileFor(collection);
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(all), { mode: 0o600 });
      await fs.rename(tmp, file);
    });
  return writes;
}

// ---- API ----

/** One value from a collection (e.g. ("profiles", sub)), or null. */
export async function get(collection, key) {
  if (usingRedis) {
    const raw = await redis(["GET", `${collection}:${key}`]);
    return raw == null ? null : JSON.parse(raw);
  }
  const all = await loadFile(collection);
  return all[key] ?? null;
}

/** Saves a value. `ttlSeconds` (Redis only) lets caches expire on their own. */
export async function set(collection, key, value, ttlSeconds) {
  if (usingRedis) {
    const cmd = ["SET", `${collection}:${key}`, JSON.stringify(value)];
    if (ttlSeconds) cmd.push("EX", String(ttlSeconds));
    await redis(cmd);
    return;
  }
  const all = await loadFile(collection);
  all[key] = value;
  await saveFile(collection, all);
}

export async function del(collection, key) {
  if (usingRedis) {
    await redis(["DEL", `${collection}:${key}`]);
    return;
  }
  const all = await loadFile(collection);
  if (key in all) {
    delete all[key];
    await saveFile(collection, all);
  }
}
