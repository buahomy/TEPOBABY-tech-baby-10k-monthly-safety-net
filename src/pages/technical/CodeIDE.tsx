import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Problem, TestCase, getExpected } from "../../neetcode/api";
import { conceptById } from "../../neetcode/concepts";
import { loadDraft, markSolved, saveDraft, useLang } from "../../neetcode/progress";
import { CaseResult, Lang, RunOutcome, runTests, show, warmPython } from "../../neetcode/runner";
import CodeEditor from "./CodeEditor";

// The coding screen, laid out like NeetCode / LeetCode: the question on the left, the editor on the
// right, and test cases + results underneath. On a phone the three panes become tabs.
// Code runs in this browser (see neetcode/runner.ts); Submit adds the hidden tests.

type Props = { problem: Problem; onClose: () => void };
type Pane = "question" | "code" | "console";
type EditCase = { lines: string[]; expected: unknown; custom: boolean };
type Verdict =
  | { mode: "run" | "submit"; outcome: RunOutcome; total: number }
  | null;

const LANGS: { id: Lang; label: string }[] = [
  { id: "python3", label: "Python3" },
  { id: "javascript", label: "JavaScript" },
];

function paramNames(p: Problem) {
  if (p.meta.classname) return ["operations", "arguments"];
  return p.meta.params.map((x) => x.name);
}

const splitInput = (input: string) => input.split("\n").filter((l) => l.trim() !== "");

