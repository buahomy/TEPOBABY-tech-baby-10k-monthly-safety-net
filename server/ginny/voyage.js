// Stage 1 (retrieval): Voyage AI embeddings.
// input_type="document" for resume chunks (what gets stored / searched over),
// input_type="query" for the job description and its requirements (what we search with).
// Only sanitized resume text is ever sent here (see resume.js).

const API = "https://api.voyageai.com/v1/embeddings";
export const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-4";

export const voyageEnabled = () => !!process.env.VOYAGE_API_KEY;

// Embeddings already fetched, by input type + text. The same job description and résumé lines are
// embedded again on every rescore (each time Ginny re-runs a job), so this saves most calls.
// In memory: per server process locally, per warm function instance on Vercel.
const cache = new Map();
const CACHE_MAX = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(texts, inputType) {
  // 429 (rate limit): a Voyage account without a payment method gets only 3 requests a minute, so
  // wait for the window to pass and try again rather than score without semantic similarity.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
      body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429 && attempt < 3) {
      await sleep(Math.min(Number(res.headers.get("retry-after")) * 1000 || 21000, 30000));
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Voyage ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

export async function embed(texts, inputType) {
  const key = (t) => `${VOYAGE_MODEL}|${inputType}|${t}`;
  const missing = [...new Set(texts.filter((t) => !cache.has(key(t))))];
  if (missing.length) {
    const out = await call(missing, inputType);
    missing.forEach((t, i) => cache.set(key(t), out[i]));
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }
  return texts.map((t) => cache.get(key(t)));
}

export function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
