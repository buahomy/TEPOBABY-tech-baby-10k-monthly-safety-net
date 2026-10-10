// Stage 1.1 (hard skills): BM25 over resume chunks. For each technical skill the job asks for,
// score how strongly the resume mentions that exact string (with known aliases like k8s → Kubernetes).
// A skill counts as present only if it appears verbatim somewhere in the resume.

import { skillAliases } from "./skills.js";

const K1 = 1.2;
const B = 0.75;

/** Returns [{ skill, score, chunk }] for each skill, best-matching chunk first. */
export function bm25Skills(skills, chunks) {
  const N = chunks.length || 1;
  const lengths = chunks.map((c) => c.split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / N || 1;

  return skills.map((skill) => {
    const res = skillAliases(skill);
    // term frequency per chunk = total alias matches
    const tf = chunks.map((c) => res.reduce((n, r) => n + (c.match(new RegExp(r.source, r.flags.includes("g") ? r.flags : `${r.flags}g`)) || []).length, 0));
    const df = tf.filter((f) => f > 0).length;
    if (!df) return { skill, score: 0, chunk: null };
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    let best = { score: 0, i: -1 };
    tf.forEach((f, i) => {
      if (!f) return;
      const s = (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * lengths[i]) / avg));
      if (s > best.score) best = { score: s, i };
    });
    return { skill, score: best.score, chunk: chunks[best.i] };
  });
}
