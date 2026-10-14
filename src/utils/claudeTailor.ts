// Résumé tailoring with Claude, on the student's own Anthropic API key. The key stays in this
// browser and goes only to Anthropic (the SDK runs client-side with dangerouslyAllowBrowser, which
// is acceptable here because it's the student's own key on their own device).
// The SDK is loaded on first use, so it isn't part of the app's first download.

import type { TailorTips } from "./ginny";

const KEY = "tepobaby.anthropicKey";

export function getAnthropicKey(): string {
  try {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function saveAnthropicKey(key: string, remember: boolean) {
  try {
    clearAnthropicKey();
    (remember ? localStorage : sessionStorage).setItem(KEY, key);
  } catch {
    // storage blocked: works for this visit only
  }
}

export function clearAnthropicKey() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export const looksLikeAnthropicKey = (k: string) => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim());

async function client(apiKey: string) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return { Anthropic, client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) };
}

/** Checks the key with Anthropic. Returns null if it works, or a message. */
export async function checkAnthropicKey(apiKey: string): Promise<string | null> {
  const { Anthropic, client: c } = await client(apiKey);
  try {
    await c.models.list({ limit: 1 });
    return null;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return "Anthropic didn't accept that key. Copy it again from console.anthropic.com.";
    if (e instanceof Anthropic.PermissionDeniedError) return "That key doesn't have API access. Check it in console.anthropic.com.";
    if (e instanceof Anthropic.RateLimitError) return null;
    return "Couldn't reach Anthropic. Check your connection and try again.";
  }
}

/** Thrown when the key itself is the problem, so the app can ask for a new one. */
export class AnthropicKeyError extends Error {}

const SYSTEM = [
  "You are a senior tech recruiter helping a U.S. college student tailor their resume to one new grad or early-career job.",
  "Hard rules:",
  "- Never invent experience, employers, tools, numbers or results. Rewrite only using facts already in the original bullet.",
  "- Where a number would help but isn't known, use a placeholder like [X%], [N users] or [Y ms] for the student to fill in honestly.",
  "- Use the job's exact keywords only when the original bullet genuinely supports them.",
  "- Each improved bullet: under 30 words, starts with a strong action verb, shows action, what, and result.",
  "- Copy each `original` exactly, character for character, from the resume so it can be found and replaced.",
].join("\n");

/** Claude's rewrites for one job: same shape as Ginny's Gemini suggestions. */
export async function claudeTailor(
  apiKey: string,
  input: { jobTitle: string; company: string; requirements: string[]; missingSkills: string[]; gaps: string[]; resumeText: string },
): Promise<TailorTips> {
  const [{ Anthropic, client: c }, { z }, { betaZodOutputFormat }] = await Promise.all([
    client(apiKey),
    import("zod"),
    import("@anthropic-ai/sdk/helpers/beta/zod"),
  ]);

  const Tips = z.object({
    summary: z.string(),
    rewrites: z.array(z.object({ original: z.string(), improved: z.string(), requirement: z.string(), why: z.string() })),
    addKeywords: z.array(z.object({ keyword: z.string(), where: z.string() })),
    projectIdea: z.object({ title: z.string(), description: z.string(), skills: z.array(z.string()) }),
  });

  const prompt = [
    `Job: ${input.jobTitle} at ${input.company}`,
    `Requirements:\n${input.requirements.map((r) => `- ${r}`).join("\n")}`,
    input.missingSkills.length ? `Skills the job wants that the resume doesn't show: ${input.missingSkills.join(", ")}` : "",
    input.gaps.length ? `Requirements with little evidence:\n${input.gaps.map((g) => `- ${g}`).join("\n")}` : "",
    `Resume (personal info removed):\n${input.resumeText}`,
    "Give 3 to 5 rewrites of the bullets that matter most for this job, keywords to add only where the student has really used them, a 2-sentence summary of advice, and one 1–2 weekend project that would honestly close the biggest gap.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const message = await c.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Server-side fallback: if Claude declines, Anthropic re-runs the request on its recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(Tips) },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (message.stop_reason === "refusal") throw new Error("Claude declined to rewrite this resume. Try again, or use Gemini.");
    const tips = message.parsed_output;
    if (!tips) throw new Error("Claude's suggestions came back in an unexpected format. Try again.");
    return {
      summary: tips.summary,
      rewrites: tips.rewrites.slice(0, 5),
      addKeywords: tips.addKeywords.slice(0, 8),
      projectIdea: tips.projectIdea,
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AnthropicKeyError("Anthropic didn't accept your API key. Enter it again.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new AnthropicKeyError("Your Anthropic key doesn't have access to this model.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Anthropic is rate-limiting your key (or it's out of credits). Try again in a minute, or check console.anthropic.com/settings/billing.");
    if (e instanceof Anthropic.APIError) throw new Error(`Claude couldn't finish (error ${e.status}). Try again.`);
    throw e;
  }
}
