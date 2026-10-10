// NeetCode 150 data from our server (statements come from LeetCode, cached server-side).
import type { NcMeta } from "../../shared/ncJudge.js";

export type Concept = { id: string; label: string };
export type Difficulty = "Easy" | "Medium" | "Hard";
export type ProblemSummary = { n: number; slug: string; title: string; difficulty: Difficulty; category: string };
export type TestCase = { input: string; expected: unknown };
export type Problem = ProblemSummary & {
  concepts: string[];
  why: string;
  judge?: string;
  leetcodeUrl: string;
  premium: boolean;
  content: string;
  meta: NcMeta;
  snippets: { python3: string; javascript: string };
  examples: TestCase[];
  hidden: TestCase[];
};

let listCache: Promise<{ concepts: Concept[]; problems: ProblemSummary[] }> | null = null;

export function getProblemList() {
  listCache ??= fetch("/api/neetcode")
    .then((r) => {
      if (!r.ok) throw new Error("Couldn't load the NeetCode 150.");
      return r.json();
    })
    .catch((err) => {
      listCache = null;
      throw err;
    });
  return listCache;
}

const problemCache = new Map<string, Promise<Problem>>();

export function getProblem(slug: string) {
  if (!problemCache.has(slug)) {
    problemCache.set(
      slug,
      fetch(`/api/neetcode/problem/${encodeURIComponent(slug)}`)
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(body.error || "Couldn't load this problem.");
          return body as Problem;
        })
        .catch((err) => {
          problemCache.delete(slug);
          throw err;
        }),
    );
  }
  return problemCache.get(slug)!;
}

/** Expected answer for a custom test input, from the server's reference solution. */
export async function getExpected(slug: string, input: string): Promise<unknown> {
  const r = await fetch("/api/neetcode/expected", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XmlHttpRequest" },
    body: JSON.stringify({ slug, input }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Couldn't check that input.");
  return body.expected;
}
