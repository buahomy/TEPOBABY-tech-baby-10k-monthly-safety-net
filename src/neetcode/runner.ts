// Runs a student's code in a web worker and grades each case like LeetCode. A case that runs past
// the time limit stops the worker ("Time Limit Exceeded"); a fresh worker is started next time.

import { accepts, parseCase } from "../../shared/ncJudge.js";
import type { Problem, TestCase } from "./api";

export type Lang = "python3" | "javascript";
export type CaseResult = {
  input: string;
  expected: unknown;
  ok: boolean; // ran without an error
  passed: boolean;
  out?: unknown;
  error?: string;
  stdout: string;
  ms: number;
};
export type RunOutcome =
  | { kind: "compile"; error: string }
  | { kind: "tle"; index: number; results: CaseResult[] }
  | { kind: "done"; results: CaseResult[] };

const LIMIT: Record<Lang, number> = { javascript: 3000, python3: 8000 };

const workers: Partial<Record<Lang, Worker>> = {};
const pyReady: { promise?: Promise<void> } = {};

function spawn(lang: Lang) {
  workers[lang] =
    lang === "python3"
      ? new Worker(new URL("./pyWorker.ts", import.meta.url), { type: "module" })
      : new Worker(new URL("./jsWorker.ts", import.meta.url), { type: "module" });
  if (lang === "python3") pyReady.promise = undefined;
  return workers[lang]!;
}

/** Starts loading Python (about 10 MB, cached by the browser after the first time). */
export function warmPython(): Promise<void> {
  if (pyReady.promise) return pyReady.promise;
  const w = workers.python3 || spawn("python3");
  pyReady.promise = new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "ready") resolve();
      else if (e.data?.type === "loadError") reject(new Error("Couldn't load Python in your browser. Check your connection."));
      else return;
      w.removeEventListener("message", onMsg);
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ type: "warm" });
  });
  pyReady.promise.catch(() => (pyReady.promise = undefined));
  return pyReady.promise;
}

export async function runTests(lang: Lang, code: string, problem: Problem, cases: TestCase[]): Promise<RunOutcome> {
  if (lang === "python3") await warmPython();
  const w = workers[lang] || spawn(lang);
  const results: CaseResult[] = [];

  return new Promise((resolve) => {
    let timer = 0;
    const arm = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        w.removeEventListener("message", onMsg);
        w.terminate();
        delete workers[lang];
        if (lang === "python3") pyReady.promise = undefined;
        resolve({ kind: "tle", index: results.length, results });
      }, LIMIT[lang]);
    };
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "compile") {
        clearTimeout(timer);
        w.removeEventListener("message", onMsg);
        resolve({ kind: "compile", error: m.error });
      } else if (m.type === "case") {
        const c = cases[m.i];
        let args: unknown[] = [];
        try {
          args = parseCase(c.input);
        } catch {
          // custom input that isn't valid JSON: the worker reported the error already
        }
        results.push({
          input: c.input,
          expected: c.expected,
          ok: m.ok,
          passed: m.ok && accepts(problem.judge, c.expected, m.out, args),
          out: m.out,
          error: m.error,
          stdout: m.stdout || "",
          ms: m.ms || 0,
        });
        arm();
      } else if (m.type === "done") {
        clearTimeout(timer);
        w.removeEventListener("message", onMsg);
        resolve({ kind: "done", results });
      }
    };
    w.addEventListener("message", onMsg);
    arm();
    w.postMessage({ code, slug: problem.slug, meta: problem.meta, inputs: cases.map((c) => c.input) });
  });
}

/** Pretty-prints a value the way LeetCode shows it. */
export function show(v: unknown): string {
  if (v === undefined) return "undefined";
  return JSON.stringify(v);
}
