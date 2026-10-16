// AI Agent: résumé curation with Claude, on the student's own Anthropic API key. The key stays in this
// browser and goes only to Anthropic (the SDK runs client-side with dangerouslyAllowBrowser, which
// is acceptable here because it's the student's own key on their own device).
// The SDK is loaded on first use, so it isn't part of the app's first download.

import { CURATE_SYSTEM, curatePrompt } from "../../shared/agentPrompt.js";

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

/** One curation round, exactly as the model returned it (checked against the bank by the caller). */
export type RawCuration = {
  entries: { entryId: string; bullets: { bulletId: string; text: string }[] }[];
  skills: string[];
  note: string;
  questions: { question: string; kind: "skill" | "detail"; skill: string; entryId: string }[];
};

/** Claude picks, orders and rewords material from the experience bank for one job. */
export async function claudeCurate(apiKey: string, input: Parameters<typeof curatePrompt>[0]): Promise<RawCuration> {
  const [{ Anthropic, client: c }, { z }, { betaZodOutputFormat }] = await Promise.all([
    client(apiKey),
    import("zod"),
    import("@anthropic-ai/sdk/helpers/beta/zod"),
  ]);

  const Curation = z.object({
    entries: z.array(z.object({ entryId: z.string(), bullets: z.array(z.object({ bulletId: z.string(), text: z.string() })) })),
    skills: z.array(z.string()),
    note: z.string(),
    questions: z.array(z.object({ question: z.string(), kind: z.enum(["skill", "detail"]), skill: z.string(), entryId: z.string() })),
  });

  try {
    const message = await c.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Server-side fallback: if Claude declines, Anthropic re-runs the request on its recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(Curation) },
      system: CURATE_SYSTEM,
      messages: [{ role: "user", content: curatePrompt(input) }],
    });
    if (message.stop_reason === "refusal") throw new Error("Claude declined to curate this resume. Try again.");
    if (!message.parsed_output) throw new Error("Claude's resume came back in an unexpected format. Try again.");
    return message.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AnthropicKeyError("Anthropic didn't accept your API key. Enter it again.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new AnthropicKeyError("Your Anthropic key doesn't have access to this model.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Anthropic is rate-limiting your key (or it's out of credits). Try again in a minute, or check console.anthropic.com/settings/billing.");
    if (e instanceof Anthropic.APIError) throw new Error(`Claude couldn't finish (error ${e.status}). Try again.`);
    throw e;
  }
}
