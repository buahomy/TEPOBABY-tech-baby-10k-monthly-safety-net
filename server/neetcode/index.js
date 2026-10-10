// NeetCode 150 for the Technical tab: problem statements (from LeetCode, cached), test cases, and
// expected answers from our reference solutions. Students' code runs in their own browser; the
// server only hands out problems and tests.

import { Worker } from "node:worker_threads";
import { parseCase, runCase } from "../../shared/ncJudge.js";
import { getRaw, statementFor, warmCache } from "./leetcode.js";
import { PREMIUM } from "./premium.js";
import { CONCEPTS, PROBLEMS, bySlug } from "./problems.js";
import { referenceEntry } from "./reference.js";
import { EXTRA } from "./extra.js";

export { CONCEPTS, PROBLEMS, warmCache };

// ---- Statement HTML: keep LeetCode's formatting tags, drop everything else ----

const ALLOWED = new Set("p strong em b i u code pre ul ol li sup sub br span div img table thead tbody tr th td hr".split(" "));

export function sanitize(html) {
  return String(html || "")
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (tag, name, attrs) => {
      const n = name.toLowerCase();
      const closing = tag.startsWith("</");
      if (n === "font") return closing ? "</span>" : "<span>";
      if (!ALLOWED.has(n)) return "";
      if (closing) return `</${n}>`;
      if (n === "img") {
        const src = /\ssrc\s*=\s*"(https:\/\/[^"]+)"/i.exec(attrs)?.[1];
        const alt = /\salt\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] || "";
        return src ? `<img src="${src}" alt="${alt.replace(/[<>"]/g, "")}" loading="lazy">` : "";
      }
      return `<${n}>`;
    });
}

// ---- Problem payloads (built once per fetched version) ----

const built = new Map();

function expectedFor(slug, meta, input) {
  return runCase(slug, meta, referenceEntry(slug, meta), parseCase(input));
}

export async function getProblem(slug) {
  const p = bySlug.get(slug);
  if (!p) return null;
  const raw = await getRaw(slug);
  const hit = built.get(slug);
  if (hit && hit.fetchedAt === raw.fetchedAt) return hit.payload;

  const meta = raw.meta;
  const tests = (inputs) => inputs.map((input) => ({ input, expected: expectedFor(slug, meta, input) }));
  const payload = {
    ...p,
    leetcodeUrl: `https://leetcode.com/problems/${slug}/`,
    premium: raw.paid,
    content: sanitize(statementFor(slug, raw)),
    meta: {
      name: meta.name,
      params: meta.params,
      return: meta.return,
      classname: meta.classname,
      methods: meta.methods,
      output: meta.output,
    },
    snippets: PREMIUM[slug]?.snippets || raw.snippets,
    examples: tests(raw.examples),
    hidden: tests(EXTRA[slug] || []),
  };
  built.set(slug, { fetchedAt: raw.fetchedAt, payload });
  return payload;
}

export function problemList() {
  return { concepts: CONCEPTS, problems: PROBLEMS.map(({ n, slug, title, difficulty, category }) => ({ n, slug, title, difficulty, category })) };
}

/**
 * Expected answer for a student's own test input. Runs in a worker thread with a time limit, since
 * a custom input (say climbStairs(10^9)) could otherwise tie up the server.
 */
export async function customExpected(slug, input) {
  if (!bySlug.has(slug)) throw Object.assign(new Error("Unknown problem."), { status: 404 });
  const raw = await getRaw(slug);
  let args;
  try {
    args = parseCase(input);
  } catch {
    throw Object.assign(new Error("Each line must be valid JSON, like [1,2,3] or \"abc\"."), { status: 400 });
  }
  const need = raw.meta.classname ? 2 : slug === "linked-list-cycle" ? 2 : raw.meta.params.length;
  if (args.length !== need) throw Object.assign(new Error(`This problem takes ${need} line${need === 1 ? "" : "s"} of input.`), { status: 400 });

  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./expectedWorker.js", import.meta.url), { workerData: { slug, meta: raw.meta, input } });
    const timer = setTimeout(() => {
      w.terminate();
      reject(Object.assign(new Error("That input takes too long to solve. Try a smaller one."), { status: 400 }));
    }, 3000);
    w.once("message", (m) => {
      clearTimeout(timer);
      w.terminate();
      if (m.ok) resolve(m.expected);
      else reject(Object.assign(new Error(`That input doesn't fit this problem: ${m.error}`), { status: 400 }));
    });
    w.once("error", (err) => {
      clearTimeout(timer);
      reject(Object.assign(new Error(`That input doesn't fit this problem: ${err.message}`), { status: 400 }));
    });
  });
}

