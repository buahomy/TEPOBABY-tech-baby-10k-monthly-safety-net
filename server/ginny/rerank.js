// Stage 2 (reranking): a local cross-encoder, the same model family FlashRank uses
// (ms-marco MiniLM), run on our server's CPU with ONNX Runtime — no external API calls.
// FlashRank itself is a Python library; this is the Node equivalent.
//
// Runs on Vercel too: the function ships only ONNX Runtime's Linux x64 binary (~42 MB of its ~200 MB,
// see vercel.json), and the ~23 MB model downloads from Hugging Face into /tmp on a cold start.
// With RERANK=off, or if the model can't load, ATS scores evidence from the Voyage embeddings instead
// (see ats.js).

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const rerankEnabled = process.env.RERANK !== "off";
export const RERANK_MODEL = rerankEnabled ? "Xenova/ms-marco-MiniLM-L-6-v2" : null;

let loading = null;
function load() {
  loading ??= import("@huggingface/transformers")
    .then(({ AutoModelForSequenceClassification, AutoTokenizer, env }) => {
      // /tmp is the only writable folder on Vercel
      env.cacheDir = process.env.RERANK_MODEL_DIR || (process.env.VERCEL ? "/tmp/models" : path.join(here, "..", "data", "models"));
      return Promise.all([
        AutoTokenizer.from_pretrained(RERANK_MODEL),
        AutoModelForSequenceClassification.from_pretrained(RERANK_MODEL, { dtype: "q8" }),
      ]);
    })
    .catch((err) => {
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
  if (!rerankEnabled) return;
  load().catch((err) => console.warn("[ginny] reranker not available:", err.message));
}
