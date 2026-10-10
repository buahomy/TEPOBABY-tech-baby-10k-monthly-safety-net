// Lightweight TextRank-style keyword extraction to compare a resume with a job description.
// Good enough for a starter; replace with embeddings later if needed.

const STOP = new Set(
  "a an and are as at be by for from has have in is it its of on or that the to was were will with you your we our they their this these those i me my he she them us not but if so than then into over under about can may must should would could also etc job role team work experience years year ability strong skills".split(
    " ",
  ),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Ranks words with PageRank over a co-occurrence graph (window of 4). */
export function textRank(text: string, topN = 20): string[] {
  const words = tokenize(text);
  const graph = new Map<string, Set<string>>();
  const WINDOW = 4;

  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < Math.min(i + WINDOW, words.length); j++) {
      const a = words[i];
      const b = words[j];
      if (a === b) continue;
      if (!graph.has(a)) graph.set(a, new Set());
      if (!graph.has(b)) graph.set(b, new Set());
      graph.get(a)!.add(b);
      graph.get(b)!.add(a);
    }
  }

  let score = new Map<string, number>();
  graph.forEach((_, w) => score.set(w, 1));
  const D = 0.85;
  for (let iter = 0; iter < 30; iter++) {
    const next = new Map<string, number>();
    graph.forEach((neighbors, w) => {
      let sum = 0;
      neighbors.forEach((n) => (sum += score.get(n)! / graph.get(n)!.size));
      next.set(w, 1 - D + D * sum);
    });
    score = next;
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w);
}

export type MatchResult = { score: number; matched: string[]; missing: string[] };

export function matchResume(resume: string, jobDescription: string): MatchResult {
  const jobKeywords = textRank(jobDescription, 25);
  const resumeWords = new Set(tokenize(resume));
  const matched = jobKeywords.filter((k) => resumeWords.has(k));
  const missing = jobKeywords.filter((k) => !resumeWords.has(k));
  const score = jobKeywords.length ? Math.round((matched.length / jobKeywords.length) * 100) : 0;
  return { score, matched, missing };
}
