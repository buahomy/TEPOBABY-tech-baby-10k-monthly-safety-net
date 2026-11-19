// Checks the Sierra OA practice set (npm run test:unit): every reference solution passes every part's
// tests, and every starter fails them, so the tests actually test something.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SIERRA_PROBLEMS } from "../shared/sierra/problems.js";
import { SIERRA_SUITES, runSierraTest } from "../shared/sierra/suite.js";
import { loadProblemModule } from "../shared/sierra/compile.js";

for (const problem of SIERRA_PROBLEMS) {
  test(`${problem.id}: has a suite for every part`, () => {
    assert.equal(SIERRA_SUITES[problem.id]?.length, problem.parts.length);
  });

  test(`${problem.id}: reference solution passes every test`, async () => {
    const mod = loadProblemModule(problem, problem.reference);
    for (const [i, suite] of SIERRA_SUITES[problem.id].entries()) {
      for (const t of suite) {
        const r = await runSierraTest(t, mod, 8000);
        assert.ok(r.passed, `part ${i + 1} · ${t.name}: ${r.error}`);
      }
    }
  });

  test(`${problem.id}: starter code fails the tests`, async () => {
    const mod = loadProblemModule(problem, problem.starter);
    const r = await runSierraTest(SIERRA_SUITES[problem.id][0][0], mod, 2000);
    assert.equal(r.passed, false);
  });
}
