import { useEffect, useState } from "react";
import { timeAgo } from "../utils/postings";
import "./underTheHood.css";

// "How it's built": what Tepobaby does behind the screen, with live numbers from today's job feed.
// Opened from the welcome screen and the recruiter demo bar.

type Stats = {
  postings: number;
  companies: number;
  sponsorshipRead: number;
  noSponsorship: number;
  research: number;
  countries: { US: number; UK: number; CA: number };
  bySource: { name: string; count: number }[];
};

const REPO = "https://github.com/buahomy/TEPOBABY-tech-baby-10k-monthly-safety-net";

const PIPELINES = [
  {
    title: "Live job feed",
    steps: ["7 source types every morning, incl. 450+ YC startup boards", "Vercel Cron, 7 AM ET", "Classify level, country, research", "Read each description for visa terms", "Upstash Redis → your phone"],
    detail: "SimplifyJobs GitHub lists, the Greenhouse / Lever / Ashby boards of 80 tech companies and 450+ hiring Y Combinator startups, Microsoft, Amazon and Workday career APIs, university sites, and Google Jobs via SerpApi. Duplicates merged; reposting sites dropped.",
  },
  {
    title: "ATS match score",
    steps: ["Résumé PDF", "Name, email, phone removed", "BM25 keyword match · 40%", "Voyage AI embeddings · 35%", "MiniLM reranker evidence · 25%"],
    detail: "The reranker runs on Tepobaby's own server. Embeddings are cached and retried, so all three signals hold up under a 3-requests-a-minute API limit.",
  },
  {
    title: "AI coaching",
    steps: ["Gemini: interview research with Google Search sources", "Staggered requests across 4 models", "OpenAI Realtime voice interviewer over WebRTC", "Live STAR scoring through tool calls"],
    detail: "Gemini answers come from whichever model responds first, so free-tier slowdowns don't stall the app. The voice interviewer marks Situation, Task, Action and Result as you speak.",
  },
  {
    title: "Claude Code from a phone (author only)",
    steps: ["Phone → Ginny → Claude Code", "Server checks the signed-in email", "Cloudflare tunnel to a relay on the author's Mac", "Claude Code tailors a résumé to the saved job", "PDF opens back on the phone"],
    detail: "The saved job's description is attached automatically. Job postings are treated as untrusted data: commands that change anything wait for an Approve tap, and secrets and the home folder are blocked.",
  },
];

const STACK = ["React", "TypeScript", "Vite", "Node.js", "Express", "Vercel", "Upstash Redis", "Google OAuth", "Voyage AI", "Transformers.js", "Gemini", "OpenAI Realtime", "SerpApi", "Claude Code", "Playwright"];

export default function UnderTheHood({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
    fetch("/api/postings?level=internship&window=week&limit=1")
      .then((r) => r.json())
      .then((d) => setUpdatedAt(d.updatedAt))
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmt = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString());
  const top = Math.max(1, ...(stats?.bySource.map((s) => s.count) ?? [1]));

  return (
    <div className="hood-backdrop" onClick={onClose}>
      <div className="hood" role="dialog" aria-label="How Tepobaby is built" onClick={(e) => e.stopPropagation()}>
        <header className="hood-head">
          <h2>How Tepobaby is built</h2>
          <button type="button" className="hood-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="hood-body">
          <p className="hood-lede">
            Designed and built solo by <strong>Yuttanawee “Pure” Buahom</strong> (Whitman College, B.A. Computer Science, Dec 2026) to give
            students without industry connections the same head start: live roles, visa filters, and AI interview prep in one app.
          </p>

          <section aria-label="Live numbers">
            <h3>Right now{updatedAt ? ` · feed updated ${timeAgo(updatedAt)}` : ""}</h3>
            <div className="hood-tiles">
              <div className="hood-tile">
                <span className="hood-num">{fmt(stats?.postings)}</span>
                <span className="hood-label">open roles in the feed</span>
              </div>
              <div className="hood-tile">
                <span className="hood-num">{fmt(stats?.companies)}</span>
                <span className="hood-label">companies</span>
              </div>
              <div className="hood-tile">
                <span className="hood-num">{fmt(stats?.sponsorshipRead)}</span>
                <span className="hood-label">roles whose visa terms were read</span>
              </div>
              <div className="hood-tile">
                <span className="hood-num">{fmt(stats?.research)}</span>
                <span className="hood-label">university &amp; research roles</span>
              </div>
            </div>
            {stats && (
              <ul className="hood-sources" aria-label="Roles by source">
                {stats.bySource.map((s) => (
                  <li key={s.name}>
                    <span className="hood-src-name">{s.name}</span>
                    <span className="hood-src-bar" aria-hidden="true">
                      <i style={{ width: `${(100 * s.count) / top}%` }} />
                    </span>
                    <span className="hood-src-count">{s.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
            {stats && (
              <p className="hood-note">
                {fmt(stats.noSponsorship)} roles say they don't sponsor or need U.S. citizenship, so international students can hide them. US{" "}
                {fmt(stats.countries.US)} · UK {fmt(stats.countries.UK)} · Canada {fmt(stats.countries.CA)}.
              </p>
            )}
          </section>

          {PIPELINES.map((p) => (
            <section key={p.title} aria-label={p.title}>
              <h3>{p.title}</h3>
              <ol className="hood-flow">
                {p.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="hood-note">{p.detail}</p>
            </section>
          ))}

          <section aria-label="Stack">
            <h3>Stack</h3>
            <div className="hood-chips">
              {STACK.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          </section>

          <section aria-label="Demo limits">
            <h3>About this demo</h3>
            <p className="hood-note">
              Visitors get capped free use of the paid features: a short voice interview and a few Gemini answers a day. Students sign in with
              a .edu email.
            </p>
          </section>

          <div className="hood-links">
            <a href={REPO} target="_blank" rel="noreferrer">
              Code &amp; design decisions on GitHub ↗
            </a>
            <a href="https://www.linkedin.com/in/yuttanawee-pure-buahom-910a09270" target="_blank" rel="noreferrer">
              Pure on LinkedIn ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
