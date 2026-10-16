// ATS match analysis: resume vs. one job description, scored into the 4 match tiers that
// Eightfold-style candidate-matching systems show (Strong / Good / Average-Partial / Weak).
//
//   Stage 1   Retrieval  — Voyage AI embeddings: semantic similarity of resume chunks to the job.
//   Stage 1.1 Hard skills — BM25 exact-string matching of the job's technical skills in the resume.
//   Stage 2   Reranking  — local cross-encoder (ms-marco MiniLM, FlashRank's model family) scores the
//                          top 10–20 retrieved resume lines against each job requirement.
//
// The final score blends skills coverage, semantic fit and requirement evidence. The weights and
// tier cutoffs are our own calibration, not Eightfold's (which isn't public).

import { bm25Skills } from "./bm25.js";
import { improvements } from "./improve.js";
import { RERANK_MODEL, rerank, rerankEnabled, sigmoid } from "./rerank.js";

// ms-marco cross-encoder logits: clearly relevant lines score about −4…+2, unrelated ones about
// −10. Shift/scale so −3 reads as solid evidence (~0.9) and −10 as none (~0.05).
const evidenceFromLogit = (logit) => sigmoid((logit + 6) / 1.5);
import { findSkills } from "./skills.js";
import { VOYAGE_MODEL, cosine, embed, voyageEnabled } from "./voyage.js";

export const TIERS = [
  { id: "strong", label: "Strong Match", min: 75, about: "Near-perfect alignment with the required skills, core tools and experience for this job." },
  { id: "good", label: "Good Match", min: 55, about: "A solid, competitive profile. You meet the main standards but may be missing a couple of secondary keywords or proof for some tools." },
  { id: "average", label: "Average / Partial Match", min: 30, about: "Some relevant experience, but significant gaps, like missing core languages, platforms or equivalent job titles." },
  { id: "weak", label: "Weak Match", min: 0, about: "Very low alignment. The system struggles to find direct evidence that your background fits this position." },
];

const tierFor = (score) => TIERS.find((t) => score >= t.min);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Resume chunks: each meaningful line of the kept sections, tagged with its section. */
function resumeChunks(sections) {
  const out = [];
  for (const [section, lines] of Object.entries(sections)) {
    for (const line of lines) {
      const text = line.replace(/^[•\-–*]\s*/, "").trim();
      if (text.length >= 12) out.push({ section, text });
    }
  }
  return out;
}

const WANT =
  /(experience|proficien|familiar|knowledge|understanding|skills?|ability to|degree|pursuing|coursework|background in|working with|expertise|strong|fluency|hands-on|build|design|develop|write|ship)/i;
const REQ_HEADING =
  /(requirement|qualification|what you('ll| will)? (need|bring)|you (have|bring|might be|should have)|about you|who you are|skills|nice to have|preferred|bonus|minimum|basic|what we('re| are) looking for|what you('ll| will) do|you('ll| will) (do|work on)|^you will$|responsibilit|in this role|your impact)/i;
const STOP_HEADING =
  /(benefit|perk|compensation|salary|pay range|base pay|about (us|the (company|team))|what we offer|equal (opportunity|employment)|eeo|why (join|work)|our (mission|values|culture)|life at|accommodation|privacy|how to apply|application process)/i;

