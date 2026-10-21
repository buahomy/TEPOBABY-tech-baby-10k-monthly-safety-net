import { useCallback, useEffect, useRef, useState } from "react";
import CompanyLogo from "../components/CompanyLogo";
import {
  AgentState,
  Question,
  QueueRole,
  RoleState,
  addAnswers,
  checkRole,
  errorState,
  fetchQueue,
  loadAgent,
  nextPrompt,
  parseReply,
  resumeText,
  roleFromSaved,
  runGenerate,
  saveAgent,
  scoreReply,
  today,
} from "../utils/aiAgent";
import { Bank, BankEntry, bulletCount, emptyBank, loadBank, mergeParsed, mergeSkills, parseResume, saveBank, uid } from "../utils/experienceBank";
import { copyText } from "../utils/linkedin";
import { deleteResumeFile, saveResumeFile, storedIds, uploadLocalFiles, viewResumeFile } from "../utils/resumeFiles";
import { MONTHS, Profile, labelFor } from "../utils/profile";
import { ResumeHeader, buildResumePdf, downloadPdf, loadHeader, saveHeader } from "../utils/resumePdf";
import { SavedJobsApi } from "../utils/savedJobs";
import "./aiAgent.css";
import { canSaveLocally, pushKey } from "../utils/accountSync";

// AI Agent (Profile → My jobs). Experience bank (upload resumes or add manually) → roles that fit (checked
// daily, or a saved job picked by hand) → per role: "Generate" runs curate → one-page PDF → rescore back to
// back with Claude Code (or copy/paste where Claude Code isn't available) → ready to apply.
// Logic in src/utils/aiAgent.ts.

type Props = { signedIn: boolean; profile: Profile; saved: SavedJobsApi };
type Tab = "ready" | "info" | "working" | "todo" | "applied";

// Kinds of roles, from the title. The agent only checks the kinds the student picks.
const FIELDS = [
  { id: "software", label: "Software", re: /\b(software|swe|sde|developer|full[- ]?stack|front[- ]?end|back[- ]?end|mobile|ios|android|web|platform|infrastructure|devops|sre|cloud|site reliability|forward deployed)\b/i },
  { id: "data", label: "Data & AI", re: /\b(data|machine learning|ml|ai|artificial intelligence|analytics|scientist|research engineer|quant\w*)\b/i },
  { id: "hardware", label: "Hardware", re: /\b(hardware|asic|fpga|pcb|silicon|circuit|chip|verification|firmware|embedded|electrical|rf|systems? design engineer|mechanical|manufacturing)\b/i },
  { id: "security", label: "Security", re: /\b(security|cyber|threat|identity)\b/i },
  { id: "product", label: "Product", re: /\b(product manag\w*|product analyst|program manag\w*|technical program|tpm|apm)\b/i },
  { id: "business", label: "Finance & business", re: /\b(financ\w*|accounting|analyst|business|strategy|operations|consult\w*|banking|investment|treasury|audit)\b/i },
  { id: "sales", label: "Sales", re: /\b(sales|solutions?|account|customer success|partner|marketing)\b/i },
] as const;
type FieldId = (typeof FIELDS)[number]["id"];
const FIELD_KEY = "tepobaby.aiAgent.fields";
function loadFields(): FieldId[] {
  try {
    const v = JSON.parse(localStorage.getItem(FIELD_KEY) || "null");
    if (Array.isArray(v)) return v;
  } catch {
    // ignore
  }
  return ["software", "data"];
}
const inFields = (title: string, fields: FieldId[]) => !fields.length || FIELDS.some((f) => fields.includes(f.id) && f.re.test(title));

const CHECK_BATCH = 10;

/** When the student can start, from their answers (they can change it here). */
function defaultStart(profile: Profile): { month: number; year: number } {
  const g = profile.answers.graduation ?? { month: 5, year: new Date().getFullYear() };
  switch (profile.answers.startTerm) {
    case "fall_2026":
      return { month: 9, year: 2026 };
    case "spring_2027":
      return { month: 1, year: 2027 };
    case "summer_2027":
      return { month: 6, year: 2027 };
    default:
      return g.month === 12 ? { month: 1, year: g.year + 1 } : { month: g.month + 1, year: g.year };
  }
}