export default function CodeIDE({ problem, onClose }: Props) {
  const [lang, setLang] = useLang();
  const starter = problem.snippets[lang] || "";
  const [code, setCode] = useState(() => loadDraft(problem.slug, lang) ?? starter);
  const [pane, setPane] = useState<Pane>("code");
  const [consoleTab, setConsoleTab] = useState<"cases" | "result">("cases");
  const [cases, setCases] = useState<EditCase[]>(() => problem.examples.map((c) => ({ lines: splitInput(c.input), expected: c.expected, custom: false })));
  const [activeCase, setActiveCase] = useState(0);
  const [resultCase, setResultCase] = useState(0);
  const [busy, setBusy] = useState<null | "run" | "submit">(null);
  const [status, setStatus] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintConcept, setHintConcept] = useState(problem.concepts[0]);
  const [pyState, setPyState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const names = paramNames(problem);
  const saveTimer = useRef(0);

  // Switching language loads that language's draft (or LeetCode's starter code).
  const firstLang = useRef(true);
  useEffect(() => {
    if (firstLang.current) {
      firstLang.current = false;
      return;
    }
    setCode(loadDraft(problem.slug, lang) ?? (problem.snippets[lang] || ""));
  }, [lang, problem]);

  // Python takes a few seconds to load the first time, so start as soon as it's picked.
  useEffect(() => {
    if (lang !== "python3") return;
    setPyState((s) => (s === "ready" ? s : "loading"));
    warmPython()
      .then(() => setPyState("ready"))
      .catch(() => setPyState("error"));
  }, [lang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !hintOpen && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, hintOpen]);

  const onCode = (c: string) => {
    setCode(c);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveDraft(problem.slug, lang, c === starter ? null : c), 400);
  };

  const resetCode = () => {
    if (!window.confirm("Reset to the starter code? Your code for this problem will be cleared.")) return;
    setCode(starter);
    saveDraft(problem.slug, lang, null);
  };

  async function toTests(list: EditCase[]): Promise<TestCase[]> {
    return Promise.all(
      list.map(async (c) => {
        const input = c.lines.join("\n");
        if (!c.custom) return { input, expected: c.expected };
        return { input, expected: await getExpected(problem.slug, input) };
      }),
    );
  }

  async function execute(mode: "run" | "submit") {
    if (busy) return;
    setBusy(mode);
    setPane("console");
    setConsoleTab("result");
    setVerdict(null);
    setResultCase(0);
    try {
      let tests: TestCase[];
      if (mode === "run") {
        setStatus("Checking your test cases…");
        tests = await toTests(cases);
      } else tests = [...problem.examples, ...problem.hidden];
      setStatus(lang === "python3" && pyState !== "ready" ? "Loading Python (first time only)…" : mode === "run" ? "Running…" : "Submitting…");
      const outcome = await runTests(lang, code, problem, tests);
      setVerdict({ mode, outcome, total: tests.length });
      if (lang === "python3") setPyState("ready");
      if (mode === "submit" && outcome.kind === "done" && outcome.results.every((r) => r.passed)) markSolved(problem.slug);
      if (outcome.kind !== "compile") {
        const firstBad = outcome.results.findIndex((r) => !r.passed);
        setResultCase(firstBad >= 0 ? firstBad : 0);
      }
    } catch (err) {
      setVerdict({ mode, outcome: { kind: "compile", error: (err as Error).message }, total: 0 });
    } finally {
      setBusy(null);
      setStatus("");
    }
  }

  const updateLine = (ci: number, li: number, v: string) =>
    setCases((cs) => cs.map((c, i) => (i === ci ? { ...c, lines: c.lines.map((l, j) => (j === li ? v : l)), custom: true, expected: undefined } : c)));
  const addCase = () => {
    setCases((cs) => [...cs, { lines: [...(cs[activeCase] || cs[0]).lines], expected: undefined, custom: true }]);
    setActiveCase(cases.length);
  };
  const removeCase = (ci: number) => {
    setCases((cs) => cs.filter((_, i) => i !== ci));
    setActiveCase(0);
  };

  const hint = conceptById.get(hintConcept);
  const diff = problem.difficulty.toLowerCase();

  return createPortal(
    <div className="m01 nc-ide" role="dialog" aria-modal="true" aria-label={`Code ${problem.title}`}>
      <header className="nc-ide-top">
        <button type="button" className="nc-btn nc-btn--icon" onClick={onClose} aria-label="Back to the card">
          ←
        </button>
        <div className="nc-ide-title">
          <strong>
            {problem.n}. {problem.title}
          </strong>
          <span className={`nc-diff nc-diff--${diff}`}>{problem.difficulty}</span>
        </div>
        <div className="nc-ide-actions">
          <select className="nc-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button type="button" className={`nc-btn nc-btn--ghost${hintOpen ? " is-on" : ""}`} onClick={() => setHintOpen((h) => !h)}>
            💡 Hint: template
          </button>
          <button type="button" className="nc-btn nc-btn--run" disabled={!!busy} onClick={() => execute("run")}>
            {busy === "run" ? "Running…" : "▶ Run"}
          </button>
          <button type="button" className="nc-btn nc-btn--submit" disabled={!!busy} onClick={() => execute("submit")}>
            {busy === "submit" ? "Judging…" : "Submit"}
          </button>
        </div>
      </header>

      <nav className="nc-ide-tabs" aria-label="Panes">
        {(["question", "code", "console"] as Pane[]).map((p) => (
          <button key={p} type="button" className={pane === p ? "is-active" : ""} onClick={() => setPane(p)}>
            {p === "question" ? "Question" : p === "code" ? "Code" : "Tests"}
          </button>
        ))}
      </nav>

      <div className="nc-ide-main">
        <section className={`nc-pane nc-pane--question${pane === "question" ? " is-shown" : ""}`}>
          <div className="nc-q-meta">
            {problem.concepts.map((c) => (
              <span key={c} className="nc-chip nc-chip--concept">
                {conceptById.get(c)?.label}
              </span>
            ))}
            <a className="nc-link" href={problem.leetcodeUrl} target="_blank" rel="noreferrer">
              LeetCode ↗
            </a>
          </div>
          {problem.premium && <p className="nc-premium">LeetCode Premium problem: this statement is Tepobaby's own write-up.</p>}
          <div className="nc-statement" dangerouslySetInnerHTML={{ __html: problem.content }} />
        </section>

        <section className={`nc-pane nc-pane--work${pane !== "question" ? " is-shown" : ""}${pane === "console" ? " show-console" : ""}`}>
          <div className="nc-editor-wrap">
            <div className="nc-editor-bar">
              <span>{lang === "python3" ? "Python 3" : "JavaScript"}</span>
              {lang === "python3" && pyState === "loading" && <span className="nc-muted">Loading Python…</span>}
              {lang === "python3" && pyState === "error" && <span className="nc-bad">Python didn't load (check your connection)</span>}
              <span className="nc-muted nc-kbd">⌘/Ctrl + Enter runs</span>
              <button type="button" className="nc-link-btn" onClick={resetCode}>
                Reset
              </button>
            </div>
            <CodeEditor value={code} lang={lang} onChange={onCode} onRun={() => execute("run")} />

            {hintOpen && hint && (
              <aside className="nc-hint" aria-label="Template hint">
                <div className="nc-hint-head">
                  <strong>Template</strong>
                  <button type="button" className="nc-btn nc-btn--icon" onClick={() => setHintOpen(false)} aria-label="Close hint">
                    ✕
                  </button>
                </div>
                {problem.concepts.length > 1 && (
                  <div className="nc-hint-tabs">
                    {problem.concepts.map((c) => (
                      <button key={c} type="button" className={c === hintConcept ? "is-active" : ""} onClick={() => setHintConcept(c)}>
                        {conceptById.get(c)?.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className="nc-hint-note">
                  The general {hint.label} skeleton, not this problem's solution. Adapt the pattern yourself; it isn't pasted into your
                  code.
                </p>
                <pre className="nc-hint-code">{lang === "python3" ? hint.python : hint.javascript}</pre>
                <p className="nc-hint-note">
                  {hint.time} time · {hint.space} space. {hint.runtimeNote}
                </p>
              </aside>
            )}
          </div>

          <div className="nc-console">
            <div className="nc-console-tabs">
              <button type="button" className={consoleTab === "cases" ? "is-active" : ""} onClick={() => setConsoleTab("cases")}>
                Testcase
              </button>
              <button type="button" className={consoleTab === "result" ? "is-active" : ""} onClick={() => setConsoleTab("result")}>
                Test Result
              </button>
            </div>

            {consoleTab === "cases" ? (
              <div className="nc-console-body">
                <div className="nc-case-chips">
                  {cases.map((c, i) => (
                    <span key={i} className={`nc-case-chip${i === activeCase ? " is-active" : ""}`}>
                      <button type="button" onClick={() => setActiveCase(i)}>
                        Case {i + 1}
                        {c.custom ? "*" : ""}
                      </button>
                      {cases.length > 1 && i === activeCase && (
                        <button type="button" className="nc-x" onClick={() => removeCase(i)} aria-label={`Remove case ${i + 1}`}>
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {cases.length < 8 && (
                    <button type="button" className="nc-case-add" onClick={addCase} aria-label="Add a test case">
                      +
                    </button>
                  )}
                </div>
                {cases[activeCase] &&
                  names.map((n, li) => (
                    <label key={n} className="nc-field">
                      <span>{n} =</span>
                      <textarea rows={1} spellCheck={false} value={cases[activeCase].lines[li] ?? ""} onChange={(e) => updateLine(activeCase, li, e.target.value)} />
                    </label>
                  ))}
                <p className="nc-muted nc-small">Edit a case or add your own (* = custom). The expected answer comes from Tepobaby's reference solution.</p>
              </div>
            ) : (
              <div className="nc-console-body">
                {busy && <p className="nc-muted">{status || "Running…"}</p>}
                {!busy && !verdict && <p className="nc-muted">Run your code to see results here.</p>}
                {!busy && verdict && <VerdictView verdict={verdict} names={names} active={resultCase} onPick={setResultCase} />}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function CaseDetail({ r, names }: { r: CaseResult; names: string[] }) {
  const lines = splitInput(r.input);
  return (
    <div className="nc-detail">
      <div className="nc-io">
        <span>Input</span>
        {names.map((n, i) => (
          <code key={n}>
            {n} = {lines[i]}
          </code>
        ))}
      </div>
      {r.stdout && (
        <div className="nc-io">
          <span>Stdout</span>
          <pre>{r.stdout}</pre>
        </div>
      )}
      {r.ok ? (
        <div className="nc-io">
          <span>Output</span>
          <code className={r.passed ? "" : "is-bad"}>{show(r.out)}</code>
        </div>
      ) : (
        <div className="nc-io">
          <span>Error</span>
          <pre className="is-bad">{r.error}</pre>
        </div>
      )}
      <div className="nc-io">
        <span>Expected</span>
        <code>{show(r.expected)}</code>
      </div>
    </div>
  );
}

function VerdictView({ verdict, names, active, onPick }: { verdict: NonNullable<Verdict>; names: string[]; active: number; onPick: (i: number) => void }) {
  const { outcome, mode, total } = verdict;
  if (outcome.kind === "compile") {
    return (
      <div className="nc-verdict">
        <h3 className="nc-bad">{/^(SyntaxError|IndentationError|TabError)/.test(outcome.error) ? "Compile Error" : "Error"}</h3>
        <pre className="nc-error">{outcome.error}</pre>
      </div>
    );
  }
  const results = outcome.results;
  const passed = results.filter((r) => r.passed).length;
  const ms = Math.round(results.reduce((s, r) => s + r.ms, 0));

  if (mode === "submit") {
    const firstBad = results.find((r) => !r.passed);
    let title = "Accepted";
    if (outcome.kind === "tle") title = "Time Limit Exceeded";
    else if (firstBad && !firstBad.ok) title = "Runtime Error";
    else if (firstBad) title = "Wrong Answer";
    const ok = title === "Accepted";
    return (
      <div className="nc-verdict">
        <h3 className={ok ? "nc-good" : "nc-bad"}>{title}</h3>
        <p className="nc-muted">
          {passed}/{total} testcases passed{ok ? ` · Runtime ${ms} ms` : ""}
        </p>
        {ok && <p className="nc-good-note">🎉 Solved! This card is marked complete.</p>}
        {outcome.kind === "tle" && <p className="nc-muted">Case {outcome.index + 1} ran past the time limit. Look for a faster approach (or an infinite loop).</p>}
        {firstBad && outcome.kind !== "tle" && <CaseDetail r={firstBad} names={names} />}
      </div>
    );
  }

  const allOk = outcome.kind === "done" && passed === results.length;
  const r = results[active];
  return (
    <div className="nc-verdict">
      <h3 className={allOk ? "nc-good" : "nc-bad"}>
        {outcome.kind === "tle" ? "Time Limit Exceeded" : allOk ? "Accepted" : results.some((x) => !x.ok) ? "Runtime Error" : "Wrong Answer"}
        <span className="nc-muted nc-small"> · Runtime {ms} ms</span>
      </h3>
      <div className="nc-case-chips">
        {results.map((x, i) => (
          <button key={i} type="button" className={`nc-case-chip${i === active ? " is-active" : ""}`} onClick={() => onPick(i)}>
            <span className={x.passed ? "nc-good" : "nc-bad"}>{x.passed ? "✓" : "✗"}</span> Case {i + 1}
          </button>
        ))}
      </div>
      {outcome.kind === "tle" && <p className="nc-muted">Case {outcome.index + 1} ran past the time limit.</p>}
      {r && <CaseDetail r={r} names={names} />}
    </div>
  );
}

