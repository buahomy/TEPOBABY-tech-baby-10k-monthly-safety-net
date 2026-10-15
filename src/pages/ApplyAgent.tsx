import { useCallback, useEffect, useRef, useState } from "react";
import CompanyLogo from "../components/CompanyLogo";
import {
  AgentState,
  MAX_ROUNDS,
  QueueRole,
  RoleState,
  GeminiUnavailableError,
  applyStudentInput,
  checkRole,
  fetchQueue,
  improveRole,
  loadAgent,
  resumeText,
  saveAgent,
  today,
} from "../utils/applyAgent";
import { AnthropicKeyError, checkAnthropicKey, clearAnthropicKey, getAnthropicKey, looksLikeAnthropicKey, saveAnthropicKey } from "../utils/claudeTailor";
import { ResumeMeta, getResume, uploadResume } from "../utils/ginny";
import { copyText } from "../utils/linkedin";
import { MONTHS, Profile, labelFor } from "../utils/profile";
import { SavedJobsApi } from "../utils/savedJobs";
import "./apply.css";

// Apply agent (Profile → My jobs). Finds today's roles that fit, checks each with the ATS match,
// tailors a copy of the resume toward the target score, and prepares everything to submit.
// The student submits each application themselves.

type Props = { signedIn: boolean; profile: Profile; saved: SavedJobsApi };
type Tab = "ready" | "below" | "todo" | "applied";

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
const FIELD_KEY = "tepobaby.applyAgent.fields";
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
const IMPROVE_BATCH = 5;

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

