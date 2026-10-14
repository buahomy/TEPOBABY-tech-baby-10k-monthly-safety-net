// Gemini for Ginny, through Google's Interactions API (POST /v1beta/interactions).
//
// Model: Gemini 3.8 Flash by default. Gemini 1.5 Flash was retired in 2025, and Gemini 2.5 Flash is
// no longer offered to new API keys; Google now serves newer models through the Interactions API.
//
// Google Search grounding is tried first so company-specific answers (interview rounds, Glassdoor
// reports, sponsorship) come with sources. On the free tier, search can be over quota; then we
// answer without it and say the answer has no live sources.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Tried in order when the main model is overloaded (503) — free-tier demand spikes are common.
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.7-flash,gemini-3.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL);
const API = "https://generativelanguage.googleapis.com/v1beta/interactions";

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;
export const GEMINI_MODEL = MODEL;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function interactOnce(model, body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ model, store: false, ...body }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Gemini ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Retries overloaded models (503/500) with short backoff, then tries the fallback models. */
async function interact(body) {
  let last;
  for (const model of [MODEL, ...FALLBACKS]) {
    for (let attempt = 0; attempt < (model === MODEL ? 3 : 1); attempt++) {
      try {
        return await interactOnce(model, body);
      } catch (err) {
        last = err;
        // Overloaded or too slow: try again / move to the next model.
        const slow = err.name === "TimeoutError" || err.name === "AbortError";
        if (err.status !== 503 && err.status !== 500 && !slow) throw err;
        if (slow) break;
        if (attempt < 2 && model === MODEL) await sleep(1500 * (attempt + 1));
      }
    }
  }
  last.busy = true;
  throw last;
}

/** Text + url citations from an interaction's model_output steps. */
function readOutput(data) {
  const blocks = (data.steps || []).filter((s) => s.type === "model_output").flatMap((s) => s.content || []).filter((c) => c.type === "text");
  const text = blocks.map((b) => b.text).join("").trim();
  const sources = blocks
    .flatMap((b) => b.annotations || [])
    .filter((a) => a.type === "url_citation" && a.url)
    .map((a) => ({ title: a.title || a.url, url: a.url }))
    .filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i)
    .slice(0, 6);
  return { text, sources };
}

const turn = (role, text) => ({ type: role === "model" ? "model_output" : "user_input", content: [{ type: "text", text }] });

/**
 * One Gemini call. `messages`: [{ role: "user" | "model", text }].
 * Returns { text, sources, grounded } — grounded=false when Google Search wasn't available.
 */
export async function generate({ system, messages, search = false, json = false, temperature = 0.4, maxTokens = 1500 }) {
  const body = {
    system_instruction: system,
    input: messages.map((m) => turn(m.role, m.text)),
    generation_config: { temperature, max_output_tokens: maxTokens, ...(json ? { response_mime_type: "application/json" } : {}) },
  };
  let data;
  let grounded = false;
  if (search) {
    try {
      data = await interact({ ...body, tools: [{ type: "google_search" }] });
      grounded = true;
    } catch (err) {
      // Free tier: search is often over quota. Answer without it rather than fail.
      if (![400, 403, 429].includes(err.status)) throw err;
    }
  }
  if (!data) {
    try {
      data = await interact(body);
    } catch (err) {
      // Some models reject response_mime_type here; retry as plain text.
      if (json && err.status === 400) data = await interact({ ...body, generation_config: { temperature, max_output_tokens: maxTokens } });
      else throw err;
    }
  }
  const out = readOutput(data);
  if (!out.text) throw new Error("Gemini returned an empty answer. Try rephrasing.");
  return { ...out, grounded: grounded && out.sources.length > 0 };
}

