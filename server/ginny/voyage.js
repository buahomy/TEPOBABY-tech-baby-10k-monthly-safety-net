// Stage 1 (retrieval): Voyage AI embeddings.
// input_type="document" for resume chunks (what gets stored / searched over),
// input_type="query" for the job description and its requirements (what we search with).
// Only sanitized resume text is ever sent here (see resume.js).

const API = "https://api.voyageai.com/v1/embeddings";
export const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-4";

export const voyageEnabled = () => !!process.env.VOYAGE_API_KEY;

export async function embed(texts, inputType) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
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
