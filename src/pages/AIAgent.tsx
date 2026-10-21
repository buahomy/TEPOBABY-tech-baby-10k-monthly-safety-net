import { useEffect, useState, useSyncExternalStore } from "react";
import { generateResume, resumeText } from "../utils/aiAgent";
import { TARGET, atsRecordFor, setResult, useResult } from "../utils/agentResults";
import { Bank, BankEntry, bulletCount, loadBank, mergeParsed, mergeSkills, parseResume, saveBank, uid } from "../utils/experienceBank";
import { copyText } from "../utils/linkedin";
import { deleteResumeFile, saveResumeFile, storedIds, uploadLocalFiles, viewResumeFile } from "../utils/resumeFiles";
import { ResumeHeader, buildResumePdf, downloadPdf, loadHeader, saveHeader } from "../utils/resumePdf";
import { AtsRecord, SavedJob } from "../utils/savedJobs";
import "./aiAgent.css";

// AI Agent (Profile). Two parts:
//   - Applicant's resources: everything about the student (education, experiences, projects with links,
//     skills, PDF header), edited in place, or imported from a résumé PDF.
//   - ✨ Generate, next to each saved job in My jobs: Claude Code crafts a one-page résumé for that job
//     from the resources, then it's scored, with suggestions for what to add to reach 85+.
// Logic in src/utils/aiAgent.ts; results in src/utils/agentResults.ts.

// ---- Shared state: the resources, access, and which job is generating ----

