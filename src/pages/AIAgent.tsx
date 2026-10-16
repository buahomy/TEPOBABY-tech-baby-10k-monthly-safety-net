import { useCallback, useEffect, useRef, useState } from "react";
import CompanyLogo from "../components/CompanyLogo";
import {
  AgentState,
  MAX_ROUNDS,
  NeedClaudeKeyError,
  Question,
  QueueRole,
  RoleState,
  addAnswers,
  checkRole,
  errorState,
  fetchQueue,
  loadAgent,
  resumeText,
  runLoop,
  saveAgent,
  today,
} from "../utils/aiAgent";
import { AnthropicKeyError, checkAnthropicKey, clearAnthropicKey, getAnthropicKey, looksLikeAnthropicKey, saveAnthropicKey } from "../utils/claude";
import { Bank, BankEntry, bulletCount, emptyBank, loadBank, mergeParsed, mergeSkills, parseResume, saveBank, uid } from "../utils/experienceBank";
import { copyText } from "../utils/linkedin";
import { ResumeHeader, buildResumePdf, downloadPdf, loadHeader, saveHeader } from "../utils/resumePdf";
import { MONTHS, Profile, labelFor } from "../utils/profile";
import { SavedJobsApi } from "../utils/savedJobs";
import "./aiAgent.css";

// AI Agent (Profile → My jobs).
//   Experience bank: every resume version the student uploads (parsed into experiences, bullets,
//   skills) plus anything they type.
//   Every day: finds roles that fit, then for each one curates a resume from the bank with Claude,
//   checks it with the ATS match, and loops until it reaches the target (85+), or asks the student
//   for the real details it needs. Then: ready to apply. The student submits.

type Props = { signedIn: boolean; profile: Profile; saved: SavedJobsApi };
type Tab = "ready" | "info" | "working" | "todo" | "applied";

// Kinds of roles, from the title. The agent only checks the kinds the student picks.
const FIELDS = [
  { id: "software", label: "Software", re: /\b(software|swe|sde|developer|full[- ]?stack|front[- ]?end|back[- ]?end|mobile|ios|android|web|platform|infrastructure|devops|sre|cloud|site reliability|forward deployed)\b/i },
  { id: "data", label: "Data & AI", re: /\b(data|machine learning|ml|ai|artificial intelligence|analytics|scientist|research engineer|quant\w*)\b/i },
  { id: "hardware", label: "Hardware", re: /\b(hardware|asic|fpga|pcb|silicon|circuit|chip|verification|firmware|embedded|electrical|rf|systems? design engineer|mechanical|manufacturing)\b/i },
  { id: "security", label: "Security", re: /\b(security|cyber|threat|identity)\b/i },
  { id: "product", label: "Product & program", re: /\b(product manag\w*|product analyst|program manag\w*|technical program|tpm|apm)\b/i },
  { id: "business", label: "Finance & business", re: /\b(financ\w*|accounting|analyst|business|strategy|operations|consult\w*|banking|investment|treasury|audit)\b/i },
  { id: "sales", label: "Sales & solutions", re: /\b(sales|solutions?|account|customer success|partner|marketing)\b/i },
] as const;
type FieldId = (typeof FIELDS)[number]["id"];
const FIELD_KEY = "tepobaby.aiAgent.fields";
function loadFields(): FieldId[] {
  try {
    const v = JSON.parse(localStorage.getItem(FIELD_KEY) || localStorage.getItem("tepobaby.applyAgent.fields") || "null");
    if (Array.isArray(v)) return v;
  } catch {
    // ignore
  }
  return ["software", "data"];
}
const inFields = (title: string, fields: FieldId[]) => !fields.length || FIELDS.some((f) => fields.includes(f.id) && f.re.test(title));

