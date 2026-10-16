// AI Agent: who writes each curated resume when the student taps "Generate".
//
//   1. Claude Code (local): when Tepobaby runs on a computer with Claude Code installed and signed in
//      (e.g. `npm run dev` on the author's Mac), the server runs `claude -p` headless with no tools.
//      It uses that computer's Claude plan, with no API key.
//   2. Claude API (live site): on Vercel there's no Claude Code, so the server calls Claude Opus 5.5
//      with Tepobaby's ANTHROPIC_API_KEY. Signed-in students only, with per-student and site-wide
//      daily caps, because Tepobaby pays for these calls.
//   3. Neither: the app falls back to copy/paste (the student runs the prompt in Claude Code).
//
// Both follow the same rules (shared/agentPrompt.js), and the browser re-checks every reply against
// the student's experience bank before using it.

import { spawn, spawnSync } from "node:child_process";
import { CURATE_SHAPE, CURATE_SYSTEM, curatePrompt } from "../../shared/agentPrompt.js";
import * as store from "../store.js";

const CLAUDE_BIN = process.env.CLAUDE_CODE_BIN || "claude";
const API_MODEL = "claude-opus-5-5";
export const PER_STUDENT_DAILY = Number(process.env.AGENT_API_STUDENT_DAILY) || 30; // rounds
export const SITE_DAILY = Number(process.env.AGENT_API_DAILY_CAP) || 300; // rounds

let cliOk = null;
function claudeCodeAvailable() {
  if (process.env.VERCEL || process.env.AGENT_CLAUDE_CODE === "off") return false;
  if (cliOk === null) {
    const r = spawnSync(CLAUDE_BIN, ["--version"], { encoding: "utf8", timeout: 15000 });
    cliOk = r.status === 0 && /claude code/i.test(r.stdout || "");
  }
  return cliOk;
}

const apiAvailable = () => !!process.env.ANTHROPIC_API_KEY;

/** "claude-code" | "api" | null */
export function engine() {
  if (claudeCodeAvailable()) return "claude-code";
  if (apiAvailable()) return "api";
  return null;
}

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

// ---- 1. Claude Code, headless ----

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

// ---- 2. Claude API ----

let apiClient = null;
async function runApi(prompt) {
  const [{ default: Anthropic }, { z }, { betaZodOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("zod"),
    import("@anthropic-ai/sdk/helpers/beta/zod"),
  ]);
  apiClient ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  const Curation = z.object({
    entries: z.array(z.object({ entryId: z.string(), bullets: z.array(z.object({ bulletId: z.string(), text: z.string() })) })),
    skills: z.array(z.string()),
    note: z.string(),
    questions: z.array(z.object({ question: z.string(), kind: z.enum(["skill", "detail"]), skill: z.string(), entryId: z.string() })),
  });
  try {
    const message = await apiClient.beta.messages.parse({
      model: API_MODEL,
      max_tokens: 16000,
      // Server-side fallback: if Claude declines, Anthropic re-runs the request on its recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(Curation) },
      system: CURATE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (message.stop_reason === "refusal") throw Object.assign(new Error("Claude declined to curate this resume."), { status: 422 });
    if (!message.parsed_output) throw Object.assign(new Error("Claude's reply came back in an unexpected format."), { status: 502 });
    return message.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw Object.assign(new Error("Claude is busy right now. Try again in a minute."), { status: 429 });
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error("[agent] Anthropic key problem:", e.status);
      throw Object.assign(new Error("Generate isn't available right now."), { status: 503 });
    }
    if (e instanceof Anthropic.APIError) throw Object.assign(new Error(`Claude couldn't finish (error ${e.status}). Try again.`), { status: 502 });
    throw e;
  }
}

/** Counts one API round against the student's and the site's daily caps. Throws 429 when over. */
async function spendApiRound(sub) {
  const day = new Date().toISOString().slice(0, 10);
  const mine = (await store.get("agent-api", `${day}:${sub}`)) || 0;
  const site = (await store.get("agent-api", `${day}:site`)) || 0;
  if (mine >= PER_STUDENT_DAILY) throw Object.assign(new Error(`You've used today's ${PER_STUDENT_DAILY} Generate rounds. More tomorrow.`), { status: 429 });
  if (site >= SITE_DAILY) throw Object.assign(new Error("Generate has hit today's limit for everyone. Try again tomorrow."), { status: 429 });
  await store.set("agent-api", `${day}:${sub}`, mine + 1, 2 * 86400);
  await store.set("agent-api", `${day}:site`, site + 1, 2 * 86400);
}

/**
 * One curation round with whichever engine is available.
 * @param {Parameters<typeof curatePrompt>[0]} input
 * @param {{ sub?: string }} who signed-in student (required for the API engine)
 */
export async function generateRound(input, who) {
  const which = engine();
  if (!which) throw Object.assign(new Error("Generate isn't set up here. Use the copy and paste steps instead."), { status: 503 });
  if (which === "claude-code") return { engine: which, curated: await runClaudeCode(curatePrompt(input)) };
  if (!who.sub) throw Object.assign(new Error("Sign in with your .edu account to use Generate."), { status: 401 });
  await spendApiRound(who.sub);
  return { engine: which, curated: await runApi(curatePrompt(input)) };
}
