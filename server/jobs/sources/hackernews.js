// Hacker News "Ask HN: Who is hiring?" via the official Firebase API.
// Keeps top-level comments that mention intern / new grad / junior roles.
// HN posts follow "Company | Role | Location | ..." on the first line by convention.

import { MAX_AGE_MS, classify, cleanText, fetchJson, isTech, mapLimit } from "../classify.js";

const API = "https://hacker-news.firebaseio.com/v0";
const EARLY = /\b(intern(ship)?s?|new grad\w*|junior|entry[- ]level|early[- ]career|university grad\w*|recent grad\w*)\b/i;

export async function fetchHackerNews() {
  const now = Date.now();
  try {
    const user = await fetchJson(`${API}/user/whoishiring.json`);
    // whoishiring posts three threads a month; the "Who is hiring?" one is among the latest few.
    const stories = await Promise.all(user.submitted.slice(0, 6).map((id) => fetchJson(`${API}/item/${id}.json`)));
    const thread = stories.find((s) => s && /who is hiring/i.test(s.title || ""));
    if (!thread) return [{ name: "Hacker News: Who is hiring?", postings: [], error: "No current thread found" }];

    const comments = await mapLimit(thread.kids || [], 8, (id) => fetchJson(`${API}/item/${id}.json`).catch(() => null));
    const postings = [];
    for (const c of comments) {
      if (!c || c.deleted || c.dead || !c.text) continue;
      const posted = c.time * 1000;
      if (now - posted > MAX_AGE_MS) continue;

      const text = cleanText(c.text.replace(/<p>/gi, "\n"));
      if (!EARLY.test(text)) continue;
      const firstLine = cleanText(c.text.split(/<p>/i)[0]);
      const parts = firstLine.split("|").map((p) => p.trim()).filter(Boolean);
      const company = parts[0]?.slice(0, 60) || "Hacker News";
      const roleGuess = parts.slice(1).find((p) => isTech(p) || EARLY.test(p)) || "";
      const role = EARLY.test(roleGuess) ? roleGuess : `${roleGuess ? `${roleGuess} · ` : ""}${text.match(EARLY)[0]} roles`;
      const level = classify(role) || "entry";
      const location = parts.find((p) => /remote|onsite|on-site|hybrid|, [A-Z]{2}\b|NYC|SF|London|USA|US\b/i.test(p)) || "See post";

      postings.push({
        id: `hn:${c.id}`,
        source: "Hacker News",
        company,
        title: role.slice(0, 120),
        location: location.slice(0, 80),
        url: `https://news.ycombinator.com/item?id=${c.id}`,
        postedAt: new Date(posted).toISOString(),
        postedApprox: false,
        level,
        sponsorship: /visa sponsor/i.test(text) ? (/no visa|not sponsor|cannot sponsor|unable to sponsor/i.test(text) ? "no" : "yes") : null,
      });
    }
    return [{ name: "Hacker News: Who is hiring?", postings }];
  } catch (err) {
    return [{ name: "Hacker News: Who is hiring?", postings: [], error: err.message }];
  }
}
