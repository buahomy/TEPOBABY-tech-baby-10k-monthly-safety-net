// Stage 2 (reranking): a local cross-encoder, the same model family FlashRank uses
// (ms-marco MiniLM), run on our server's CPU with ONNX Runtime — no external API calls.
// FlashRank itself is a Python library; this is the Node equivalent.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { AutoModelForSequenceClassification, AutoTokenizer, env } from "@huggingface/transformers";

const here = path.dirname(fileURLToPath(import.meta.url));
env.cacheDir = process.env.RERANK_MODEL_DIR || path.join(here, "..", "data", "models");
export const RERANK_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2";

let loading = null;
function load() {
  loading ??= Promise.all([
    AutoTokenizer.from_pretrained(RERANK_MODEL),
    AutoModelForSequenceClassification.from_pretrained(RERANK_MODEL, { dtype: "q8" }),
  ]).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/** Scores each (query, doc) pair; higher = more relevant. Returns { scores, ms }. */
export async function rerank(query, docs) {
  if (!docs.length) return { scores: [], ms: 0 };
  const [tokenizer, model] = await load();
  const started = performance.now();
  const inputs = tokenizer(new Array(docs.length).fill(query), { text_pair: docs, padding: true, truncation: true, max_length: 256 });
  const { logits } = await model(inputs);
  return { scores: Array.from(logits.data), ms: performance.now() - started };
}

export const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/** Load the model in the background so the first analysis isn't slow. */
export function warmReranker() {
  load().catch((err) => console.warn("[ginny] reranker not available:", err.message));
}
