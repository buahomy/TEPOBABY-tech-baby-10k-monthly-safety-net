// Runs a student's JavaScript against test cases, off the main thread (so an infinite loop can be
// stopped by terminating the worker). Mirrors LeetCode's JavaScript runtime: ListNode, TreeNode,
// _Node and the @datastructures-js priority queues are available as globals.

import {
  ListNode,
  MaxPriorityQueue,
  MinPriorityQueue,
  PriorityQueue,
  TreeNode,
  _Node,
  entryNames,
  parseCase,
  runCase,
  type NcMeta,
} from "../../shared/ncJudge.js";

type Job = { code: string; slug: string; meta: NcMeta; inputs: string[] };

const fmt = (v: unknown) => {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

function errorText(err: unknown) {
  const e = err as Error;
  // Point at the student's code: the generated function adds 3 lines before it.
  const at = /<anonymous>:(\d+):(\d+)/.exec(e?.stack || "");
  const line = at ? ` (line ${Number(at[1]) - 3})` : "";
  return `${e?.name || "Error"}: ${e?.message || String(err)}${line}`;
}

self.onmessage = (e: MessageEvent<Job>) => {
  const { code, slug, meta, inputs } = e.data;
  let logs: string[] = [];
  const consoleShim = {
    log: (...a: unknown[]) => logs.push(a.map(fmt).join(" ")),
    error: (...a: unknown[]) => logs.push(a.map(fmt).join(" ")),
    warn: (...a: unknown[]) => logs.push(a.map(fmt).join(" ")),
    info: (...a: unknown[]) => logs.push(a.map(fmt).join(" ")),
  };

  let entry: Record<string, unknown>;
  try {
    const names = entryNames(slug, meta);
    const grab = names.map((n) => `${JSON.stringify(n)}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(", ");
    const factory = new Function(
      "ListNode",
      "TreeNode",
      "_Node",
      "Node",
      "MinPriorityQueue",
      "MaxPriorityQueue",
      "PriorityQueue",
      "console",
      `"use strict";\n${code}\n;return { ${grab} };`,
    );
    entry = factory(ListNode, TreeNode, _Node, _Node, MinPriorityQueue, MaxPriorityQueue, PriorityQueue, consoleShim);
  } catch (err) {
    self.postMessage({ type: "compile", error: errorText(err) });
    return;
  }

  inputs.forEach((input, i) => {
    logs = [];
    const t0 = performance.now();
    try {
      const out = runCase(slug, meta, entry, parseCase(input));
      self.postMessage({ type: "case", i, ok: true, out: out === undefined ? null : out, stdout: logs.join("\n"), ms: performance.now() - t0 });
    } catch (err) {
      self.postMessage({ type: "case", i, ok: false, error: errorText(err), stdout: logs.join("\n"), ms: performance.now() - t0 });
    }
  });
  self.postMessage({ type: "done" });
};
