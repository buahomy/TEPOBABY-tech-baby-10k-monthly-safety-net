// Runs a student's TypeScript for a Sierra OA problem off the main thread: compiles it with Sucrase,
// then runs the graded tests for parts 1..upTo, posting each result as it finishes. The main thread
// stops this worker if it goes quiet for too long (a synchronous infinite loop).

import { sierraProblemById } from "../../shared/sierra/problems.js";
import { SIERRA_SUITES, runSierraTest } from "../../shared/sierra/suite.js";
import { loadSierraModule } from "../../shared/sierra/compile.js";

type Job = { code: string; problemId: string; upTo: number };

const fmt = (v: unknown) => {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

self.onmessage = async (e: MessageEvent<Job>) => {
  const { code, problemId, upTo } = e.data;
  const problem = sierraProblemById.get(problemId);
  if (!problem) return;
  let logs: string[] = [];
  const push = (...a: unknown[]) => {
    if (logs.length < 200) logs.push(a.map(fmt).join(" "));
  };
  const consoleShim = { log: push, error: push, warn: push, info: push };

  let mod: Record<string, unknown>;
  try {
    mod = loadSierraModule(code, problem.entry, consoleShim);
  } catch (err) {
    const e2 = err as Error;
    self.postMessage({ type: "compile", error: `${e2?.name || "Error"}: ${e2?.message || String(err)}` });
    return;
  }

  const suites = SIERRA_SUITES[problemId] || [];
  for (let part = 0; part <= upTo && part < suites.length; part++) {
    for (const test of suites[part]) {
      logs = [];
      const r = await runSierraTest(test, mod, 4000);
      self.postMessage({ type: "test", part, ...r, stdout: logs.join("\n") });
    }
  }
  self.postMessage({ type: "done" });
};