export default function AIAgent({ signedIn, profile, saved }: Props) {
  const [agent, setAgent] = useState<AgentState>(loadAgent);
  const agentRef = useRef(agent);
  const [bank, setBank] = useState<Bank | null>(null);
  const bankRef = useRef<Bank>(emptyBank());
  const grad = profile.answers.graduation ?? { month: 5, year: new Date().getFullYear() };
  const [start, setStart] = useState(() => defaultStart(profile));
  const needsSponsorship = profile.answers.needsSponsorship === "yes" || profile.answers.workAuthorized === "no";
  const [queue, setQueue] = useState<QueueRole[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("working");
  const [open, setOpen] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldId[]>(loadFields);
  const [access, setAccess] = useState<{ allowed: boolean; demo: boolean; engine?: "claude-code" | "relay" | null } | null>(null);
  const [pick, setPick] = useState("");
  const stopRef = useRef(false);

  const commit = useCallback((fn: (a: AgentState) => AgentState) => {
    const next = fn(agentRef.current);
    agentRef.current = next;
    saveAgent(next);
    setAgent(next);
  }, []);
  const put = useCallback((id: string, rs: RoleState) => commit((a) => ({ ...a, roles: { ...a.roles, [id]: rs } })), [commit]);

  const updateBank = useCallback(
    (next: Bank) => {
      bankRef.current = next;
      setBank(next);
      saveBank(signedIn, next).catch((e: Error) => setError(e.message));
    },
    [signedIn],
  );

  useEffect(() => {
    fetch("/api/agent/access")
      .then((r) => r.json())
      .then(setAccess)
      .catch(() => setAccess({ allowed: true, demo: true }));
    loadBank(signedIn).then((b) => {
      bankRef.current = b;
      setBank(b);
    });
  }, [signedIn]);

  useEffect(() => {
    setQueue(null);
    fetchQueue({ gradYear: grad.year, gradMonth: grad.month, startYear: start.year, startMonth: start.month, needsSponsorship })
      .then(setQueue)
      .catch((e: Error) => setError(e.message));
  }, [grad.year, grad.month, start.year, start.month, needsSponsorship]);

  const hasBank = !!bank && bank.entries.length > 0;
  const todo = (queue ?? []).filter((r) => !agent.roles[r.id] && inFields(r.title, fields));
  // Today's roles plus saved jobs picked by hand.
  const roles = [...(queue ?? []), ...Object.values(agent.picked ?? {}).filter((p) => !queue?.some((q) => q.id === p.id))];
  const pickable = saved.jobs.filter((j) => !agent.roles[j.id]);

  /** Checks the next roles against the whole experience bank. */
  const runCheck = useCallback(async () => {
    if (!queue || busy || !bankRef.current.entries.length) return;
    stopRef.current = false;
    setError("");
    const batch = queue.filter((r) => !agentRef.current.roles[r.id] && inFields(r.title, fields)).slice(0, CHECK_BATCH);
    for (let i = 0; i < batch.length && !stopRef.current; i++) {
      const role = batch[i];
      setBusy(`Checking ${i + 1}/${batch.length}: ${role.company}`);
      try {
        put(role.id, await checkRole(signedIn, role, bankRef.current, agentRef.current.target));
      } catch (e) {
        const err = e as Error & { needDescription?: boolean };
        if (/a lot of analyses/i.test(err.message)) {
          setError("Hourly check limit reached. Try again later.");
          break;
        }
        put(role.id, errorState(err.needDescription ? "Couldn't read this posting." : err.message));
      }
    }
    commit((a) => ({ ...a, lastAutoRun: today() }));
    setBusy("");
  }, [queue, busy, fields, signedIn, put, commit]);

  // Automatic daily check: once a day, when Profile opens with an experience bank.
  useEffect(() => {
    if (queue && hasBank && agent.auto !== false && agent.lastAutoRun !== today() && !busy && access?.allowed) runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, hasBank, access]);

  const list = (statuses: RoleState["status"][]) =>
    roles.filter((r) => agent.roles[r.id] && statuses.includes(agent.roles[r.id].status)).sort((a, b) => agent.roles[b.id].score - agent.roles[a.id].score);
  const ready = list(["ready"]);
  const info = list(["needs_info"]);
  const working = list(["working", "topped", "error"]);
  const applied = list(["applied"]);
  const setRole = (id: string, patch: Partial<RoleState>) => put(id, { ...agent.roles[id], ...patch });

  /** Generate: curate → rebuild PDF → rescore, back to back, for one role. */
  const generate = async (role: QueueRole) => {
    stopRef.current = false;
    setError("");
    try {
      const done = await runGenerate(
        signedIn,
        role,
        agentRef.current.roles[role.id],
        bankRef.current,
        agentRef.current.target,
        (st, msg) => {
          put(role.id, st);
          setBusy(msg);
        },
        () => stopRef.current,
      );
      put(role.id, done);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy("");
  };

  /** Adds a saved job to the agent and checks it right away. */
  const addSaved = async (id: string) => {
    const job = saved.jobs.find((j) => j.id === id);
    if (!job || busy) return;
    const role = roleFromSaved(job);
    commit((a) => ({ ...a, picked: { ...(a.picked ?? {}), [role.id]: role } }));
    setBusy(`Checking ${role.company}`);
    setError("");
    try {
      put(role.id, await checkRole(signedIn, role, bankRef.current, agentRef.current.target));
    } catch (e) {
      const err = e as Error & { needDescription?: boolean };
      put(role.id, errorState(err.needDescription ? "Couldn't read this posting." : err.message));
    }
    setBusy("");
    setPick("");
    setTab("working");
    setOpen(role.id);
  };

  return (
    <section className="block ag" aria-labelledby="h-agent">
      <div className="block-head">
        <h2 id="h-agent" className="ag-title">
          <AgentMark />
          AI Agent
        </h2>
        <span className="ag-pro" title={access?.demo ? "Pro feature, free during the demo" : "Pro feature"}>
          PRO{access?.demo ? " · free demo" : ""}
        </span>
      </div>

      {access && !access.allowed ? (
        <p className="ag-paywall">Subscribe to Tepobaby Pro to use the AI Agent. Coming soon.</p>
      ) : (
        <>
          <BankPanel bank={bank} busy={!!busy} onChange={updateBank} onError={setError} onBusy={setBusy} />

          <div className="ag-facts">
            <span>
              🎓 {MONTHS[grad.month - 1]} {grad.year}
            </span>
            <label>
              🗓
              <select
                value={`${start.year}-${start.month}`}
                aria-label="Start date"
                onChange={(e) => {
                  const [y, m] = e.target.value.split("-").map(Number);
                  setStart({ year: y, month: m });
                }}
                disabled={!!busy}
              >
                {Array.from({ length: 18 }, (_, i) => {
                  const idx = grad.year * 12 + grad.month - 1 + i - 2;
                  const y = Math.floor(idx / 12);
                  const m = (idx % 12) + 1;
                  return (
                    <option key={idx} value={`${y}-${m}`}>
                      Start {MONTHS[m - 1]} {y}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              🎯
              <select value={agent.target} aria-label="Target score" onChange={(e) => commit((a) => ({ ...a, target: Number(e.target.value) }))} disabled={!!busy}>
                {[70, 75, 80, 85, 90].map((t) => (
                  <option key={t} value={t}>
                    {t}+
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`ag-auto${agent.auto !== false ? " is-on" : ""}`}
              aria-pressed={agent.auto !== false}
              title="Check new roles automatically once a day"
              onClick={() => commit((a) => ({ ...a, auto: a.auto === false }))}
            >
              Auto daily {agent.auto !== false ? "on" : "off"}
            </button>
            {needsSponsorship && <span title="Hides roles that say they don't sponsor">🛂 {labelFor("workAuthStatus", profile.answers.workAuthStatus) || "Sponsorship"}</span>}
          </div>

          <div className="ag-fields" role="group" aria-label="Kinds of roles">
            {FIELDS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={fields.includes(f.id)}
                className={fields.includes(f.id) ? "is-on" : ""}
                disabled={!!busy}
                onClick={() => {
                  const next = fields.includes(f.id) ? fields.filter((x) => x !== f.id) : [...fields, f.id];
                  setFields(next);
                  try {
                    if (!canSaveLocally()) return;
                    localStorage.setItem(FIELD_KEY, JSON.stringify(next));
                    pushKey(FIELD_KEY);
                  } catch {
                    // ignore
                  }
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button type="button" className="ag-primary ag-run" disabled={!queue || !hasBank || !!busy || !todo.length} onClick={runCheck}>
            {!hasBank ? "Add your resume to start" : todo.length ? `Check ${Math.min(CHECK_BATCH, todo.length)} new roles` : "All roles checked"}
          </button>
          {pickable.length > 0 && (
            <div className="ag-pick">
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Pick a saved job" disabled={!!busy || !hasBank}>
                <option value="">Or pick a saved job…</option>
                {pickable.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.company}: {j.title}
                  </option>
                ))}
              </select>
              <button type="button" className="ag-secondary" disabled={!pick || !!busy || !hasBank} onClick={() => addSaved(pick)}>
                Add
              </button>
            </div>
          )}
          {busy && (
            <p className="ag-busy">
              <span className="ag-spinner" aria-hidden="true" /> {busy}
              <button type="button" onClick={() => (stopRef.current = true)}>
                Stop
              </button>
            </p>
          )}
          {error && <p className="ob-error">{error}</p>}

          <div className="segmented ag-tabs" role="tablist" aria-label="AI Agent">
            {(
              [
                ["working", `🔁 To curate · ${working.length}`],
                ["info", `✍️ Your info · ${info.length}`],
                ["ready", `✅ Ready · ${ready.length}`],
                ["todo", `🕓 To check · ${todo.length}`],
                ["applied", `📨 Applied · ${applied.length}`],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "todo" ? (
            <ul className="ag-list">
              {todo.slice(0, 40).map((r) => (
                <li key={r.id} className="ag-row">
                  <CompanyLogo company={r.company} domain={r.domain} />
                  <span className="ag-row-text">
                    <strong>{r.company}</strong>
                    <small>{r.title}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="ag-list">
              {(tab === "ready" ? ready : tab === "info" ? info : tab === "working" ? working : applied).map((r) => {
                const st = agent.roles[r.id];
                return (
                  <li key={r.id} className={`ag-card${open === r.id ? " is-open" : ""}`}>
                    <button type="button" className="ag-card-head" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      <CompanyLogo company={r.company} domain={r.domain} />
                      <span className="ag-row-text">
                        <strong>{r.company}</strong>
                        <small>{r.title}</small>
                      </span>
                      <span className={`ag-score ${st.score >= agent.target ? "is-ok" : ""}`}>{st.status === "error" ? "—" : st.score}</span>
                    </button>
                    {open === r.id && (
                      <RoleDetail
                        role={r}
                        st={st}
                        bank={bank ?? emptyBank()}
                        target={agent.target}
                        profile={profile}
                        grad={grad}
                        start={start}
                        busy={!!busy}
                        engine={access?.engine ?? null}
                        onGenerate={() => generate(r)}
                        onReply={async (text) => {
                          setError("");
                          setBusy(`Rebuilding the PDF and rescoring ${r.company}`);
                          try {
                            put(r.id, await scoreReply(signedIn, r, st, bankRef.current, agentRef.current.target, parseReply(text)));
                          } catch (e) {
                            setError((e as Error).message);
                          }
                          setBusy("");
                        }}
                        onAnswers={(questions, answers) => {
                          updateBank(addAnswers(bankRef.current, questions, answers));
                          setRole(r.id, { status: "working", stale: 0, questions: [] });
                        }}
                        onApplied={() => {
                          saved.markApplied(r, {
                            score: st.score,
                            firstScore: st.firstScore,
                            history: [st.firstScore, ...st.history],
                            target: agent.target,
                            rounds: st.rounds,
                            scoredAt: st.at,
                            via: "AI Agent",
                          });
                          setRole(r.id, { status: "applied" });
                        }}
                        onReadyAnyway={() => setRole(r.id, { status: "ready" })}
                        onSkip={() => setRole(r.id, { status: "skipped" })}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// ---- Experience bank: File (upload résumés) | Edit (the whole library, section by section) ----

function BankPanel({ bank, busy, onChange, onError, onBusy }: { bank: Bank | null; busy: boolean; onChange: (b: Bank) => void; onError: (m: string) => void; onBusy: (m: string) => void }) {
  const [mode, setMode] = useState<"file" | "edit">("file");
  const [onDevice, setOnDevice] = useState<string[]>([]);
  useEffect(() => {
    // Signed in: PDFs only on this device (from before they were saved to the account) go up first.
    uploadLocalFiles(bank?.sources.map((x) => x.id) ?? []).finally(() => storedIds().then(setOnDevice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank?.sources.length]);
  if (!bank) return null;
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
        onError((e as Error).message);
      }
    }
    onBusy("");
    onChange(next);
  };

  return (
    <div className="ag-bank">
      <div className="segmented" role="tablist" aria-label="Your experience">
        <button type="button" role="tab" aria-selected={mode === "file"} className={mode === "file" ? "is-active" : ""} onClick={() => setMode("file")}>
          📄 File
        </button>
        <button type="button" role="tab" aria-selected={mode === "edit"} className={mode === "edit" ? "is-active" : ""} onClick={() => setMode("edit")}>
          ✏️ Edit
        </button>
      </div>

      {mode === "file" ? (
        <>
          <label className="ag-primary ag-file">
            Upload resume (PDF)
            <input type="file" accept="application/pdf" multiple disabled={busy} onChange={(e) => upload(e.target.files)} />
          </label>
          {bank.sources.length > 0 && (
            <ul className="ag-files" aria-label="Uploaded resumes">
              {[...bank.sources].reverse().map((src) => {
                const here = onDevice.includes(src.id);
                return (
                  <li key={src.id}>
                    <span className="ag-file-name" title={src.fileName}>
                      📄 {src.fileName}
                    </span>
                    <small>{new Date(src.addedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
                    {here ? (
                      <button type="button" className="ag-linkbtn" onClick={() => viewResumeFile(src.id)}>
                        View
                      </button>
                    ) : (
                      // No saved copy (uploaded before PDFs were kept): attach the same PDF to view it.
                      <label className="ag-linkbtn ag-attach" title="Pick this PDF again to keep it with your resumes">
                        Attach to view
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            await saveResumeFile(src.id, f);
                            setOnDevice(await storedIds());
                          }}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      className="ag-file-x"
                      aria-label={`Remove ${src.fileName} from the list`}
                      title="Remove from the list (its experience stays in your library)"
                      onClick={() => {
                        deleteResumeFile(src.id);
                        onChange({ ...bank, sources: bank.sources.filter((x) => x.id !== src.id) });
                      }}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {bank.entries.length > 0 && (
            <p className="ag-small">
              {experiences} experiences · {bank.entries.length - experiences} projects · {bulletCount(bank)} bullets · {bank.skills.length} skills{" "}
              <button type="button" className="ag-linkbtn" onClick={() => setMode("edit")}>
                Edit ›
              </button>
            </p>
          )}
        </>
      ) : (
        <Library bank={bank} onChange={onChange} />
      )}
    </div>
  );
}

/**
 * Edit: everything read from the résumés (and anything typed), section by section, editable in place.
 * This is the library the AI Agent picks from for each job.
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

// ---- One role ----

type DetailProps = {
  role: QueueRole;
  st: RoleState;
  bank: Bank;
  target: number;
  profile: Profile;
  grad: { month: number; year: number };
  start: { month: number; year: number };
  busy: boolean;
  engine: "claude-code" | "relay" | null;
  onGenerate: () => void;
  onReply: (text: string) => void;
  onAnswers: (questions: Question[], answers: Record<string, { yes?: boolean; text?: string }>) => void;
  onApplied: () => void;
  onReadyAnyway: () => void;
  onSkip: () => void;
};

function RoleDetail({ role, st, bank, target, profile, grad, start, busy, engine, onGenerate, onReply, onAnswers, onApplied, onReadyAnyway, onSkip }: DetailProps) {
  const [manual, setManual] = useState(!engine);
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { yes?: boolean; text?: string }>>({});
  const a = profile.answers;
  const formAnswers: [string, string][] = [
    ["Graduation", `${MONTHS[grad.month - 1]} ${grad.year}`],
    ["Start date", `${MONTHS[start.month - 1]} ${start.year}`],
    ["Authorized to work in the U.S.", a.workAuthorized === "yes" ? `Yes${a.workAuthStatus && a.workAuthStatus !== "us_citizen_pr" ? ` (${labelFor("workAuthStatus", a.workAuthStatus)})` : ""}` : a.workAuthorized === "no" ? "No" : "—"],
    ["Needs sponsorship", a.needsSponsorship === "yes" ? "Yes" : a.needsSponsorship === "no" ? "No" : "—"],
  ];
  const answered = st.questions.some((q) => answers[q.id]?.yes || answers[q.id]?.text?.trim());
  const scores = [st.firstScore, ...st.history];

  return (
    <div className="ag-detail">
      {st.status === "error" ? (
        <p className="ob-error">{st.error}</p>
      ) : (
        <p className="ag-small">
          {scores.join(" → ")} · target {target}
          {st.status === "topped" ? " · tops out" : ""}
        </p>
      )}

      {st.status === "working" && engine && (
        <div className="ag-row-actions">
          <button type="button" className="ag-primary ag-generate" disabled={busy} onClick={onGenerate}>
            ✨ Generate
          </button>
          <button type="button" className="ag-ghost" onClick={() => setManual(!manual)}>
            {manual ? "Hide manual" : "Manual"}
          </button>
        </div>
      )}

      {st.status === "working" && manual && (
        <div className="ag-box">
          <button
            type="button"
            className="ag-primary"
            onClick={async () => {
              if (await copyText(nextPrompt(role, st, bank, target))) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }
            }}
          >
            {copied ? "✓ Copied. Paste into Claude Code" : "1. Copy prompt for Claude Code"}
          </button>
          <textarea rows={3} value={reply} placeholder="2. Paste Claude Code's reply" onChange={(e) => setReply(e.target.value)} aria-label="Claude Code's reply" />
          <button
            type="button"
            className="ag-secondary"
            disabled={busy || !reply.trim()}
            onClick={() => {
              onReply(reply);
              setReply("");
            }}
          >
            3. Score it
          </button>
        </div>
      )}

      {st.status === "needs_info" && (
        <div className="ag-box ag-questions">
          {st.questions.map((q) => (
            <div key={q.id} className="ag-q">
              <p>{q.question}</p>
              {q.kind === "skill" && (
                <label className="ag-yes">
                  <input type="checkbox" checked={!!answers[q.id]?.yes} onChange={(e) => setAnswers({ ...answers, [q.id]: { ...answers[q.id], yes: e.target.checked } })} />
                  Yes, I've used {q.skill}
                </label>
              )}
              <textarea rows={2} placeholder="Your real answer" value={answers[q.id]?.text ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: { ...answers[q.id], text: e.target.value } })} />
            </div>
          ))}
          <button type="button" className="ag-primary" disabled={!answered} onClick={() => onAnswers(st.questions, answers)}>
            Add & continue
          </button>
        </div>
      )}

      {st.curated && (
        <div className="ag-row-actions">
          <button
            type="button"
            className="ag-secondary"
            onClick={async () => {
              const header = loadHeader();
              const { bytes } = await buildResumePdf(header, st.curated!, bank.education);
              downloadPdf(bytes, `${(header.name || "Resume").replace(/[^\w]+/g, "_")}_${role.company.replace(/[^\w]+/g, "_")}.pdf`);
            }}
          >
            ⬇ PDF
          </button>
          <button type="button" className="ag-ghost" onClick={() => setPreview(!preview)}>
            {preview ? "Hide" : "Preview"}
          </button>
          <button type="button" className="ag-ghost" onClick={() => copyText(resumeText(st.curated!, bank.education))}>
            Copy text
          </button>
        </div>
      )}
      {preview && st.curated && (
        <div className="ag-box">
          {st.curated.entries.map((e) => (
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
          {st.curated.skills.length > 0 && <p className="ag-small">Skills: {st.curated.skills.join(", ")}</p>}
        </div>
      )}

      {(st.status === "ready" || st.status === "applied") && (
        <dl className="ag-answers">
          {formAnswers.map(([q, v]) => (
            <div key={q}>
              <dt>{q}</dt>
              <dd>
                {v}
                <button type="button" onClick={() => copyText(v)} aria-label={`Copy: ${q}`}>
                  Copy
                </button>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="ag-row-actions">
        <a className="ag-primary" href={role.url} target="_blank" rel="noreferrer">
          Apply ↗
        </a>
        {st.status !== "applied" && (
          <button type="button" className="ag-secondary" onClick={onApplied}>
            ✓ Applied
          </button>
        )}
        {(st.status === "working" || st.status === "topped" || st.status === "needs_info") && (
          <button type="button" className="ag-ghost" onClick={onReadyAnyway}>
            Ready anyway
          </button>
        )}
        {st.status !== "applied" && (
          <button type="button" className="ag-ghost" onClick={onSkip}>
            Skip
          </button>
        )}
      </div>
    </div>
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