const CHECK_BATCH = 10;
const CURATE_BATCH = 5; // roles curated per run (each takes a few Claude calls on the student's key)

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
  const [tab, setTab] = useState<Tab>("ready");
  const [open, setOpen] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldId[]>(loadFields);
  const [anthropicKey, setAnthropicKey] = useState(getAnthropicKey);
  const [keyOpen, setKeyOpen] = useState(false);
  const stopRef = useRef(false);
  const [access, setAccess] = useState<{ allowed: boolean; plan: string; demo: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/agent/access")
      .then((r) => r.json())
      .then(setAccess)
      .catch(() => setAccess({ allowed: true, plan: "pro", demo: true }));
  }, [signedIn]);

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
  const writer = { claudeKey: anthropicKey || null };

  /** Runs the curate → ATS loop for each role in turn. */
  const curateRoles = useCallback(
    async (ids: string[]) => {
      for (let i = 0; i < ids.length && !stopRef.current; i++) {
        const role = queue?.find((r) => r.id === ids[i]);
        const st = agentRef.current.roles[ids[i]];
        if (!role || !st) continue;
        try {
          const done = await runLoop(
            signedIn,
            role,
            st,
            bankRef.current,
            agentRef.current.target,
            writer,
            (s, msg) => {
              setBusy(`${msg} (${i + 1} of ${ids.length})`);
              put(role.id, s);
            },
            () => stopRef.current,
          );
          put(role.id, done);
        } catch (e) {
          setError((e as Error).message);
          if (e instanceof AnthropicKeyError || e instanceof NeedClaudeKeyError) setKeyOpen(true);
          stopRef.current = true;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, signedIn, put, anthropicKey],
  );

  /** The daily run: check the next roles against the bank, then curate the ones below the target. */
  const runAgent = useCallback(async () => {
    if (!queue || busy || !bankRef.current.entries.length) return;
    stopRef.current = false;
    setError("");
    const batch = queue.filter((r) => !agentRef.current.roles[r.id] && inFields(r.title, fields)).slice(0, CHECK_BATCH);
    for (let i = 0; i < batch.length && !stopRef.current; i++) {
      const role = batch[i];
      setBusy(`Checking ${i + 1} of ${batch.length}: ${role.company}`);
      try {
        put(role.id, await checkRole(signedIn, role, bankRef.current, agentRef.current.target));
      } catch (e) {
        const err = e as Error & { needDescription?: boolean };
        if (/a lot of analyses/i.test(err.message)) {
          setError("You've hit the hourly limit for ATS checks. The agent will pick up where it left off later.");
          break;
        }
        put(role.id, errorState(err.needDescription ? "Couldn't read this posting's description." : err.message));
      }
    }
    commit((a) => ({ ...a, lastAutoRun: today() }));
    const working = Object.entries(agentRef.current.roles)
      .filter(([, s]) => s.status === "working")
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, CURATE_BATCH)
      .map(([id]) => id);
    if (!stopRef.current) await curateRoles(working);
    setBusy("");
  }, [queue, busy, fields, signedIn, put, commit, curateRoles]);

  // Automatic daily run: once a day, when Profile opens with an experience bank.
  useEffect(() => {
    if (queue && hasBank && agent.lastAutoRun !== today() && !busy) runAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, hasBank]);

  const list = (statuses: RoleState["status"][]) =>
    (queue ?? []).filter((r) => agent.roles[r.id] && statuses.includes(agent.roles[r.id].status)).sort((a, b) => agent.roles[b.id].score - agent.roles[a.id].score);
  const ready = list(["ready"]);
  const info = list(["needs_info"]);
  const working = list(["working", "topped", "error"]);
  const applied = list(["applied"]);

  const setRole = (id: string, patch: Partial<RoleState>) => put(id, { ...agent.roles[id], ...patch });

  return (
    <section className="block ag" aria-labelledby="h-agent">
      <div className="block-head">
        <h2 id="h-agent" className="ag-title">
          <AgentMark />
          AI Agent
        </h2>
        <span className="ag-pro" title="The AI Agent is a subscription feature">PRO</span>
        <span className="block-sub">target {agent.target}+</span>
      </div>
      {access?.demo && <p className="ag-demo">✨ Subscription feature, <strong>free for everyone during the demo</strong>.</p>}
      <p className="block-note">
        Upload every version of your resume (or type your experience) once. Every day the agent finds roles that fit you,
        curates a resume for each one from your experience with Claude, checks the ATS score, and keeps refining until it
        reaches {agent.target}+, or asks you for the real details it needs. Then it's ready to apply: you review and
        submit. It never invents experience and never submits for you.
      </p>

      {access && !access.allowed ? (
        <div className="ag-paywall">
          <h3>Subscribe to use the AI Agent</h3>
          <p>
            The AI Agent is part of Tepobaby Pro. Subscriptions are coming soon; sign in with your .edu account to be first in
            line.
          </p>
        </div>
      ) : (
        <>
      <details className="ag-how">
        <summary>How it works</summary>
        <ol>
          <li>
            <strong>Job text</strong>: fetched from the posting's own API (Greenhouse, Lever, Ashby, Workday, Microsoft…).
          </li>
          <li>
            <strong>Your resume</strong>: every version you upload is read into text with your name and contact details removed,
            then merged into your experience bank.
          </li>
          <li>
            <strong>Curate</strong>: Claude builds a resume for this job from your bank, rewording and reordering only, never adding
            facts.
          </li>
          <li>
            <strong>Rebuild</strong>: it becomes a one-page PDF in EB Garamond with your header and clickable links.
          </li>
          <li>
            <strong>Rescore</strong>: that PDF is read back and scored: skills by keyword match (BM25), meaning by Voyage AI
            embeddings, and evidence per requirement.
          </li>
          <li>
            <strong>Repeat</strong> until {agent.target}+, or until changes stop helping. If only your real experience can help, it
            asks you.
          </li>
          <li>
            <strong>Ready to apply</strong>: download the PDF, copy your form answers, and submit it yourself.
          </li>
        </ol>
      </details>

      <BankPanel bank={bank} signedIn={signedIn} busy={!!busy} onChange={updateBank} onError={setError} onBusy={setBusy} />

      <div className="ag-facts">
        <span>
          🎓 Graduating {MONTHS[grad.month - 1]} {grad.year}
        </span>
        <label>
          🗓 Start
          <select
            value={`${start.year}-${start.month}`}
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
                  {MONTHS[m - 1]} {y}
                </option>
              );
            })}
          </select>
        </label>
        <span>{needsSponsorship ? `🛂 ${labelFor("workAuthStatus", profile.answers.workAuthStatus) || "Needs sponsorship"}: hides “no sponsorship” roles` : "🇺🇸 No sponsorship needed"}</span>
        <label>
          🎯 Target
          <select value={agent.target} onChange={(e) => commit((a) => ({ ...a, target: Number(e.target.value) }))} disabled={!!busy}>
            {[70, 75, 80, 85, 90].map((t) => (
              <option key={t} value={t}>
                {t}+
              </option>
            ))}
          </select>
        </label>
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
                localStorage.setItem(FIELD_KEY, JSON.stringify(next));
              } catch {
                // ignore
              }
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <KeyRow
        anthropicKey={anthropicKey}
        open={keyOpen}
        onOpen={setKeyOpen}
        onSaved={(k) => {
          setAnthropicKey(k);
          setError("");
        }}
        onRemove={() => {
          clearAnthropicKey();
          setAnthropicKey("");
        }}
      />

      <div className="ag-actions">
        <button type="button" className="ag-primary" disabled={!queue || !hasBank || !!busy} onClick={runAgent}>
          {!hasBank ? "Add your experience to start" : todo.length ? `Run agent: next ${Math.min(CHECK_BATCH, todo.length)} roles` : "Run agent on roles below target"}
        </button>
      </div>
      {busy && (
        <p className="ag-busy">
          <span className="ag-spinner" aria-hidden="true" /> {busy}{" "}
          <button type="button" onClick={() => (stopRef.current = true)}>
            Stop
          </button>
        </p>
      )}
      {error && <p className="ob-error">{error}</p>}

      <div className="segmented ag-tabs" role="tablist" aria-label="AI Agent">
        {(
          [
            ["ready", `✅ Ready · ${ready.length}`],
            ["info", `✍️ Needs your info · ${info.length}`],
            ["working", `🔁 Working · ${working.length}`],
            ["todo", `🕓 To check · ${todo.length}`],
            ["applied", `📨 Applied · ${applied.length}`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {queue === null && !error && <p className="empty">Finding today's roles…</p>}

      {tab === "todo" && (
        <ul className="ag-list">
          {todo.slice(0, 40).map((r) => (
            <li key={r.id} className="ag-row">
              <CompanyLogo company={r.company} domain={r.domain} />
              <span className="ag-row-text">
                <strong>{r.company}</strong>
                <small>{r.title}</small>
              </span>
              <FitChip role={r} />
            </li>
          ))}
          {!todo.length && queue && <p className="empty">Every role that fits you today has been checked. New ones arrive each morning.</p>}
        </ul>
      )}

      {tab !== "todo" && (
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
                  <span className={`ag-score ${st.score >= agent.target ? "is-ok" : ""}`}>
                    {st.status === "error" ? "—" : st.score}
                    {st.status !== "error" && st.firstScore !== st.score && <small>from {st.firstScore}</small>}
                  </span>
                </button>
                {open === r.id && (
                  <RoleDetail
                    role={r}
                    st={st}
                    target={agent.target}
                    education={bank?.education ?? []}
                    profile={profile}
                    grad={grad}
                    start={start}
                    busy={!!busy}
                    onCurate={async () => {
                      stopRef.current = false;
                      setError("");
                      await curateRoles([r.id]);
                      setBusy("");
                    }}
                    onAnswers={async (questions, answers) => {
                      updateBank(addAnswers(bankRef.current, questions, answers));
                      put(r.id, { ...st, status: "working", rounds: 0, questions: [] });
                      stopRef.current = false;
                      setError("");
                      await curateRoles([r.id]);
                      setBusy("");
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
          {tab === "ready" && !ready.length && queue && <p className="empty">Nothing ready yet. Run the agent, or answer its questions under “Needs your info”.</p>}
          {tab === "info" && !info.length && <p className="empty">No questions right now. The agent asks here when only your real experience can raise a score.</p>}
          {tab === "working" && !working.length && <p className="empty">Nothing in progress.</p>}
          {tab === "applied" && !applied.length && <p className="empty">Roles you mark applied show up here and in My jobs → Applied.</p>}
        </ul>
      )}

        </>
      )}
      <p className="block-foot">
        Runs once a day when you open Profile ({CHECK_BATCH} new roles checked, up to {CURATE_BATCH} curated), plus whenever you
        tap “Run agent”. Scores are Tepobaby's ATS estimate; each company's own ATS differs, so a high score improves your
        odds but can't guarantee an interview. Your experience bank is saved {signedIn ? "to your account" : "on this device"};
        agent progress is saved on this device.
      </p>
    </section>
  );
}

// ---- Experience bank ----

function BankPanel({
  bank,
  signedIn,
  busy,
  onChange,
  onError,
  onBusy,
}: {
  bank: Bank | null;
  signedIn: boolean;
  busy: boolean;
  onChange: (b: Bank) => void;
  onError: (m: string) => void;
  onBusy: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");
  if (!bank) return <p className="empty">Loading your experience…</p>;
  const experiences = bank.entries.filter((e) => e.kind !== "project").length;
  const projects = bank.entries.length - experiences;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    let next = bank;
    for (const [i, f] of [...files].entries()) {
      onBusy(`Reading resume ${i + 1} of ${files.length}: ${f.name}`);
      try {
        next = mergeParsed(next, await parseResume(f));
      } catch (e) {
        onError((e as Error).message);
      }
    }
    onBusy("");
    onChange(next);
  };

  return (
    <div className="ag-bank">
      <div className="ag-bank-head">
        <h3>Your experience bank</h3>
        <span>
          {experiences} experiences · {projects} projects · {bulletCount(bank)} bullets · {bank.skills.length} skills
          {bank.sources.length ? ` · from ${bank.sources.length} resume version${bank.sources.length > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      <div className="ag-row-actions">
        <label className="ag-secondary ag-file">
          📄 Upload resume versions (PDF)
          <input type="file" accept="application/pdf" multiple disabled={busy} onChange={(e) => upload(e.target.files)} />
        </label>
        <button type="button" className="ag-secondary" onClick={() => setAdding(!adding)}>
          ✏️ Type an experience
        </button>
        {bank.entries.length > 0 && (
          <button type="button" className="ag-ghost" onClick={() => setEditing(!editing)}>
            {editing ? "Done" : "Review & edit"}
          </button>
        )}
      </div>
      <p className="ag-small">
        Upload as many versions as you have: duplicates are merged, so every experience, bullet and skill is in one place. Your
        name and contact details are removed when a PDF is read. Saved {signedIn ? "to your account" : "on this device"}.
      </p>

      <HeaderForm />

      {adding && (
        <EntryForm
          onSave={(entry) => {
            onChange({ ...bank, entries: [...bank.entries, entry] });
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <form
        className="ag-skillform"
        onSubmit={(e) => {
          e.preventDefault();
          const add = skillDraft.split(",").map((s) => s.trim()).filter(Boolean);
          if (add.length) onChange({ ...bank, skills: mergeSkills(bank.skills, add) });
          setSkillDraft("");
        }}
      >
        <input value={skillDraft} placeholder="Add skills you've really used: Python, SQL, Excel…" onChange={(e) => setSkillDraft(e.target.value)} aria-label="Add skills" />
        <button type="submit" className="ag-secondary" disabled={!skillDraft.trim()}>
          Add
        </button>
      </form>
      {bank.skills.length > 0 && (
        <div className="ag-skillchips">
          {bank.skills.map((s) => (
            <span key={s}>
              {s}
              {editing && (
                <button type="button" aria-label={`Remove ${s}`} onClick={() => onChange({ ...bank, skills: bank.skills.filter((x) => x !== s) })}>
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {editing && (
        <ul className="ag-entries">
          {bank.entries.map((e) => (
            <li key={e.id}>
              <div className="ag-entry-head">
                <strong>{[e.title, e.org].filter(Boolean).join(", ")}</strong>
                <small>
                  {e.kind}
                  {e.dates ? ` · ${e.dates}` : ""}
                </small>
                <button type="button" onClick={() => onChange({ ...bank, entries: bank.entries.filter((x) => x.id !== e.id) })}>
                  Remove
                </button>
              </div>
              <ul>
                {e.bullets.map((b) => (
                  <li key={b.id}>
                    <textarea
                      rows={2}
                      defaultValue={b.text}
                      aria-label="Bullet"
                      onBlur={(ev) => {
                        const text = ev.target.value.trim();
                        if (text === b.text) return;
                        onChange({
                          ...bank,
                          entries: bank.entries.map((x) =>
                            x.id !== e.id ? x : { ...x, bullets: text ? x.bullets.map((y) => (y.id === b.id ? { ...y, text } : y)) : x.bullets.filter((y) => y.id !== b.id) },
                          ),
                        });
                      }}
                    />
                  </li>
                ))}
              </ul>
              <AddBullet onAdd={(text) => onChange({ ...bank, entries: bank.entries.map((x) => (x.id === e.id ? { ...x, bullets: [...x.bullets, { id: uid("b"), text, source: "typed" }] } : x)) })} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Name, contact details and links for the PDF header. Kept on this device; never sent to an AI. */
function HeaderForm() {
  const [h, setH] = useState<ResumeHeader>(loadHeader);
  const [open, setOpen] = useState(() => !loadHeader().name);
  const set = (k: keyof ResumeHeader, v: string) => {
    const next = { ...h, [k]: v };
    setH(next);
    saveHeader(next);
  };
  if (!open)
    return (
      <p className="ag-small">
        PDF header: <strong>{h.name}</strong>
        {h.email ? ` · ${h.email}` : ""}{" "}
        <button type="button" className="ag-linkbtn" onClick={() => setOpen(true)}>
          Edit
        </button>
      </p>
    );
  return (
    <div className="ag-entryform">
      <strong className="ag-small">Your resume header (only in your PDF, stays on this device, never sent to an AI)</strong>
      <input value={h.name} placeholder="Full name" onChange={(e) => set("name", e.target.value)} />
      <input value={h.email} placeholder="Email" onChange={(e) => set("email", e.target.value)} />
      <input value={h.phone} placeholder="Phone" onChange={(e) => set("phone", e.target.value)} />
      <input value={h.location} placeholder="City, State" onChange={(e) => set("location", e.target.value)} />
      <input value={h.links} placeholder="Links, comma-separated: linkedin.com/in/you, github.com/you" onChange={(e) => set("links", e.target.value)} />
      <div className="ag-row-actions">
        <button type="button" className="ag-secondary" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </div>
  );
}

function EntryForm({ onSave, onCancel }: { onSave: (e: BankEntry) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<BankEntry["kind"]>("experience");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  const [dates, setDates] = useState("");
  const [bullets, setBullets] = useState("");
  return (
    <form
      className="ag-entryform"
      onSubmit={(e) => {
        e.preventDefault();
        const lines = bullets.split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);
        if (!title.trim() || !lines.length) return;
        onSave({ id: uid("e"), kind, title: title.trim(), org: org.trim(), dates: dates.trim(), bullets: lines.map((text) => ({ id: uid("b"), text, source: "typed" })) });
      }}
    >
      <select value={kind} onChange={(e) => setKind(e.target.value as BankEntry["kind"])} aria-label="Kind">
        <option value="experience">Experience</option>
        <option value="project">Project</option>
        <option value="leadership">Leadership / activity</option>
      </select>
      <input value={title} placeholder={kind === "project" ? "Project name" : "Role, e.g. Software Engineering Intern"} onChange={(e) => setTitle(e.target.value)} />
      {kind !== "project" && <input value={org} placeholder="Company or organization" onChange={(e) => setOrg(e.target.value)} />}
      <input value={dates} placeholder="Dates, e.g. Summer 2025" onChange={(e) => setDates(e.target.value)} />
      <textarea rows={4} value={bullets} placeholder={"One bullet per line: what you did, with what, and the result.\nBuilt … with … that cut … by 40%"} onChange={(e) => setBullets(e.target.value)} />
      <div className="ag-row-actions">
        <button type="submit" className="ag-primary" disabled={!title.trim() || !bullets.trim()}>
          Add to my bank
        </button>
        <button type="button" className="ag-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddBullet({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="ag-skillform"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onAdd(text.trim());
        setText("");
      }}
    >
      <input value={text} placeholder="Add a bullet" onChange={(e) => setText(e.target.value)} aria-label="Add a bullet" />
      <button type="submit" className="ag-secondary" disabled={!text.trim()}>
        Add
      </button>
    </form>
  );
}

// ---- Claude key ----

function KeyRow({ anthropicKey, open, onOpen, onSaved, onRemove }: { anthropicKey: string; open: boolean; onOpen: (o: boolean) => void; onSaved: (k: string) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  if (!open)
    return (
      <div className="ag-writer">
        {anthropicKey ? (
          <span>
            ✍️ Curated by <strong>Claude</strong> on your Anthropic key sk-ant-…{anthropicKey.slice(-4)}.{" "}
            <button type="button" onClick={() => onOpen(true)}>
              Change key
            </button>
            <button type="button" onClick={onRemove}>
              Remove
            </button>
          </span>
        ) : (
          <span>
            ✍️ Add your Anthropic API key so <strong>Claude</strong> curates your resumes. Until then, Gemini (free, often busy)
            does it.{" "}
            <button type="button" onClick={() => onOpen(true)}>
              Add Anthropic key
            </button>
          </span>
        )}
      </div>
    );
  return (
    <form
      className="ag-keyform"
      onSubmit={async (e) => {
        e.preventDefault();
        const k = draft.trim();
        if (!looksLikeAnthropicKey(k)) return setMsg("That doesn't look like an Anthropic key. It starts with “sk-ant-”.");
        setMsg("Checking with Anthropic…");
        const issue = await checkAnthropicKey(k);
        if (issue) return setMsg(issue);
        saveAnthropicKey(k, true);
        onSaved(k);
        setDraft("");
        setMsg("");
        onOpen(false);
      }}
    >
      <span>
        Paste an Anthropic API key from{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>
        . It's billed to your account, stays in this browser, and goes only to Anthropic.
      </span>
      <input type="password" value={draft} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} aria-label="Anthropic API key" onChange={(e) => setDraft(e.target.value)} />
      {msg && <small>{msg}</small>}
      <div className="ag-row-actions">
        <button type="submit" className="ag-primary" disabled={!draft.trim()}>
          Save key
        </button>
        <button type="button" className="ag-ghost" onClick={() => onOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---- One role ----

function FitChip({ role }: { role: QueueRole }) {
  return (
    <span className="ag-chips">
      {role.fit === "match" && <span className="chip-ok">Your class / start</span>}
      {role.fit === "later" && <span className="chip-program">Starts later</span>}
      {role.sponsorshipNote === "sponsors" && <span className="chip-ok">Sponsors visa</span>}
      {role.sponsorshipNote === "unknown" && <span className="chip-program">Sponsorship not stated</span>}
      {role.program && <span className="chip-program">Rotational</span>}
    </span>
  );
}

type DetailProps = {
  role: QueueRole;
  st: RoleState;
  target: number;
  education: string[];
  profile: Profile;
  grad: { month: number; year: number };
  start: { month: number; year: number };
  busy: boolean;
  onCurate: () => void;
  onAnswers: (questions: Question[], answers: Record<string, { yes?: boolean; text?: string }>) => void;
  onApplied: () => void;
  onReadyAnyway: () => void;
  onSkip: () => void;
};

function RoleDetail({ role, st, target, education, profile, grad, start, busy, onCurate, onAnswers, onApplied, onReadyAnyway, onSkip }: DetailProps) {
  const [answers, setAnswers] = useState<Record<string, { yes?: boolean; text?: string }>>({});
  const a = profile.answers;
  const formAnswers: [string, string][] = [
    ["Graduation date", `${MONTHS[grad.month - 1]} ${grad.year}`],
    ["Earliest start date", `${MONTHS[start.month - 1]} ${start.year}`],
    [
      "Are you legally authorized to work in the U.S.?",
      a.workAuthorized === "yes" ? `Yes${a.workAuthStatus && a.workAuthStatus !== "us_citizen_pr" ? ` (${labelFor("workAuthStatus", a.workAuthStatus)})` : ""}` : a.workAuthorized === "no" ? "No" : "—",
    ],
    ["Will you now or in the future require visa sponsorship?", a.needsSponsorship === "yes" ? "Yes" : a.needsSponsorship === "no" ? "No" : "—"],
  ];
  const answered = st.questions.some((q) => answers[q.id]?.yes || answers[q.id]?.text?.trim());

  return (
    <div className="ag-detail">
      <FitChip role={role} />
      {st.status === "error" && <p className="ob-error">{st.error}</p>}

      {st.status !== "error" && (
        <div className="ag-box">
          <h4>
            {st.status === "ready"
              ? `✅ Ready to apply · ${st.score}`
              : st.status === "applied"
                ? `📨 Applied · ${st.score}`
                : st.status === "needs_info"
                  ? `✍️ Needs your info · ${st.score} (target ${target})`
                  : st.status === "topped"
                    ? `Tops out at ${st.score} with your current experience`
                    : `🔁 Working · ${st.score} (target ${target})`}
          </h4>
          {st.history.length > 0 && <p className="ag-small">ATS score by round: {[st.firstScore, ...st.history].join(" → ")}</p>}
          {st.status === "topped" && (
            <p>
              Your experience bank can't honestly reach {target} for this role.
              {st.missingSkills.length ? ` The job wants: ${st.missingSkills.map((m) => m.skill).slice(0, 6).join(", ")}.` : ""} If you
              have real experience with any of these, add it to your bank and run again. Or apply anyway.
            </p>
          )}
          {st.curated?.note && <p className="ag-small">{st.curated.note}</p>}
        </div>
      )}

      {st.status === "needs_info" && st.questions.length > 0 && (
        <div className="ag-box ag-questions">
          <h4>To raise this score, the agent needs your real experience</h4>
          {st.questions.map((q) => (
            <div key={q.id} className="ag-q">
              <p>{q.question}</p>
              {q.kind === "skill" && (
                <label className="ag-yes">
                  <input type="checkbox" checked={!!answers[q.id]?.yes} onChange={(e) => setAnswers({ ...answers, [q.id]: { ...answers[q.id], yes: e.target.checked } })} />
                  Yes, I've really used {q.skill}
                </label>
              )}
              <textarea
                rows={2}
                placeholder={q.kind === "skill" ? `Where and how? (optional, adds a bullet) e.g. Used ${q.skill} to …` : "Your answer, as a resume bullet: what you did, with what, and the real result"}
                value={answers[q.id]?.text ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: { ...answers[q.id], text: e.target.value } })}
              />
            </div>
          ))}
          <p className="ag-small">Only answer with things you really did. Leave a question blank if it doesn't apply.</p>
          <div className="ag-row-actions">
            <button type="button" className="ag-primary" disabled={busy || !answered} onClick={() => onAnswers(st.questions, answers)}>
              Add to my bank & keep curating
            </button>
            <button type="button" className="ag-secondary" onClick={onReadyAnyway}>
              Apply anyway
            </button>
          </div>
        </div>
      )}

      {(st.status === "working" || st.status === "topped") && (
        <div className="ag-row-actions">
          {st.status === "working" && (
            <button type="button" className="ag-primary" disabled={busy} onClick={onCurate}>
              {st.rounds ? "Keep curating" : "Curate this role"}
            </button>
          )}
          <button type="button" className="ag-secondary" onClick={onReadyAnyway}>
            Apply anyway
          </button>
        </div>
      )}

      {st.curated && (
        <div className="ag-box">
          <h4>Your resume for this role {st.rounds ? `(after ${st.rounds} round${st.rounds > 1 ? "s" : ""})` : ""}</h4>
          {st.curated.entries.map((e) => (
            <div key={e.entryId} className="ag-cv-entry">
              <strong>
                {[e.title, e.org].filter(Boolean).join(", ")}
                {e.dates ? ` (${e.dates})` : ""}
              </strong>
              <ul className="ag-changes">
                {e.bullets.map((b) => (
                  <li key={b.bulletId}>
                    <ins>{b.text}</ins>
                    {b.text !== b.original && <small>Your words: {b.original}</small>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {st.curated.skills.length > 0 && <p className="ag-small">Skills: {st.curated.skills.join(", ")}</p>}
          <p className="ag-small">Check every reworded bullet: it should say only what you really did.</p>
          {st.curated.dropped ? <p className="ag-small">{st.curated.dropped} lower-priority bullet{st.curated.dropped > 1 ? "s were" : " was"} left out to keep it to one page.</p> : null}
          <div className="ag-row-actions">
            <button
              type="button"
              className="ag-primary"
              onClick={async () => {
                const header = loadHeader();
                const { bytes } = await buildResumePdf(header, st.curated!, education);
                const who = (header.name || "Resume").replace(/[^\w]+/g, "_");
                downloadPdf(bytes, `${who}_${role.company.replace(/[^\w]+/g, "_")}.pdf`);
              }}
            >
              ⬇ Download PDF
            </button>
            <button type="button" className="ag-secondary" onClick={() => copyText(resumeText(st.curated!, education))}>
              Copy as text
            </button>
          </div>
        </div>
      )}

      {(st.status === "ready" || st.status === "applied") && (
        <div className="ag-box">
          <h4>Your answers for the application form</h4>
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
          <p className="ag-small">From your profile answers. Read each question on the form: answer it exactly and truthfully.</p>
        </div>
      )}

      <div className="ag-row-actions">
        <a className="ag-primary" href={role.url} target="_blank" rel="noreferrer">
          Open application ↗
        </a>
        {st.status !== "applied" && (
          <button type="button" className="ag-secondary" onClick={onApplied}>
            ✓ I applied
          </button>
        )}
        {st.status !== "applied" && (
          <button type="button" className="ag-ghost" onClick={onSkip}>
            Skip
          </button>
        )}
      </div>
      {st.rounds >= MAX_ROUNDS && st.status === "working" && <p className="ag-small">Reached {MAX_ROUNDS} rounds; you can keep curating.</p>}
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
