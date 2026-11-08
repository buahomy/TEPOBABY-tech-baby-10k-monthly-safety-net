// Recruiter demo: the features that cost money, opened to visitors with hard daily caps.
//
// Caps are counted in the store (Upstash Redis on Vercel), so they hold across every server copy
// Vercel runs, not just one. Each cap has a per-visitor limit (by IP) and a global daily limit; set
// any of them to 0 in the environment to turn that feature off for visitors.
//
//   DEMO_VOICE_DAILY        voice interview sessions a day, for all visitors together (default 10)
//   DEMO_VOICE_PER_VISITOR  sessions a day for one visitor (default 2)
//   DEMO_VOICE_MINUTES      length of a demo voice session (default 3)
//   DEMO_GEMINI_DAILY       Ask Gemini + tailored suggestions a day, all visitors (default 40)
//   DEMO_GEMINI_PER_VISITOR the same, for one visitor (default 8)

import * as store from "./store.js";

const num = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v !== undefined ? Number(v) : d);
export const demoLimits = () => ({
  voiceDaily: num(process.env.DEMO_VOICE_DAILY, 10),
  voicePerVisitor: num(process.env.DEMO_VOICE_PER_VISITOR, 2),
  voiceMinutes: num(process.env.DEMO_VOICE_MINUTES, 3),
  geminiDaily: num(process.env.DEMO_GEMINI_DAILY, 40),
  geminiPerVisitor: num(process.env.DEMO_GEMINI_PER_VISITOR, 8),
});

const day = () => new Date().toISOString().slice(0, 10);
const TTL = 2 * 86400;

async function count(key) {
  return Number(await store.get("demo", key)) || 0;
}

/** How many of `kind` are left today for this visitor (the smaller of the two caps). */
export async function demoLeft(kind, visitor) {
  const l = demoLimits();
  const [daily, mine] = kind === "voice" ? [l.voiceDaily, l.voicePerVisitor] : [l.geminiDaily, l.geminiPerVisitor];
  const [all, me] = await Promise.all([count(`${kind}:${day()}`), count(`${kind}:${day()}:${visitor}`)]);
  return Math.max(0, Math.min(daily - all, mine - me));
}

/** Uses one of today's `kind` for this visitor. False when a cap is reached. */
export async function takeDemo(kind, visitor) {
  if ((await demoLeft(kind, visitor)) <= 0) return false;
  const all = `${kind}:${day()}`;
  const me = `${kind}:${day()}:${visitor}`;
  await Promise.all([store.set("demo", all, (await count(all)) + 1, TTL), store.set("demo", me, (await count(me)) + 1, TTL)]);
  return true;
}
