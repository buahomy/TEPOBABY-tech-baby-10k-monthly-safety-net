// Runs every case through the real voice-agent setup and scores its STAR grades.
//
//   npm run eval:star                     all cases, once
//   npm run eval:star -- --runs 3         each case three times, to see how stable the grades are
//   npm run eval:star -- --only no-result --save
//
// Uses sessionConfig() from server/interview/realtime.js, so it tests the instructions and tools
// students get in production, on the production model. The one difference is that answers go in as
// text rather than speech, which skips transcription and keeps runs cheap.

import { readFileSync, writeFileSync } from "node:fs";
import WebSocket from "ws";
import { REALTIME_MODEL, sessionConfig } from "../../server/interview/realtime.js";
import { pct, PHASES, score } from "./score.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const RUNS = Number(arg("runs", 1));
const ONLY = arg("only", "");
const SAVE = process.argv.includes("--save");
const CONCURRENCY = 3;
const MAX_ROUNDS = 6; // tool-call rounds per answer
const TIMEOUT_MS = 60000;

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

/** Plays one answer to the agent and returns its update_star_progress calls. */
function runCase(c) {
  return new Promise((resolve, reject) => {
    const setup = sessionConfig({ company: c.company });
    const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    const send = (event) => ws.send(JSON.stringify(event));
    const calls = [];
    const usage = { input: 0, output: 0 };
    let rounds = 0;
    const timer = setTimeout(() => finish(new Error(`${c.id}: timed out`)), TIMEOUT_MS);
    function finish(err) {
      clearTimeout(timer);
      ws.close();
      if (err) reject(err);
      else resolve({ calls, usage, rounds });
    }

    ws.on("error", finish);
    ws.on("open", () => {
      send({
        type: "session.update",
        session: { type: "realtime", output_modalities: ["text"], instructions: setup.instructions, tools: setup.tools, tool_choice: setup.tool_choice },
      });
      send({
        type: "conversation.item.create",
        item: { type: "message", role: "assistant", content: [{ type: "output_text", text: c.question }] },
      });
      send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: c.answer }] },
      });
      send({ type: "response.create" });
    });
    ws.on("message", (raw) => {
      const event = JSON.parse(raw);
      if (event.type === "error") return finish(new Error(`${c.id}: ${event.error?.message}`));
      if (event.type !== "response.done") return;
      const { status, output = [], usage: u, status_details: details } = event.response;
      if (status === "failed") return finish(new Error(`${c.id}: ${JSON.stringify(details)}`));
      usage.input += u?.input_tokens ?? 0;
      usage.output += u?.output_tokens ?? 0;
      rounds += 1;
      const toolCalls = output.filter((item) => item.type === "function_call");
      for (const item of toolCalls) {
        if (item.name === "update_star_progress") calls.push(JSON.parse(item.arguments));
        send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: item.call_id, output: "ok" } });
      }
      // The agent may grade one phase per turn, so let it continue until it stops calling tools.
      if (toolCalls.length && rounds < MAX_ROUNDS) send({ type: "response.create" });
      else finish();
    });
  });
}

async function withRetry(c, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await runCase(c);
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url))).filter((c) => c.id.includes(ONLY));
const queue = Array.from({ length: RUNS }, () => cases).flat();
const results = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const { calls, usage, rounds } = await withRetry(c);
      results.push({ id: c.id, kind: c.kind, company: c.company, expected: c.expected, calls, usage, rounds });
      process.stdout.write(".");
    }
  })
);
console.log();

const s = score(results);
const line = (label, b) => console.log(`${label.padEnd(26)} ${pct(b).toFixed(1).padStart(5)}%  (${b.correct}/${b.total})`);
console.log(`Model: ${REALTIME_MODEL}  Cases: ${cases.length}  Runs: ${RUNS}`);
line("STAR parts graded right", s.phases);
line("Answers fully right", s.cases);
line("Flagged when it should", s.flagRecall);
line("Left good parts alone", s.completeAccuracy);
console.log();
for (const p of PHASES) line(p, s.byPhase[p]);
console.log();
for (const [kind, b] of Object.entries(s.byKind)) line(kind, b);
const input = results.reduce((n, r) => n + r.usage.input, 0);
const output = results.reduce((n, r) => n + r.usage.output, 0);
console.log(`\nUngraded parts: ${s.ungraded}  Tokens: ${input} in, ${output} out`);
if (s.misses.length) {
  console.log("\nMisses:");
  for (const m of s.misses) console.log(`  ${m.id} ${m.phase}: expected ${m.expected}, got ${m.got}`);
}
if (SAVE) {
  const report = { model: REALTIME_MODEL, runs: RUNS, cases: cases.length, summary: { ...s, misses: undefined }, misses: s.misses, results };
  writeFileSync(new URL("./results/latest.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
}