// Link bullets like "Jane Doe experience as a 2026 intern" or "Read Sam's story".
const TESTIMONIAL = /^([A-Z][a-z]+\s+[A-Z][a-z]+('s)?\s+(experience|story|journey)\b|read .+'s story)/;

const lineList = (jd) =>
  jd
    .split(/\n/)
    // a pasted description can arrive as one paragraph: read its sentences as lines
    .flatMap((l) => (l.length > 400 ? l.split(/(?<=[.!?])\s+(?=[A-Z])/) : [l]))
    .map((l) => l.replace(/^[•\-–*]\s*/, "").trim())
    .filter(Boolean);

/** Lines inside the job's qualifications / responsibilities sections (skips benefits, about-us, testimonials). */
function qualificationLines(jd) {
  const out = [];
  let inside = false;
  for (const l of lineList(jd)) {
    const isHeading = l.length <= 70 && !/[.!?]$/.test(l);
    if (isHeading && STOP_HEADING.test(l)) inside = false;
    else if (isHeading && REQ_HEADING.test(l)) inside = true;
    else if (inside && l.length >= 15 && !TESTIMONIAL.test(l)) out.push(l);
  }
  return out;
}

/** The job's requirement lines, best source first. */
function requirements(jd) {
  const fromSections = qualificationLines(jd).filter((l) => l.length <= 400);
  const bullets = jd
    .split(/\n/)
    .filter((l) => /^\s*[•\-–*]/.test(l))
    .map((l) => l.replace(/^\s*[•\-–*]\s*/, "").trim());
  const pool = fromSections.length >= 3 ? fromSections : bullets.length >= 3 ? bullets : lineList(jd);
  const picked = pool.filter((l) => l.length >= 20 && l.length <= 400 && !TESTIMONIAL.test(l) && (WANT.test(l) || findSkills(l).length));
  return [...new Set(picked)].slice(0, 12);
}

/** The part of the job description that says what the job needs (falls back to all of it). */
function requirementsText(jd) {
  const lines = qualificationLines(jd);
  return lines.length >= 3 ? lines.join("\n") : jd;
}

/** Skills listed under "required / minimum / basic qualifications" count double. */
function requiredSkills(jd) {
  const m = jd.match(/(required|minimum|basic)\s+(qualifications|skills|requirements)[\s\S]{0,2500}?(?=(preferred|nice to have|bonus|benefits|about us|what we offer|$))/i);
  return new Set(m ? findSkills(m[0]) : []);
}

export async function analyze({ sections, jobTitle, company, description }) {
  const started = Date.now();
  const chunks = resumeChunks(sections);
  const texts = chunks.map((c) => c.text);
  const resumeText = texts.join("\n");
  const reqs = requirements(description);
  const queryText = `${jobTitle} at ${company}\n${description}`.slice(0, 24000);

  // ---- Stage 1.1: hard skills (BM25) ----
  // Skills come from the qualifications / responsibilities sections, so product or company
  // descriptions ("we support Ruby, PHP…") don't count as requirements.
  const jdSkills = findSkills(`${jobTitle}\n${requirementsText(description)}`);
  const required = requiredSkills(description);
  const bm = bm25Skills(jdSkills, texts);
  const weight = (s) => (required.has(s) ? 2 : 1);
  const totalW = jdSkills.reduce((a, s) => a + weight(s), 0);
  const matchedW = bm.filter((b) => b.score > 0).reduce((a, b) => a + weight(b.skill), 0);
  const skillsScore = totalW ? matchedW / totalW : null;
  const matchedSkills = bm.filter((b) => b.score > 0).map((b) => b.skill);
  const missingSkills = bm
    .filter((b) => b.score === 0)
    .sort((a, b) => weight(b.skill) - weight(a.skill))
    .map((b) => ({ skill: b.skill, required: required.has(b.skill) }));

  // ---- Stage 1: semantic retrieval (Voyage) ----
  let semantic = null;
  let candidates = chunks.map((_, i) => i); // everything, if no embeddings
  let reqEmbeds = null;
  let chunkEmbeds = null;
  const usedVoyage = voyageEnabled();
  let voyageError = null;
  if (usedVoyage) {
    try {
      chunkEmbeds = await embed([resumeText, ...texts], "document");
      reqEmbeds = await embed([queryText, ...reqs], "query");
      const wholeSim = cosine(chunkEmbeds[0], reqEmbeds[0]);
      // Voyage cosine for a related resume/job pair usually lands ~0.35–0.75; map that to 0–1.
      semantic = clamp01((wholeSim - 0.35) / 0.4);
      // Top 15 resume lines most similar to the whole job → reranking candidates.
      candidates = texts
        .map((_, i) => ({ i, s: cosine(chunkEmbeds[i + 1], reqEmbeds[0]) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 15)
        .map((x) => x.i);
    } catch (err) {
      voyageError = err.message;
      semantic = null;
    }
  }

  // ---- Stage 2: rerank candidates against each requirement (local cross-encoder) ----
  let rerankMs = 0;
  let rerankError = null;
  const evidence = [];
  for (let r = 0; r < reqs.length; r++) {
    let pool = candidates;
    if (reqEmbeds && chunkEmbeds) {
      // per requirement: its own top 15 by embedding similarity
      pool = texts
        .map((_, i) => ({ i, s: cosine(chunkEmbeds[i + 1], reqEmbeds[r + 1]) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 15)
        .map((x) => x.i);
    } else {
      pool = pool.slice(0, 20);
    }
    let reranked = false;
    if (rerankEnabled && !rerankError) {
      try {
        const { scores, ms } = await rerank(reqs[r], pool.map((i) => texts[i]));
        rerankMs += ms;
        const best = scores.reduce((b, s, k) => (s > b.s ? { s, k } : b), { s: -Infinity, k: -1 });
        evidence.push({ requirement: reqs[r], bullet: best.k >= 0 ? texts[pool[best.k]] : null, score: evidenceFromLogit(best.s) });
        reranked = true;
      } catch (err) {
        // e.g. the model couldn't download: score the rest from embeddings rather than fail the analysis
        rerankError = err.message;
        console.warn("[ginny] reranker failed:", err.message);
      }
    }
    if (!reranked && reqEmbeds && chunkEmbeds) {
      // No reranker (RERANK=off, or it failed): the closest resume line by embedding similarity.
      const i = pool[0];
      const sim = cosine(chunkEmbeds[i + 1], reqEmbeds[r + 1]);
      evidence.push({ requirement: reqs[r], bullet: texts[i], score: clamp01((sim - 0.3) / 0.4) });
    }
  }
  const evidenceScore = evidence.length ? evidence.reduce((a, e) => a + e.score, 0) / evidence.length : null;

  // ---- Blend ----
  const parts = [
    { key: "skills", value: skillsScore, w: 0.4 },
    { key: "semantic", value: semantic, w: 0.35 },
    { key: "evidence", value: evidenceScore, w: 0.25 },
  ].filter((p) => p.value !== null);
  const wSum = parts.reduce((a, p) => a + p.w, 0) || 1;
  const score = Math.round((100 * parts.reduce((a, p) => a + p.value * p.w, 0)) / wSum);
  const tier = tierFor(score);
  const gaps = evidence.filter((e) => e.score < 0.3).sort((a, b) => a.score - b.score).slice(0, 4).map((e) => e.requirement);

  const improve = improvements({
    sections,
    jobTitle,
    description,
    matchedSkills,
    missingSkills,
    gaps,
    score,
    skillWeights: { total: totalW, per: weight },
    weights: { skills: skillsScore === null ? 0 : 0.4, sum: wSum },
  });

  return {
    tier: { id: tier.id, label: tier.label, about: tier.about },
    score,
    components: {
      skills: skillsScore === null ? null : Math.round(skillsScore * 100),
      semantic: semantic === null ? null : Math.round(semantic * 100),
      evidence: evidenceScore === null ? null : Math.round(evidenceScore * 100),
    },
    matchedSkills,
    missingSkills,
    strengths: evidence.filter((e) => e.score >= 0.7).sort((a, b) => b.score - a.score).slice(0, 4),
    gaps,
    improvements: improve.items,
    projectedScore: improve.projected,
    requirements: reqs,
    pipeline: {
      retrieval: usedVoyage && !voyageError ? `Voyage AI (${VOYAGE_MODEL})` : null,
      retrievalNote: voyageError ? "Voyage AI was unavailable, so semantic similarity was skipped." : usedVoyage ? null : "Add VOYAGE_API_KEY to turn on semantic similarity.",
      hardSkills: `BM25 over ${texts.length} resume lines`,
      reranker: RERANK_MODEL && !rerankError ? `${RERANK_MODEL} (local)` : null,
      rerankMs: Math.round(rerankMs),
      rerankPairs: RERANK_MODEL && !rerankError ? evidence.length * Math.min(15, candidates.length || texts.length) : 0,
      totalMs: Date.now() - started,
    },
  };
}
