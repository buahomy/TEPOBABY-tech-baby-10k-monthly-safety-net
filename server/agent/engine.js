// AI Agent: "✨ Generate" (on a saved job) runs each curation round with Claude Code.
//
// When Tepobaby's server runs on a computer with Claude Code installed and signed in (e.g. `npm run dev`
// on the author's Mac), it runs `claude -p` headless with no tools, on that computer's Claude plan.
// No API key. On the live site (Vercel), Generate reaches Claude Code on the author's Mac through the
// relay (server/relay.js); with neither, Generate reports that it isn't available.
//
// The rules live in shared/agentPrompt.js, and the browser re-checks every reply against the student's
// Applicant's resources before using it.

import { spawn, spawnSync } from "node:child_process";
import { CURATE_SHAPE, CURATE_SYSTEM, curatePrompt } from "../../shared/agentPrompt.js";

const CLAUDE_BIN = process.env.CLAUDE_CODE_BIN || "claude";

let cliOk = null;
function claudeCodeAvailable() {
  if (process.env.VERCEL || process.env.AGENT_CLAUDE_CODE === "off") return false;
  if (cliOk === null) {
    const r = spawnSync(CLAUDE_BIN, ["--version"], { encoding: "utf8", timeout: 15000 });
    cliOk = r.status === 0 && /claude code/i.test(r.stdout || "");
  }
  return cliOk;
}

/** "claude-code" when Generate can run here, otherwise null. */
export const engine = () => (claudeCodeAvailable() ? "claude-code" : null);

/** The JSON object inside a model's text reply (tolerates code fences and text around it). */
function jsonFrom(text) {
  const raw = String(text || "").replace(/```(json)?/gi, "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Claude's reply wasn't JSON.");
  }
}

// ---- Claude Code, headless ----

function runClaudeCode(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      CLAUDE_BIN,
      ["-p", "--output-format", "json", "--tools", "", "--no-session-persistence", "--system-prompt", `${CURATE_SYSTEM}\nReply with ONLY JSON in exactly this shape: ${CURATE_SHAPE}`],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(Object.assign(new Error("Claude Code took too long. Try again."), { status: 504 }));
    }, 240000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const res = JSON.parse(out);
        if (res.is_error || code !== 0) throw new Error(res.result || err.slice(0, 200) || `Claude Code exited with ${code}`);
        resolve(jsonFrom(res.result));
      } catch (e) {
        reject(Object.assign(new Error(`Claude Code couldn't finish: ${e.message}`), { status: 502 }));
      }
    });
    child.stdin.end(prompt);
  });
}

/**
 * One curation round with Claude Code.
 * @param {Parameters<typeof curatePrompt>[0]} input
 */
export async function generateRound(input) {
  if (!engine()) throw Object.assign(new Error("Generate needs Claude Code on this computer."), { status: 503 });
  return { engine: "claude-code", curated: await runClaudeCode(curatePrompt(input)) };
}