function chatSystem(ctx) {
  return [
    "You are Ginny, Tepobaby's interview prep assistant for U.S. college students applying to tech internships and new grad roles.",
    "Answer in simple words, short and practical. Use bullet points when listing.",
    "For anything specific to the company (interview rounds, reported questions, visa sponsorship), rely on what candidates have publicly reported, and be honest when information is uncertain, old or varies by team.",
    "When asked for practice problems, name specific NeetCode 150 problems by title.",
    "Never invent policies. If sponsorship is unclear, say so and suggest checking the posting or asking the recruiter.",
    "",
    `Selected job: ${ctx.role || "unknown role"} at ${ctx.company || "unknown company"}${ctx.location ? ` (${ctx.location})` : ""}.`,
    ctx.level ? `Student: ${ctx.level}${ctx.graduation ? `, graduating ${ctx.graduation}` : ""}.` : "",
    ctx.visa ? `Work authorization: ${ctx.visa}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Ask Gemini chat: messages → { text, sources, grounded } */
export function askGemini(messages, ctx) {
  return generate({ system: chatSystem(ctx), messages, search: true });
}

/**
 * Tailored resume suggestions for one job (opt-in from the ATS report). Gets only the sanitized,
 * sectioned resume text (no name or contact info) plus the job's requirements.
 */
export async function tailorResume({ jobTitle, company, requirements, missingSkills, gaps, resumeText }) {
  const system = [
    "You are a senior tech recruiter helping a U.S. college student tailor their resume to one internship or new grad job.",
    "Hard rules:",
    "- Never invent experience, employers, tools, numbers or results. Rewrite only using facts already in the original bullet.",
    "- Where a number would help but isn't known, use a placeholder like [X%], [N users] or [Y ms] for the student to fill in honestly.",
    "- Use the job's exact keywords only when the original bullet genuinely supports them.",
    "- Each improved bullet: under 30 words, starts with a strong action verb, shows action → what → result.",
    "- Simple, direct language. Reply with JSON only.",
  ].join("\n");
  const prompt = [
    `Job: ${jobTitle} at ${company}`,
    `Requirements:\n${requirements.map((r) => `- ${r}`).join("\n")}`,
    missingSkills.length ? `Skills the job wants that the resume doesn't show: ${missingSkills.join(", ")}` : "",
    gaps.length ? `Requirements with little evidence:\n${gaps.map((g) => `- ${g}`).join("\n")}` : "",
    `Resume (personal info removed):\n${resumeText}`,
    "",
    "Return JSON with exactly these keys:",
    '{"summary": "2 sentences of overall advice",',
    ' "rewrites": [{"original": "exact bullet from the resume", "improved": "rewritten bullet", "requirement": "which job requirement it now targets", "why": "one short reason"}],',
    ' "addKeywords": [{"keyword": "exact term from the job", "where": "which bullet or section to add it to, only if the student has really used it"}],',
    ' "projectIdea": {"title": "...", "description": "one or two sentences: a 1–2 weekend project that would honestly close the biggest gap", "skills": ["..."]}}',
    "Give 3 to 5 rewrites, picking the bullets that matter most for this job.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text } = await generate({ system, messages: [{ role: "user", text: prompt }], json: true, temperature: 0.3, maxTokens: 2500 });
  const raw = text.replace(/^```(json)?\s*|\s*```$/g, "").trim();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    data = m ? JSON.parse(m[0]) : null;
  }
  if (!data || !Array.isArray(data.rewrites)) throw new Error("Gemini's suggestions came back in an unexpected format. Try again.");
  const s = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  return {
    summary: s(data.summary, 600),
    rewrites: data.rewrites.slice(0, 5).map((r) => ({ original: s(r.original, 400), improved: s(r.improved, 400), requirement: s(r.requirement, 300), why: s(r.why, 300) })),
    addKeywords: (Array.isArray(data.addKeywords) ? data.addKeywords : []).slice(0, 8).map((k) => ({ keyword: s(k.keyword, 80), where: s(k.where, 200) })),
    projectIdea: data.projectIdea && { title: s(data.projectIdea.title, 120), description: s(data.projectIdea.description, 500), skills: (data.projectIdea.skills || []).slice(0, 6).map((x) => s(x, 40)) },
  };
}