export default function ApplyAgent({ signedIn, profile, saved }: Props) {
  const [agent, setAgent] = useState<AgentState>(loadAgent);
  const agentRef = useRef(agent);
  const grad = profile.answers.graduation ?? { month: 5, year: new Date().getFullYear() };
  const [start, setStart] = useState(() => defaultStart(profile));
  const needsSponsorship = profile.answers.needsSponsorship === "yes" || profile.answers.workAuthorized === "no";
  const [queue, setQueue] = useState<QueueRole[] | null>(null);
  const [resume, setResume] = useState<ResumeMeta | null | undefined>(undefined);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("ready");
  const [open, setOpen] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldId[]>(loadFields);
  const [anthropicKey, setAnthropicKey] = useState(getAnthropicKey);
  const [keyDraft, setKeyDraft] = useState("");
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyMsg, setKeyMsg] = useState("");
  const stopRef = useRef(false);

  const commit = useCallback((fn: (a: AgentState) => AgentState) => {
    const next = fn(agentRef.current);
    agentRef.current = next;
    saveAgent(next);
    setAgent(next);
  }, []);
  const put = useCallback((id: string, rs: RoleState) => commit((a) => ({ ...a, roles: { ...a.roles, [id]: rs } })), [commit]);

  useEffect(() => {
    getResume(signedIn).then(setResume, () => setResume(null));
  }, [signedIn]);

  useEffect(() => {
    setQueue(null);
    fetchQueue({ gradYear: grad.year, gradMonth: grad.month, startYear: start.year, startMonth: start.month, needsSponsorship })
      .then(setQueue)
      .catch((e: Error) => setError(e.message));
  }, [grad.year, grad.month, start.year, start.month, needsSponsorship]);

  const roleById = (id: string) => queue?.find((r) => r.id === id);
  const todo = (queue ?? []).filter((r) => !agent.roles[r.id] && inFields(r.title, fields));

  // ---- Daily check: ATS-score the next roles ----
  const runCheck = useCallback(
    async (n: number) => {
      if (!queue || busy) return;
      stopRef.current = false;
      setError("");
      const batch = queue.filter((r) => !agentRef.current.roles[r.id] && inFields(r.title, fields)).slice(0, n);
      for (let i = 0; i < batch.length && !stopRef.current; i++) {
        const role = batch[i];
        setBusy(`Checking ${i + 1} of ${batch.length}: ${role.company}`);
        try {
          const { state, base } = await checkRole(signedIn, role, agentRef.current);
          commit((a) => ({ ...a, base, roles: { ...a.roles, [role.id]: state } }));
        } catch (e) {
          const err = e as Error & { needResume?: boolean; needDescription?: boolean; status?: number };
          if (err.needResume) {
            setResume(null);
            setError("Upload your resume to start.");
            break;
          }
          if (/a lot of analyses/i.test(err.message)) {
            setError("You've hit the hourly limit for checks. The agent will pick up where it left off later.");
            break;
          }
          put(role.id, {
            status: "error",
            score: 0,
            firstScore: 0,
            rounds: 0,
            changes: [],
            pending: [],
            missingSkills: [],
            confirmedSkills: [],
            gaps: [],
            requirements: [],
            error: err.needDescription ? "Couldn't read this posting's description." : err.message,
            at: new Date().toISOString(),
          });
        }
      }
      commit((a) => ({ ...a, lastAutoRun: today() }));
      setBusy("");
    },
    [queue, busy, signedIn, commit, put, fields],
  );

  // ---- Improve: tailor roles below the target, a few rounds each ----
  const runImprove = useCallback(
    async (ids: string[]) => {
      if (busy) return;
      stopRef.current = false;
      setError("");
      for (let i = 0; i < ids.length && !stopRef.current; i++) {
        const role = roleById(ids[i]);
        let st = agentRef.current.roles[ids[i]];
        if (!role || !st) continue;
        while (st.status === "below" && st.rounds < MAX_ROUNDS && !stopRef.current) {
          setBusy(`Tailoring ${i + 1} of ${ids.length}: ${role.company}, round ${st.rounds + 1}`);
          try {
            const round = st.rounds + 1;
            st = await improveRole(signedIn, role, st, agentRef.current, {
              claudeKey: anthropicKey || null,
              onSwitch: () => setBusy(`Gemini is out, so Claude is tailoring ${role.company}, round ${round}`),
            });
            put(role.id, st);
          } catch (e) {
            setError((e as Error).message);
            if (e instanceof AnthropicKeyError || e instanceof GeminiUnavailableError) setKeyOpen(true);
            stopRef.current = true;
          }
        }
      }
      setBusy("");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, signedIn, queue, put, anthropicKey],
  );

  // Automatic daily run: once a day, when the app opens with a resume on file.
  useEffect(() => {
    if (queue && resume && agent.lastAutoRun !== today() && !busy) runCheck(CHECK_BATCH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, resume]);

  const list = (status: RoleState["status"][]) =>
    (queue ?? [])
      .filter((r) => agent.roles[r.id] && status.includes(agent.roles[r.id].status))
      .sort((a, b) => agent.roles[b.id].score - agent.roles[a.id].score);
  const ready = list(["ready"]);
  const below = list(["below"]);
  const applied = (queue ?? []).filter((r) => agent.roles[r.id]?.status === "applied");
  const improvable = below.filter((r) => agent.roles[r.id].rounds < MAX_ROUNDS && !agent.roles[r.id].pending.length).map((r) => r.id);

  const setRole = (id: string, patch: Partial<RoleState>) => put(id, { ...agent.roles[id], ...patch });

  return (
    <section className="block ag" aria-labelledby="h-agent">
      <div className="block-head">
        <h2 id="h-agent" className="ag-title">
          <AgentMark />
          Apply agent
        </h2>
        <span className="block-sub">target {agent.target}+</span>
      </div>
      <p className="block-note">
        Every day it finds roles that fit you, checks each with the ATS match, and tailors your resume until it scores{" "}
        {agent.target}+. Then it gets everything ready, and you review and submit. It never invents experience and never
        submits for you.
      </p>

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

      <div className="ag-writer">
        {!keyOpen ? (
          <span>
            ✍️ Rewrites by <strong>Gemini</strong> (free), switching to <strong>Claude</strong> when Gemini runs out
            {anthropicKey ? ` (your Anthropic key sk-ant-…${anthropicKey.slice(-4)})` : ", once you add an Anthropic key"}.{" "}
            <button type="button" onClick={() => setKeyOpen(true)}>
              {anthropicKey ? "Change key" : "Add Anthropic key"}
            </button>
            {anthropicKey && (
              <button
                type="button"
                onClick={() => {
                  clearAnthropicKey();
                  setAnthropicKey("");
                }}
              >
                Remove
              </button>
            )}
          </span>
        ) : (
          <form
            className="ag-keyform"
            onSubmit={async (e) => {
              e.preventDefault();
              const k = keyDraft.trim();
              if (!looksLikeAnthropicKey(k)) return setKeyMsg("That doesn't look like an Anthropic key. It starts with “sk-ant-”.");
              setKeyMsg("Checking with Anthropic…");
              const issue = await checkAnthropicKey(k);
              if (issue) return setKeyMsg(issue);
              saveAnthropicKey(k, true);
              setAnthropicKey(k);
              setKeyDraft("");
              setKeyMsg("");
              setKeyOpen(false);
            }}
          >
            <span>
              Paste an Anthropic API key from{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>
              . It's billed to your account, stays in this browser, and goes only to Anthropic.
            </span>
            <input type="password" value={keyDraft} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} aria-label="Anthropic API key" onChange={(e) => setKeyDraft(e.target.value)} />
            {keyMsg && <small>{keyMsg}</small>}
            <div className="ag-row-actions">
              <button type="submit" className="ag-primary" disabled={!keyDraft.trim()}>
                Save key
              </button>
              <button type="button" className="ag-ghost" onClick={() => setKeyOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {resume === null && (
        <label className="ag-upload">
          <span>📄 Upload your resume (PDF) to start</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setResume(await uploadResume(signedIn, f));
                setError("");
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
        </label>
      )}

      <div className="ag-actions">
        <button type="button" className="ag-primary" disabled={!queue || !resume || !!busy || !todo.length} onClick={() => runCheck(CHECK_BATCH)}>
          {todo.length ? `Check next ${Math.min(CHECK_BATCH, todo.length)} roles` : "All roles checked"}
        </button>
        <button type="button" className="ag-secondary" disabled={!!busy || !improvable.length} onClick={() => runImprove(improvable.slice(0, IMPROVE_BATCH))}>
          Tailor {Math.min(IMPROVE_BATCH, improvable.length) || ""} below {agent.target}
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

      <div className="segmented ag-tabs" role="tablist" aria-label="Apply agent">
        {(
          [
            ["ready", `✅ Ready · ${ready.length}`],
            ["below", `🛠 Below ${agent.target} · ${below.length}`],
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

      {(tab === "ready" || tab === "below" || tab === "applied") && (
        <ul className="ag-list">
          {(tab === "ready" ? ready : tab === "below" ? below : applied).map((r) => {
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
                    {st.score}
                    {st.firstScore !== st.score && <small>from {st.firstScore}</small>}
                  </span>
                </button>
                {open === r.id && (
                  <RoleDetail
                    role={r}
                    st={st}
                    agent={agent}
                    profile={profile}
                    grad={grad}
                    start={start}
                    busy={!!busy}
                    onImprove={() => runImprove([r.id])}
                    onInput={async (filled, skills) => {
                      setBusy(`Re-scoring ${r.company}`);
                      try {
                        put(r.id, await applyStudentInput(signedIn, r, st, agentRef.current, filled, skills));
                      } catch (e) {
                        setError((e as Error).message);
                      }
                      setBusy("");
                    }}
                    onApplied={() => {
                      saved.markApplied(r);
                      setRole(r.id, { status: "applied" });
                    }}
                    onReadyAnyway={() => setRole(r.id, { status: "ready" })}
                    onSkip={() => setRole(r.id, { status: "skipped" })}
                  />
                )}
              </li>
            );
          })}
          {tab === "ready" && !ready.length && queue && <p className="empty">Nothing at {agent.target}+ yet. Check more roles, or tailor the ones below.</p>}
          {tab === "below" && !below.length && queue && <p className="empty">No roles below the target right now.</p>}
          {tab === "applied" && !applied.length && <p className="empty">Roles you mark applied show up here and in My jobs → Applied.</p>}
        </ul>
      )}

      <p className="block-foot">
        Checks run once a day when you open the app ({CHECK_BATCH} roles at a time), plus whenever you tap “Check”. Scores are
        Tepobaby's ATS estimate; each company's own ATS differs, so a high score improves your odds but can't guarantee an
        interview. Progress is saved on this device.
      </p>
    </section>
  );
}

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
  agent: AgentState;
  profile: Profile;
  grad: { month: number; year: number };
  start: { month: number; year: number };
  busy: boolean;
  onImprove: () => void;
  onInput: (filled: { original: string; improved: string }[], skills: string[]) => void;
  onApplied: () => void;
  onReadyAnyway: () => void;
  onSkip: () => void;
};

function RoleDetail({ role, st, agent, profile, grad, start, busy, onImprove, onInput, onApplied, onReadyAnyway, onSkip }: DetailProps) {
  const [fills, setFills] = useState<Record<string, string>>(() => Object.fromEntries(st.pending.map((p) => [p.original, p.improved])));
  const [skills, setSkills] = useState<string[]>([]);
  const a = profile.answers;
  const answers: [string, string][] = [
    ["Graduation date", `${MONTHS[grad.month - 1]} ${grad.year}`],
    ["Earliest start date", `${MONTHS[start.month - 1]} ${start.year}`],
    [
      "Are you legally authorized to work in the U.S.?",
      a.workAuthorized === "yes" ? `Yes${a.workAuthStatus && a.workAuthStatus !== "us_citizen_pr" ? ` (${labelFor("workAuthStatus", a.workAuthStatus)})` : ""}` : a.workAuthorized === "no" ? "No" : "—",
    ],
    ["Will you now or in the future require visa sponsorship?", a.needsSponsorship === "yes" ? "Yes" : a.needsSponsorship === "no" ? "No" : "—"],
  ];
  const tailored = st.sections ?? agent.base;
  const below = st.status === "below";
  const toppedOut = below && st.rounds >= MAX_ROUNDS && !st.pending.length;

  return (
    <div className="ag-detail">
      <FitChip role={role} />
      {st.status === "error" && <p className="ob-error">{st.error}</p>}

      {below && (
        <div className="ag-box">
          <h4>
            {toppedOut ? `Tops out at ${st.score} after ${st.rounds} rounds` : `Below ${agent.target}: round ${st.rounds} of ${MAX_ROUNDS}`}
          </h4>
          {toppedOut && (
            <p>
              Honest rewrites can't close the rest. What's missing is real experience:
              {st.missingSkills.length ? ` ${st.missingSkills.map((m) => m.skill).slice(0, 6).join(", ")}.` : ""} Apply anyway if
              the role excites you, or skip it.
            </p>
          )}
          {st.pending.length > 0 && (
            <>
              <p>Fill in the real numbers (replace each [ ]) to use these rewrites:</p>
              {st.pending.map((p) => (
                <label key={p.original} className="ag-fill">
                  <small>Was: {p.original}</small>
                  <textarea rows={2} value={fills[p.original] ?? p.improved} onChange={(e) => setFills({ ...fills, [p.original]: e.target.value })} />
                </label>
              ))}
            </>
          )}
          {st.missingSkills.filter((m) => !st.confirmedSkills.includes(m.skill)).length > 0 && (
            <>
              <p>Missing from your resume. Check only the ones you've really used:</p>
              <div className="ag-skills">
                {st.missingSkills
                  .filter((m) => !st.confirmedSkills.includes(m.skill))
                  .map((m) => (
                    <label key={m.skill}>
                      <input
                        type="checkbox"
                        checked={skills.includes(m.skill)}
                        onChange={(e) => setSkills(e.target.checked ? [...skills, m.skill] : skills.filter((x) => x !== m.skill))}
                      />
                      {m.skill}
                      {m.required && <em> required</em>}
                    </label>
                  ))}
              </div>
            </>
          )}
          <div className="ag-row-actions">
            {(st.pending.length > 0 || skills.length > 0) && (
              <button
                type="button"
                className="ag-primary"
                disabled={busy}
                onClick={() =>
                  onInput(
                    st.pending.map((p) => ({ original: p.original, improved: fills[p.original] ?? p.improved })),
                    skills,
                  )
                }
              >
                Apply my changes & re-score
              </button>
            )}
            {!toppedOut && st.rounds < MAX_ROUNDS && (
              <button type="button" className="ag-secondary" disabled={busy} onClick={onImprove}>
                Tailor again
              </button>
            )}
            <button type="button" className="ag-secondary" onClick={onReadyAnyway}>
              Apply anyway
            </button>
          </div>
        </div>
      )}

      {st.changes.length > 0 && (
        <div className="ag-box">
          <h4>Changes to make in your resume for this role</h4>
          <ul className="ag-changes">
            {st.changes.map((c, i) => (
              <li key={i}>
                <del>{c.original}</del>
                <ins>{c.improved}</ins>
                {c.requirement && <small>Targets: {c.requirement}</small>}
              </li>
            ))}
          </ul>
          {st.confirmedSkills.length > 0 && <p>Add to Skills: {st.confirmedSkills.join(", ")}</p>}
          {tailored && (
            <button type="button" className="ag-secondary" onClick={() => copyText(resumeText(tailored))}>
              Copy tailored resume text
            </button>
          )}
        </div>
      )}

      {(st.status === "ready" || st.status === "applied") && (
        <div className="ag-box">
          <h4>Your answers for the application form</h4>
          <dl className="ag-answers">
            {answers.map(([q, v]) => (
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
    </div>
  );
}

/** The Apply agent's mark: a glowing cyan ring with a bright core, inside a faint dashed orbit. */
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

