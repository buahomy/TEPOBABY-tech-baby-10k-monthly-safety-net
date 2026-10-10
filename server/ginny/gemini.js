// "Ask Gemini" interview FAQ chat. Uses Google Search grounding so answers about a specific
// company (interview rounds, Glassdoor reports, visa sponsorship) come with real sources instead
// of guesses. Only role/company and non-identifying profile facts are sent — never the resume,
// name or email.
//
// Gemini 1.5 Flash was retired by Google in 2025; the default is Gemini 2.5 Flash (free tier).

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;
export const GEMINI_MODEL = MODEL;

function systemPrompt(ctx) {
  return [
    "You are Ginny, Tepobaby's interview prep assistant for U.S. college students applying to tech internships and new grad roles.",
    "Answer in simple words, short and practical. Use bullet points when listing.",
    "Use Google Search for anything specific to the company, like interview rounds, reported questions, or visa sponsorship, and be honest when sources disagree or are old.",
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

async function call(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Gemini ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** messages: [{ role: "user" | "model", text }] → { text, sources: [{ title, url }] } */
export async function askGemini(messages, ctx) {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(ctx) }] },
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
  };
  let data;
  try {
    data = await call({ ...body, tools: [{ google_search: {} }] });
  } catch (err) {
    // Grounding can be unavailable (quota / region); answer without it rather than fail.
    if (err.status === 400 || err.status === 403 || err.status === 429) data = await call(body);
    else throw err;
  }
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || "").join("").trim();
  const sources = (cand?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web)
    .filter(Boolean)
    .map((w) => ({ title: w.title || w.uri, url: w.uri }))
    .filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i)
    .slice(0, 6);
  if (!text) throw new Error("Gemini returned an empty answer. Try rephrasing.");
  return { text, sources };
}
