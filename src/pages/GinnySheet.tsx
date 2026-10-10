import { useEffect, useRef, useState } from "react";
import CompanyLogo from "../components/CompanyLogo";
import Icon from "../components/Icon";
import { User } from "../utils/auth";
import {
  AtsResult,
  ChatMessage,
  GinnyStatus,
  ResumeMeta,
  askGemini,
  deleteResume,
  getResume,
  TailorTips,
  getStatus,
  getTailorTips,
  runAts,
  suggestedQuestions,
  uploadResume,
} from "../utils/ginny";
import { timeAgo } from "../utils/postings";
import { Profile } from "../utils/profile";
import { SavedJob, SavedJobsApi } from "../utils/savedJobs";
import "./ginny.css";

// Opened from the center "+" button. Two tabs side by side:
//   Job    — pick ONE job from your saved (♥) jobs.
//   Ginny! — AI tools for that job: ATS match analysis, and Ask Gemini.

type Props = {
  user: User | null;
  profile: Profile;
  saved: SavedJobsApi;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBrowse: () => void;
  onClose: () => void;
};

type Tab = "job" | "ginny";
type Tool = null | "ats" | "chat";

export default function GinnySheet({ user, profile, saved, selectedId, onSelect, onBrowse, onClose }: Props) {
  const job = saved.jobs.find((j) => j.id === selectedId) || null;
  const [tab, setTab] = useState<Tab>(job ? "ginny" : "job");
  const [tool, setTool] = useState<Tool>(null);
  const [status, setStatus] = useState<GinnyStatus | null>(null);

  useEffect(() => {
    getStatus().then(setStatus).catch(() => {});
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="gs-backdrop" onClick={onClose}>
      <div className="gs" role="dialog" aria-label="Job and Ginny" onClick={(e) => e.stopPropagation()}>
        <header className="gs-head">
          {tool ? (
            <button type="button" className="gs-icon-btn" onClick={() => setTool(null)} aria-label="Back to Ginny">
              <Icon name="back" />
            </button>
          ) : (
            <span className="gs-icon-btn gs-spacer" aria-hidden="true" />
          )}
          <div className="gs-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "job"}
              className={tab === "job" ? "is-active" : ""}
              onClick={() => {
                setTab("job");
                setTool(null);
              }}
            >
              Job
            </button>
            <button type="button" role="tab" aria-selected={tab === "ginny"} className={tab === "ginny" ? "is-active" : ""} onClick={() => setTab("ginny")}>
              ✨ Ginny!
            </button>
          </div>
          <button type="button" className="gs-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="gs-body">
          {tab === "job" && (
            <JobPicker
              jobs={saved.jobs}
              selectedId={selectedId}
              onPick={(id) => {
                onSelect(id);
                setTab("ginny");
              }}
              onBrowse={onBrowse}
            />
          )}
          {tab === "ginny" && !job && (
            <div className="gs-empty">
              <p>Pick a job first. Ginny uses it for everything.</p>
              <button type="button" className="primary-action tab-cta" onClick={() => setTab("job")}>
                <span>Choose a saved job</span>
                <Icon name="arrow" />
              </button>
            </div>
          )}
          {tab === "ginny" && job && tool === null && <GinnyHome job={job} status={status} onTool={setTool} onChangeJob={() => setTab("job")} />}
          {tab === "ginny" && job && tool === "ats" && <AtsPanel user={user} job={job} status={status} />}
          {tab === "ginny" && job && tool === "chat" && <ChatPanel job={job} profile={profile} status={status} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Job tab

function JobPicker({ jobs, selectedId, onPick, onBrowse }: { jobs: SavedJob[]; selectedId: string | null; onPick: (id: string) => void; onBrowse: () => void }) {
  if (!jobs.length) {
    return (
      <div className="gs-empty">
        <p>You haven't saved any jobs yet. Tap the ♥ on a job posting, then come back to pick one.</p>
        <button type="button" className="primary-action tab-cta" onClick={onBrowse}>
          <span>Browse job postings</span>
          <Icon name="arrow" />
        </button>
      </div>
    );
  }
  return (
    <>
      <p className="gs-hint">Choose one job from your saved list. Ginny will use it.</p>
      <ul className="gs-jobs" role="radiogroup" aria-label="Saved jobs">
        {jobs.map((j) => {
          const on = j.id === selectedId;
          return (
            <li key={j.id}>
              <button type="button" role="radio" aria-checked={on} className={`gs-job${on ? " is-selected" : ""}`} onClick={() => onPick(j.id)}>
                <CompanyLogo company={j.company} domain={j.domain} />
                <span className="posting-copy">
                  <span className="posting-company">{j.company}</span>
                  <span className="posting-title">{j.title}</span>
                  <span className="posting-meta">
                    {j.location} · {j.status === "applied" ? "applied" : "saved"} {timeAgo(j.appliedAt || j.savedAt)}
                  </span>
                </span>
                <span className="gs-radio" aria-hidden="true">
                  {on && <Icon name="check" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- Ginny home

function SelectedJob({ job, onChange }: { job: SavedJob; onChange?: () => void }) {
  return (
    <div className="gs-selected">
      <CompanyLogo company={job.company} domain={job.domain} />
      <span className="posting-copy">
        <span className="posting-company">{job.company}</span>
        <span className="posting-title">{job.title}</span>
      </span>
      {onChange && (
        <button type="button" className="text-link gs-change" onClick={onChange}>
          Change
        </button>
      )}
    </div>
  );
}

function GinnyHome({ job, status, onTool, onChangeJob }: { job: SavedJob; status: GinnyStatus | null; onTool: (t: Tool) => void; onChangeJob: () => void }) {
  return (
    <>
      <h2 className="gs-title">Hi, I'm Ginny ✨</h2>
      <p className="gs-hint">Your AI sidekick for this job:</p>
      <SelectedJob job={job} onChange={onChangeJob} />
      <button type="button" className="gs-tool" onClick={() => onTool("ats")}>
        <span className="gs-tool-icon">
          <img src="/logos/voyage.png" alt="Voyage AI" />
        </span>
        <span className="gs-tool-copy">
          <span className="gs-tool-title">ATS match analysis</span>
          <span className="gs-tool-detail">See how your resume matches this job: Strong, Good, Average or Weak, with what's missing.</span>
        </span>
        <Icon name="arrow" />
      </button>
      <button type="button" className="gs-tool" onClick={() => onTool("chat")}>
        <span className="gs-tool-icon">
          <img src="/logos/gemini.png" alt="Google Gemini" />
        </span>
        <span className="gs-tool-copy">
          <span className="gs-tool-title">Ask Gemini</span>
          <span className="gs-tool-detail">
            Interview rounds, real questions, visa sponsorship: a realistic sense of what to expect, so you can chancemaxx.
          </span>
        </span>
        <Icon name="arrow" />
      </button>
      {status && !status.gemini && <p className="gs-note">Ask Gemini needs a Gemini API key on the server.</p>}
    </>
  );
}

// ---------------------------------------------------------------- ATS analysis

const STEPS = ["Removing personal info", "Semantic retrieval (Voyage AI)", "Hard-skill matching (BM25)", "Reranking evidence (local)"];

function AtsPanel({ user, job, status }: { user: User | null; job: SavedJob; status: GinnyStatus | null }) {
  const signedIn = !!user;
  const [resume, setResume] = useState<ResumeMeta | null | undefined>(undefined);
  const [busy, setBusy] = useState<"upload" | "analyze" | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [needDescription, setNeedDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<AtsResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getResume(signedIn)
      .then(setResume)
      .catch(() => setResume(null));
  }, [signedIn]);

  // Progress hint while the server works.
  useEffect(() => {
    if (busy !== "analyze") return;
    setStep(0);
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    return () => window.clearInterval(t);
  }, [busy]);

  const analyze = async (withDescription?: string) => {
    setBusy("analyze");
    setError("");
    try {
      setResult(await runAts(signedIn, job, withDescription));
      setNeedDescription(false);
    } catch (e) {
      const err = e as Error & { needDescription?: boolean; needResume?: boolean };
      if (err.needDescription) setNeedDescription(true);
      if (err.needResume) setResume(null);
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const meta = await uploadResume(signedIn, file);
      setResume(meta);
      setBusy(null);
      analyze(); // uploaded → go straight to analysis
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <>
      <h2 className="gs-title gs-title--brand">
        <img src="/logos/voyage.png" alt="" /> ATS match analysis
      </h2>
      <SelectedJob job={job} />

      <div className="gs-resume">
        {resume === undefined ? (
          <span className="gs-hint">Checking for your resume…</span>
        ) : resume ? (
          <>
            <span className="gs-resume-file">
              📄 {resume.fileName}
              <span className="gs-hint"> · uploaded {timeAgo(resume.uploadedAt)}</span>
            </span>
            <span className="gs-resume-actions">
              <button type="button" className="text-link" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                Replace
              </button>
              <button
                type="button"
                className="text-link"
                disabled={!!busy}
                onClick={() => deleteResume(signedIn).then(() => (setResume(null), setResult(null)))}
              >
                Delete
              </button>
            </span>
          </>
        ) : (
          <button type="button" className="primary-action tab-cta" onClick={() => fileInput.current?.click()} disabled={!!busy}>
            <span>{busy === "upload" ? "Uploading…" : "Upload your resume (PDF)"}</span>
          </button>
        )}
        <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />
      </div>
      <p className="gs-privacy">
        🔒 Your name, email, phone, address and links are removed before anything is analyzed. Only Experience, Projects,
        Skills and Education are used.{" "}
        {signedIn ? "Your PDF is stored privately on your account, so you only upload it once." : "As a guest, your PDF stays on this device."}
      </p>

      {resume && !result && !busy && !needDescription && (
        <button type="button" className="primary-action tab-cta" onClick={() => analyze()}>
          <span>Analyze my match</span>
          <Icon name="arrow" />
        </button>
      )}

      {busy === "analyze" && (
        <ol className="gs-steps" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "is-done" : i === step ? "is-active" : ""}>
              {i < step ? "✓" : i === step ? "…" : "·"} {s}
            </li>
          ))}
        </ol>
      )}

      {needDescription && !busy && (
        <div className="gs-paste">
          <label htmlFor="jd">Paste the job description</label>
          <textarea id="jd" rows={7} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Copy the full description from the job page…" />
          <button type="button" className="primary-action tab-cta" disabled={description.trim().length < 200} onClick={() => analyze(description)}>
            <span>{description.trim().length < 200 ? "Paste at least a few paragraphs" : "Analyze my match"}</span>
          </button>
        </div>
      )}

      {error && !busy && <p className="ob-error">{error}</p>}

      {result && !busy && <AtsReport result={result} status={status} job={job} signedIn={signedIn} onRerun={() => analyze()} />}
    </>
  );
}

function Bar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="gs-bar">
      <span className="gs-bar-label">{label}</span>
      <span className="gs-bar-track">
        <span className="gs-bar-fill" style={{ width: `${value ?? 0}%` }} />
      </span>
      <span className="gs-bar-value">{value === null ? "—" : value}</span>
    </div>
  );
}

function AtsReport({
  result,
  status,
  job,
  signedIn,
  onRerun,
}: {
  result: AtsResult;
  status: GinnyStatus | null;
  job: SavedJob;
  signedIn: boolean;
  onRerun: () => void;
}) {
  const r = result;
  const [tips, setTips] = useState<TailorTips | null>(null);
  const [tipsBusy, setTipsBusy] = useState(false);
  const [tipsError, setTipsError] = useState("");

  const loadTips = async () => {
    setTipsBusy(true);
    setTipsError("");
    try {
      setTips(await getTailorTips(signedIn, job, r));
    } catch (e) {
      setTipsError((e as Error).message);
    } finally {
      setTipsBusy(false);
    }
  };

  return (
    <div className="gs-report">
      <div className={`gs-tier gs-tier--${r.tier.id}`}>
        <span className="gs-tier-label">🎯 {r.tier.label}</span>
        <span className="gs-tier-score">{r.score}/100</span>
      </div>
      <p className="gs-hint">{r.tier.about}</p>
      {r.projectedScore !== null && r.projectedScore > r.score && (
        <p className="gs-projected">
          📈 Up to about <strong>{r.projectedScore}/100</strong> if you add the required skills you've really used.
        </p>
      )}

      <div className="gs-bars">
        <Bar label="Hard skills" value={r.components.skills} />
        <Bar label="Semantic fit" value={r.components.semantic} />
        <Bar label="Evidence" value={r.components.evidence} />
      </div>

      {r.improvements.length > 0 && (
        <>
          <p className="gs-sub">What to improve, most important first</p>
          <ol className="gs-improve">
            {r.improvements.map((i) => (
              <li key={i.title}>
                <div className="gs-improve-head">
                  <span className={`gs-prio gs-prio--${i.priority}`}>{i.priority}</span>
                  <span className="gs-improve-cat">{i.category}</span>
                  {!!i.impact && <span className="gs-impact">+{i.impact} pts</span>}
                </div>
                <p className="gs-req">{i.title}</p>
                <p className="gs-proof">{i.detail}</p>
                {i.examples && i.examples.length > 0 && (
                  <ul className="gs-examples">
                    {i.examples.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="gs-tailor">
        <p className="gs-sub">Tailor your bullets with Gemini</p>
        {!tips && (
          <>
            <p className="gs-privacy">
              Gemini rewrites your own bullets for this job and suggests a project for your biggest gap. This sends your
              resume's Experience, Projects, Skills and Education to Google's Gemini API, with your name and contact info
              already removed.
            </p>
            <button
              type="button"
              className="primary-action tab-cta"
              onClick={loadTips}
              disabled={tipsBusy || !status?.gemini}
            >
              <span>{tipsBusy ? "Gemini is writing…" : !status?.gemini ? "Needs a Gemini key on the server" : "✨ Get tailored rewrites"}</span>
            </button>
          </>
        )}
        {tipsError && <p className="ob-error">{tipsError}</p>}
        {tips && (
          <div className="gs-tips">
            {tips.summary && <p className="gs-hint">{tips.summary}</p>}
            {tips.rewrites.map((w) => (
              <div key={w.original} className="gs-rewrite">
                <p className="gs-before">Before: {w.original}</p>
                <p className="gs-after">After: {w.improved}</p>
                {(w.requirement || w.why) && (
                  <p className="gs-proof">
                    {w.requirement && <>Targets: {w.requirement}. </>}
                    {w.why}
                  </p>
                )}
              </div>
            ))}
            {tips.addKeywords.length > 0 && (
              <p className="gs-proof">
                <strong>Keywords to add (only if true):</strong> {tips.addKeywords.map((k) => `${k.keyword} (${k.where})`).join("; ")}
              </p>
            )}
            {tips.projectIdea && (
              <div className="gs-rewrite">
                <p className="gs-after">💡 Project idea: {tips.projectIdea.title}</p>
                <p className="gs-proof">{tips.projectIdea.description}</p>
                {tips.projectIdea.skills.length > 0 && <p className="gs-proof">Skills: {tips.projectIdea.skills.join(", ")}</p>}
              </div>
            )}
            <p className="gs-note">AI can embellish. Keep only what's true for you, and fill [placeholders] with real numbers.</p>
          </div>
        )}
      </div>

      {r.matchedSkills.length > 0 && (
        <>
          <p className="gs-sub">Skills you have</p>
          <div className="gs-chips">
            {r.matchedSkills.map((s) => (
              <span key={s} className="gs-chip gs-chip--ok">
                ✓ {s}
              </span>
            ))}
          </div>
        </>
      )}
      {r.missingSkills.length > 0 && (
        <>
          <p className="gs-sub">Missing from your resume</p>
          <div className="gs-chips">
            {r.missingSkills.map((s) => (
              <span key={s.skill} className={`gs-chip ${s.required ? "gs-chip--req" : ""}`}>
                {s.skill}
                {s.required ? " · required" : ""}
              </span>
            ))}
          </div>
        </>
      )}
      {r.strengths.length > 0 && (
        <>
          <p className="gs-sub">Where your resume proves it</p>
          <ul className="gs-evidence">
            {r.strengths.map((e) => (
              <li key={e.requirement}>
                <span className="gs-req">{e.requirement}</span>
                <span className="gs-proof">← “{e.bullet}”</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.gaps.length > 0 && (
        <>
          <p className="gs-sub">Requirements with little evidence</p>
          <ul className="gs-evidence">
            {r.gaps.map((g) => (
              <li key={g}>
                <span className="gs-req">{g}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="gs-how">
        <summary>How this was scored</summary>
        <ul>
          <li>Stage 1 · Retrieval: {r.pipeline.retrieval ?? r.pipeline.retrievalNote}</li>
          <li>Stage 1.1 · Hard skills: {r.pipeline.hardSkills}</li>
          <li>
            {r.pipeline.reranker
              ? `Stage 2 · Reranking: ${r.pipeline.reranker}, ${r.pipeline.rerankPairs} pairs in ${r.pipeline.rerankMs} ms`
              : "Stage 2 · Evidence: closest resume line per requirement (Voyage embeddings)"}
          </li>
          <li>Tiers: {status?.tiers.map((t) => `${t.label} ${t.min}+`).join(" · ")}</li>
        </ul>
      </details>
      <button type="button" className="more-btn" onClick={onRerun}>
        Run again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Ask Gemini

function ChatPanel({ job, profile, status }: { job: SavedJob; profile: Profile; status: GinnyStatus | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const suggestions = suggestedQuestions(job, profile);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, text: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const a = await askGemini(next, job, profile);
      setMessages([...next, { role: "model", text: a.text, sources: a.sources, grounded: a.grounded }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gs-chat">
      <h2 className="gs-title gs-title--brand">
        <img src="/logos/gemini.png" alt="" /> Ask Gemini
      </h2>
      <SelectedJob job={job} />
      {status && !status.gemini && <p className="gs-note">Ask Gemini isn't set up yet: the server needs a GEMINI_API_KEY.</p>}

      <div className="gs-messages">
        {messages.length === 0 && (
          <>
            <p className="gs-hint">Try one of these. They're filled in from your job and profile:</p>
            <div className="gs-suggest">
              {suggestions.map((s) => (
                <button key={s} type="button" className="gs-suggestion" onClick={() => send(s)} disabled={busy || !status?.gemini}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`gs-msg gs-msg--${m.role}`}>
            <div className="gs-msg-text">{m.role === "model" ? <Markdownish text={m.text} /> : m.text}</div>
            {m.role === "model" && m.grounded === false && (
              <p className="gs-nosrc">No live web sources for this answer. Double-check details on the company's careers page.</p>
            )}
            {m.sources && m.sources.length > 0 && (
              <div className="gs-sources">
                Sources:{" "}
                {m.sources.map((s, k) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    [{k + 1}] {s.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="gs-msg gs-msg--model gs-typing">Gemini is thinking…</div>}
        {error && <p className="ob-error">{error}</p>}
        <div ref={end} />
      </div>

      <form
        className="gs-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${job.company}…`}
          aria-label="Ask Gemini"
          disabled={!status?.gemini}
        />
        <button type="submit" className="gs-send" disabled={busy || !input.trim() || !status?.gemini} aria-label="Send">
          <Icon name="arrow" />
        </button>
      </form>
    </div>
  );
}

/** Minimal, safe Markdown for chat answers: **bold**, bullet lines and headings. No HTML is injected. */
function Markdownish({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
    );
  return (
    <>
      {text.split("\n").map((raw, i) => {
        const indent = raw.match(/^\s*/)?.[0].length ?? 0;
        const line = raw.trim();
        if (!line) return <div key={i} className="md-gap" />;
        const bullet = line.match(/^([*\-•]|\d+\.)\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="md-li" style={{ paddingLeft: 10 + Math.min(indent, 8) * 4 }}>
              <span className="md-dot">{/^\d/.test(bullet[1]) ? bullet[1] : "•"}</span>
              <span>{inline(bullet[2])}</span>
            </div>
          );
        }
        const heading = line.match(/^#{1,4}\s+(.*)$/);
        if (heading) return <p key={i} className="md-h">{inline(heading[1])}</p>;
        return <p key={i}>{inline(line)}</p>;
      })}
    </>
  );
}