type Access = { allowed: boolean; demo: boolean; engine?: "claude-code" | "relay" | null };
type Shared = { bank: Bank | null; signedIn: boolean | null; access: Access | null; busy: { id: string; msg: string } | null; error: string };
let shared: Shared = { bank: null, signedIn: null, access: null, busy: null, error: "" };
const listeners = new Set<() => void>();
const setShared = (patch: Partial<Shared>) => {
  shared = { ...shared, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function useShared(signedIn: boolean): Shared {
  const s = useSyncExternalStore(subscribe, () => shared);
  useEffect(() => {
    if (shared.signedIn === signedIn) return;
    setShared({ signedIn, bank: null });
    loadBank(signedIn).then((bank) => shared.signedIn === signedIn && setShared({ bank }));
    if (!shared.access)
      fetch("/api/agent/access")
        .then((r) => r.json())
        .then((access) => setShared({ access }))
        .catch(() => setShared({ access: { allowed: true, demo: true } }));
  }, [signedIn]);
  return s;
}

function updateBank(next: Bank) {
  setShared({ bank: next });
  saveBank(!!shared.signedIn, next).catch((e: Error) => setShared({ error: e.message }));
}

// ---- Applicant's resources ----

export default function ApplicantResources({ signedIn }: { signedIn: boolean }) {
  const { bank, access, busy, error } = useShared(signedIn);
  const [reading, setReading] = useState("");

  return (
    <section className="block ag" id="applicant-resources" aria-labelledby="h-agent">
      <div className="block-head">
        <h2 id="h-agent" className="ag-title">
          <AgentMark />
          Applicant&apos;s resources
        </h2>
        <span className="ag-pro" title={access?.demo ? "AI Agent: Pro feature, free during the demo" : "AI Agent: Pro feature"}>
          PRO{access?.demo ? " · free demo" : ""}
        </span>
      </div>
      {access && !access.allowed ? (
        <p className="ag-paywall">Subscribe to Tepobaby Pro to use the AI Agent. Coming soon.</p>
      ) : !bank ? (
        <p className="empty">Loading your resources…</p>
      ) : (
        <>
          <p className="ag-small">Everything about you. Tap ✨ Generate on a saved job above for a résumé built from it.</p>
          <ImportFiles bank={bank} busy={!!reading || !!busy} onBusy={setReading} />
          {reading && (
            <p className="ag-busy">
              <span className="ag-spinner" aria-hidden="true" /> {reading}
            </p>
          )}
          {error && <p className="ob-error">{error}</p>}
          <Library bank={bank} onChange={updateBank} />
        </>
      )}
    </section>
  );
}

/** Optional: read a résumé PDF into the resources (duplicates merged, personal details removed). */
function ImportFiles({ bank, busy, onBusy }: { bank: Bank; busy: boolean; onBusy: (m: string) => void }) {
  const [onDevice, setOnDevice] = useState<string[]>([]);
  useEffect(() => {
    // Signed in: PDFs only on this device (from before they were saved to the account) go up first.
    uploadLocalFiles(bank.sources.map((x) => x.id)).finally(() => storedIds().then(setOnDevice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank.sources.length]);
  const experiences = bank.entries.filter((e) => e.kind !== "project").length;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    let next = bank;
    for (const [i, f] of [...files].entries()) {
      onBusy(`Reading ${i + 1}/${files.length}: ${f.name}`);
      try {
        next = mergeParsed(next, await parseResume(f));
        await saveResumeFile(next.sources[next.sources.length - 1].id, f);
      } catch (e) {
        setShared({ error: (e as Error).message });
      }
    }
    onBusy("");
    updateBank(next);
  };

  return (
    <div className="ag-import">
      <div className="ag-import-row">
        <label className="ag-secondary ag-file">
          📄 Import from a résumé PDF
          <input type="file" accept="application/pdf" multiple disabled={busy} onChange={(e) => upload(e.target.files)} />
        </label>
        {bank.entries.length > 0 && (
          <small>
            {experiences} exp · {bank.entries.length - experiences} projects · {bulletCount(bank)} bullets · {bank.skills.length} skills
          </small>
        )}
      </div>
      {bank.sources.length > 0 && (
        <ul className="ag-files" aria-label="Imported résumés">
          {[...bank.sources].reverse().map((src) => (
            <li key={src.id}>
              <span className="ag-file-name" title={src.fileName}>
                📄 {src.fileName}
              </span>
              <small>{new Date(src.addedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
              {onDevice.includes(src.id) && (
                <button type="button" className="ag-linkbtn" onClick={() => viewResumeFile(src.id)}>
                  View
                </button>
              )}
              <button
                type="button"
                className="ag-file-x"
                aria-label={`Remove ${src.fileName} from the list`}
                title="Remove from the list (what it added stays in your resources)"
                onClick={() => {
                  deleteResumeFile(src.id);
                  updateBank({ ...bank, sources: bank.sources.filter((x) => x.id !== src.id) });
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- The library, section by section ----

/**
 * Applicant's resources, section by section, editable in place: the library the AI Agent picks from
 * for each job.
 */
function Library({ bank, onChange }: { bank: Bank; onChange: (b: Bank) => void }) {
  const setEntry = (id: string, patch: Partial<BankEntry>) => onChange({ ...bank, entries: bank.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const addEntry = (kind: BankEntry["kind"]) =>
    onChange({ ...bank, entries: [...bank.entries, { id: uid("e"), kind, title: "", org: "", dates: "", link: "", bullets: [] }] });
  const experience = bank.entries.filter((e) => e.kind !== "project");
  const projects = bank.entries.filter((e) => e.kind === "project");

  return (
    <div className="ag-library">
      <details className="ag-section" open={!loadHeader().name}>
        <summary>Name & links</summary>
        <HeaderForm />
      </details>

      <section className="ag-section">
        <h4>Education</h4>
        {bank.education.map((line, i) => (
          <input
            key={`${i}-${line}`}
            className="ag-edit-line"
            defaultValue={line}
            aria-label="Education"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v === line) return;
              onChange({ ...bank, education: v ? bank.education.map((x, k) => (k === i ? v : x)) : bank.education.filter((_, k) => k !== i) });
            }}
          />
        ))}
        <AddLine placeholder="Add education: School, degree, graduation" onAdd={(v) => onChange({ ...bank, education: [...bank.education, v] })} />
      </section>

      <section className="ag-section">
        <h4>Experience</h4>
        {experience.map((e) => (
          <EntryCard key={e.id} entry={e} onChange={(patch) => setEntry(e.id, patch)} onRemove={() => onChange({ ...bank, entries: bank.entries.filter((x) => x.id !== e.id) })} />
        ))}
        <button type="button" className="ag-secondary ag-add" onClick={() => addEntry("experience")}>
          + Add experience
        </button>
      </section>

      <section className="ag-section">
        <h4>Projects</h4>
        {projects.map((e) => (
          <EntryCard key={e.id} entry={e} onChange={(patch) => setEntry(e.id, patch)} onRemove={() => onChange({ ...bank, entries: bank.entries.filter((x) => x.id !== e.id) })} />
        ))}
        <button type="button" className="ag-secondary ag-add" onClick={() => addEntry("project")}>
          + Add project
        </button>
      </section>

      <section className="ag-section">
        <h4>Skills</h4>
        <div className="ag-skillchips">
          {bank.skills.map((s) => (
            <span key={s}>
              {s}
              <button type="button" aria-label={`Remove ${s}`} onClick={() => onChange({ ...bank, skills: bank.skills.filter((x) => x !== s) })}>
                ✕
              </button>
            </span>
          ))}
        </div>
        <SkillForm onAdd={(skills) => onChange({ ...bank, skills: mergeSkills(bank.skills, skills) })} />
      </section>
    </div>
  );
}

/** One experience or project: its heading fields and bullets, all editable. */
function EntryCard({ entry: e, onChange, onRemove }: { entry: BankEntry; onChange: (patch: Partial<BankEntry>) => void; onRemove: () => void }) {
  const field = (k: "title" | "org" | "dates" | "link", placeholder: string, extra: Record<string, string> = {}) => (
    <input
      key={k}
      defaultValue={(e[k] as string) || ""}
      placeholder={placeholder}
      aria-label={placeholder}
      {...extra}
      onBlur={(ev) => {
        let v = ev.target.value.trim();
        if (k === "link" && v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
        if (v !== ((e[k] as string) || "")) onChange({ [k]: v });
      }}
    />
  );
  return (
    <div className="ag-card-edit">
      <div className="ag-card-fields">
        {field("title", e.kind === "project" ? "Project name" : "Role")}
        {e.kind === "project" ? field("link", "Link (github.com/you/project)", { inputMode: "url" }) : field("org", "Company / organization")}
        {field("dates", "Dates")}
      </div>
      {e.bullets.map((b) => (
        <textarea
          key={b.id}
          rows={2}
          defaultValue={b.text}
          aria-label="Bullet"
          onBlur={(ev) => {
            const text = ev.target.value.trim();
            if (text === b.text) return;
            onChange({ bullets: text ? e.bullets.map((y) => (y.id === b.id ? { ...y, text } : y)) : e.bullets.filter((y) => y.id !== b.id) });
          }}
        />
      ))}
      <div className="ag-card-foot">
        <AddLine placeholder="Add a bullet point" onAdd={(text) => onChange({ bullets: [...e.bullets, { id: uid("b"), text, source: "typed" }] })} />
        <button type="button" className="ag-ghost ag-remove" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function AddLine({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="ag-skillform"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAdd(v.trim());
        setV("");
      }}
    >
      <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} aria-label={placeholder} />
      <button type="submit" className="ag-secondary" disabled={!v.trim()}>
        Add
      </button>
    </form>
  );
}

function SkillForm({ onAdd }: { onAdd: (s: string[]) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="ag-skillform"
      onSubmit={(e) => {
        e.preventDefault();
        const add = text.split(",").map((s) => s.trim()).filter(Boolean);
        if (add.length) onAdd(add);
        setText("");
      }}
    >
      <input value={text} placeholder="Python, SQL, Excel…" onChange={(e) => setText(e.target.value)} aria-label="Skills" />
      <button type="submit" className="ag-primary" disabled={!text.trim()}>
        Add
      </button>
    </form>
  );
}

/** Name, contact details and links for the PDF header (saved to the account; only used in the PDF). */
function HeaderForm() {
  const [h, setH] = useState<ResumeHeader>(loadHeader);
  const set = (k: keyof ResumeHeader, v: string) => {
    const next = { ...h, [k]: v };
    setH(next);
    saveHeader(next);
  };
  return (
    <div className="ag-card-fields">
      <input value={h.name} placeholder="Full name" onChange={(e) => set("name", e.target.value)} />
      <input value={h.email} placeholder="Email" inputMode="email" onChange={(e) => set("email", e.target.value)} />
      <input value={h.phone} placeholder="Phone" inputMode="tel" onChange={(e) => set("phone", e.target.value)} />
      <input value={h.location} placeholder="City, State" onChange={(e) => set("location", e.target.value)} />
      <input value={h.links} placeholder="Links: linkedin.com/in/you, github.com/you" onChange={(e) => set("links", e.target.value)} />
    </div>
  );
}

// ---- ✨ Generate, next to a saved job ----

/**
 * A saved job's actions (Mark applied · ✨ Generate) and, after Generate, its report: the score,
 * what to add to Applicant's resources to reach 85+, and the PDF.
 */
export function JobAgent({ job, signedIn, onApplied }: { job: SavedJob; signedIn: boolean; onApplied: (ats?: AtsRecord) => void }) {
  const { bank, access, busy } = useShared(signedIn);
  const result = useResult(job.id);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const mine = busy?.id === job.id;
  const ok = !!result?.curated && result.score >= TARGET;

  const generate = async () => {
    if (!bank || shared.busy) return;
    setOpen(true);
    setShared({ busy: { id: job.id, msg: "Starting" }, error: "" });
    try {
      setResult(job.id, await generateResume(signedIn, job, bank, (msg) => setShared({ busy: { id: job.id, msg } }), result));
    } catch (e) {
      setResult(job.id, { ...(result ?? { score: 0, baseline: 0, history: [], curated: null, missingSkills: [], gaps: [], suggestions: [] }), error: (e as Error).message, at: new Date().toISOString() });
    }
    setShared({ busy: null });
  };

  const pdf = async () => {
    const header = loadHeader();
    const { bytes } = await buildResumePdf(header, result!.curated!, bank?.education ?? []);
    downloadPdf(bytes, `${(header.name || "Resume").replace(/[^\w]+/g, "_")}_${job.company.replace(/[^\w]+/g, "_")}.pdf`);
  };

  return (
    <>
      <div className="saved-actions">
        <button
          type="button"
          className="status-btn"
          onClick={() => onApplied(atsRecordFor(job.id))}
        >
          Mark applied
        </button>
        {access?.allowed !== false && (
          <button
            type="button"
            className="status-btn gen-btn"
            disabled={!!busy || !bank}
            title={bank && !bank.entries.length ? "Add your experience to Applicant's resources first" : "Claude Code builds a résumé for this job from your resources"}
            onClick={generate}
          >
            {mine ? "Generating…" : result?.curated ? "✨ Generate again" : "✨ Generate"}
          </button>
        )}
        {result && !mine && (
          <button type="button" className={`gen-score${ok ? " is-ok" : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
            {result.curated ? `ATS ${result.score}` : "Error"} {open ? "▴" : "▾"}
          </button>
        )}
      </div>

      {mine && (
        <p className="ag-busy gen-panel">
          <span className="ag-spinner" aria-hidden="true" /> {busy!.msg}
        </p>
      )}

      {open && result && !mine && (
        <div className="gen-panel ag-box">
          {result.error && <p className="ob-error">{result.error}</p>}
          {result.curated && (
            <>
              <p className="ag-small">
                <strong className={ok ? "gen-ok" : "gen-low"}>{result.score}</strong> / target {TARGET} · all your resources scored {result.baseline}
                {result.history.length > 1 ? ` · rounds ${result.history.join(" → ")}` : ""} · {new Date(result.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
              {ok ? (
                <p className="gen-ready">✅ Ready to apply</p>
              ) : (
                result.suggestions.length > 0 && (
                  <div className="gen-suggest">
                    <p>
                      <strong>To reach {TARGET}+</strong>, add to{" "}
                      <button type="button" className="ag-linkbtn" onClick={() => document.getElementById("applicant-resources")?.scrollIntoView({ behavior: "smooth" })}>
                        Applicant&apos;s resources
                      </button>{" "}
                      (only what&apos;s true), then Generate again:
                    </p>
                    <ul>
                      {result.suggestions.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )
              )}
              <div className="ag-row-actions">
                <button type="button" className="ag-primary" onClick={pdf}>
                  ⬇ PDF
                </button>
                <button type="button" className="ag-secondary" onClick={() => setPreview(!preview)}>
                  {preview ? "Hide" : "Preview"}
                </button>
                <button type="button" className="ag-ghost" onClick={() => copyText(resumeText(result.curated!, bank?.education ?? []))}>
                  Copy text
                </button>
                <a className="ag-ghost" href={job.url} target="_blank" rel="noreferrer">
                  Apply ↗
                </a>
              </div>
              {preview && (
                <div className="ag-preview">
                  {result.curated.entries.map((e) => (
                    <div key={e.entryId} className="ag-cv-entry">
                      <strong>{[e.title, e.org].filter(Boolean).join(", ")}</strong>
                      <ul className="ag-changes">
                        {e.bullets.map((b) => (
                          <li key={b.bulletId}>
                            <ins>{b.text}</ins>
                            {b.text !== b.original && <small>Yours: {b.original}</small>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {result.curated.skills.length > 0 && <p className="ag-small">Skills: {result.curated.skills.join(", ")}</p>}
                  {!!result.curated.dropped && <p className="ag-small">{result.curated.dropped} less relevant bullets left out to fit one page.</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

/** The AI Agent's mark: a glowing cyan ring with a bright core, inside a faint dashed orbit. */
function AgentMark() {
  return (
    <svg className="ag-mark" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <filter id="ag-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="32" cy="32" r="29" fill="none" stroke="#22d3ee" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2.5 3" />
      <circle cx="32" cy="32" r="21" fill="#071a2b" stroke="#38d6f5" strokeWidth="3.2" filter="url(#ag-glow)" />
      <circle cx="32" cy="32" r="7.5" fill="#22d3ee" filter="url(#ag-glow)" />
    </svg>
  );
}
