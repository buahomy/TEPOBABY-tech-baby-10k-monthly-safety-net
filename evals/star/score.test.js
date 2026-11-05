import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gradesFrom, normalize, PHASES, score } from "./score.js";

const all = (value) => Object.fromEntries(PHASES.map((p) => [p, value]));
const calls = (status) => PHASES.map((phase) => ({ phase, status }));

test("both flag statuses count as a flag", () => {
  assert.equal(normalize("needs_clarification"), "flag");
  assert.equal(normalize("missing_detail"), "flag");
  assert.equal(normalize("complete"), "complete");
  assert.equal(normalize(undefined), "none");
});

test("the last call for a phase wins, like the STAR boxes", () => {
  const grades = gradesFrom([
    { phase: "Result", status: "missing_detail" },
    { phase: "Result", status: "complete" },
  ]);
  assert.equal(grades.Result, "complete");
  assert.equal(grades.Action, "none");
});

test("a perfect run scores 100%", () => {
  const s = score([{ id: "a", kind: "complete", expected: all("complete"), calls: calls("complete") }]);
  assert.deepEqual(s.phases, { correct: 4, total: 4 });
  assert.deepEqual(s.cases, { correct: 1, total: 1 });
  assert.equal(s.misses.length, 0);
});

test("a false pass on a missing Result lowers flag recall", () => {
  const expected = { ...all("complete"), Result: "flag" };
  const s = score([{ id: "a", kind: "no_result", expected, calls: calls("complete") }]);
  assert.deepEqual(s.flagRecall, { correct: 0, total: 1 });
  assert.deepEqual(s.completeAccuracy, { correct: 3, total: 3 });
  assert.deepEqual(s.cases, { correct: 0, total: 1 });
  assert.deepEqual(s.misses, [{ id: "a", phase: "Result", expected: "flag", got: "complete" }]);
});

test("an ungraded phase counts as wrong", () => {
  const s = score([{ id: "a", kind: "complete", expected: all("complete"), calls: [] }]);
  assert.equal(s.phases.correct, 0);
  assert.equal(s.ungraded, 4);
});

test("cases.json is well formed", () => {
  const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url)));
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  for (const c of cases) {
    assert.ok(["generic", "google", "amazon", "meta"].includes(c.company), c.id);
    assert.ok(c.question && c.answer && c.kind, c.id);
    for (const p of PHASES) assert.ok(["complete", "flag"].includes(c.expected[p]), `${c.id} ${p}`);
  }
});
