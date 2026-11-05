// Scores the voice agent's STAR grades against hand-labeled expectations. No network, no API key.
//
// Labels are two-way on purpose: "complete" or "flag". The agent's two flag statuses
// (needs_clarification, missing_detail) both ask the candidate to do more, and the line between them
// is a judgment call, so the eval doesn't penalize which of the two it picked.

export const PHASES = ["Situation", "Task", "Action", "Result"];

/** Turns a raw tool status into complete / flag / none (the agent never graded this phase). */
export function normalize(status) {
  if (status === "complete") return "complete";
  if (status === "needs_clarification" || status === "missing_detail") return "flag";
  return "none";
}

/** Reduces tool calls to one grade per phase. The last call wins, as it does in the app's STAR boxes. */
export function gradesFrom(calls) {
  const grades = Object.fromEntries(PHASES.map((p) => [p, "none"]));
  for (const call of calls) if (PHASES.includes(call.phase)) grades[call.phase] = normalize(call.status);
  return grades;
}

/**
 * results: [{ id, kind, expected, calls }]
 * "none" counts as wrong: the instructions tell the agent to grade every component it hears or skips.
 */
export function score(results) {
  const empty = () => ({ correct: 0, total: 0 });
  const totals = {
    phases: empty(),
    cases: empty(),
    byPhase: Object.fromEntries(PHASES.map((p) => [p, empty()])),
    byKind: {},
    flagRecall: empty(), // of the parts that deserved a flag, how many got one
    completeAccuracy: empty(), // of the parts that were fine, how many were left alone
    ungraded: 0,
    misses: [],
  };
  for (const r of results) {
    const grades = gradesFrom(r.calls);
    const kind = (totals.byKind[r.kind] ??= empty());
    let allRight = true;
    for (const phase of PHASES) {
      const want = r.expected[phase];
      const got = grades[phase];
      const right = want === got;
      for (const bucket of [totals.phases, totals.byPhase[phase], kind, want === "flag" ? totals.flagRecall : totals.completeAccuracy]) {
        bucket.total += 1;
        if (right) bucket.correct += 1;
      }
      if (got === "none") totals.ungraded += 1;
      if (!right) {
        allRight = false;
        totals.misses.push({ id: r.id, phase, expected: want, got });
      }
    }
    totals.cases.total += 1;
    if (allRight) totals.cases.correct += 1;
  }
  return totals;
}

export const pct = ({ correct, total }) => (total ? (100 * correct) / total : 0);
