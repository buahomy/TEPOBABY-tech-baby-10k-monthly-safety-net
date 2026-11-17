import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SierraProblem } from "../../../shared/sierra/problems.js";
import { loadSierraDraft, saveSierraDraft } from "../../sierra/progress";
import { SierraOutcome, TestResult, runSierraTests } from "../../sierra/runner";
import Markdown from "../../sierra/Markdown";
import CodeEditor from "./CodeEditor";

// The Sierra OA coding screen. Same layout as the NeetCode IDE (question | editor + tests; three tabs
// on a phone), but in TypeScript, with parts that unlock one at a time like the real assessment. Each
// run re-tests every part up to the one shown, so a rewrite that breaks an earlier part is caught.

type Props = {
  problem: SierraProblem;
  draftKey: string;
  passed: number; // parts passed so far
  onPassed: (count: number) => void;
  onClose: () => void;
  mock?: { endsAt: number; label: string };
};
type Pane = "question" | "code" | "console";

export function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function SierraWorkspace({ problem, draftKey, passed, onPassed, onClose, mock }: Props) {
  const total = problem.parts.length;
  const [code, setCode] = useState(() => loadSierraDraft(draftKey) ?? problem.starter);
  const [view, setView] = useState(() => Math.min(passed, total - 1));
  const [pane, setPane] = useState<Pane>("code");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<SierraOutcome | null>(null);
  const [live, setLive] = useState<TestResult[]>([]);
  const [note, setNote] = useState("");
  const [hint, setHint] = useState(false);
  const [refStep, setRefStep] = useState<0 | 1 | 2>(0);
  const [resetAsk, setResetAsk] = useState(false);
  const [now, setNow] = useState(Date.now());
  const saveTimer = useRef(0);
  const unlocked = Math.min(passed + 1, total);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    if (!mock) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [mock]);

  const onCode = (c: string) => {
    setCode(c);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveSierraDraft(draftKey, c === problem.starter ? null : c), 400);
  };

  const reset = () => {
    setCode(problem.starter);
    saveSierraDraft(draftKey, null);
    setResetAsk(false);
  };

  async function run() {
    if (busy) return;
    setBusy(true);
    setPane("console");
    setOutcome(null);
    setLive([]);
    setNote("");
    const result = await runSierraTests(problem.id, code, view, setLive);
    setOutcome(result);
    setBusy(false);
    if (result.kind !== "done") return;
    let count = 0;
    for (let p = 0; p <= view; p++) {
      const tests = result.results.filter((r) => r.part === p);
      if (tests.length && tests.every((r) => r.passed)) count = p + 1;
      else break;
    }
    if (count > passed) onPassed(count);
    if (count === view + 1) {
      if (view + 1 < total) {
        setNote(`Part ${view + 1} passes. Part ${view + 2} is unlocked: extend your code, don't rewrite it.`);
        setView(view + 1);
        setHint(false);
      } else setNote(`All ${total} parts pass. Now explain it out loud in 90 seconds, like the video reflection.`);
    }
  }

  const left = mock ? mock.endsAt - now : 0;
  const shown = outcome && outcome.kind !== "compile" ? outcome.results : live;

  return createPortal(
    <div className="m01 nc-ide so-ide" role="dialog" aria-modal="true" aria-label={problem.title}>
      <header className="nc-ide-top">
        <button type="button" className="nc-btn nc-btn--icon" onClick={onClose} aria-label="Back">
          ←
        </button>
        <div className="nc-ide-title">
          <strong>{problem.title}</strong>
          <span className={`so-kind so-kind--${problem.kind}`}>{problem.kind === "easy" ? "Easy question" : "TS project"}</span>
        </div>
        <div className="nc-ide-actions">
          {mock && (
            <span className={`so-clock${left < 5 * 60000 ? " is-low" : ""}`} aria-label="Time left">
              {mock.label} · {clock(left)}
            </span>
          )}
          <button type="button" className={`nc-btn nc-btn--ghost${hint ? " is-on" : ""}`} onClick={() => setHint((h) => !h)}>
            💡 Hint
          </button>
          <button type="button" className="nc-btn nc-btn--submit" disabled={busy} onClick={run}>
            {busy ? "Testing…" : `▶ Test part ${view + 1}`}
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
          <div className="so-parts" role="tablist" aria-label="Parts">
            {problem.parts.map((part, i) => {
              const done = i < passed;
              const open = i < unlocked;
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={view === i}
                  disabled={!open}
                  className={`so-part${view === i ? " is-active" : ""}${done ? " is-done" : ""}`}
                  onClick={() => {
                    setView(i);
                    setHint(false);
                  }}
                >
                  {done ? "✓ " : open ? "" : "🔒 "}Part {i + 1}
                </button>
              );
            })}
          </div>
          <div className="so-q">
            <Markdown text={problem.intro} />
            <h3>
              Part {view + 1}: {problem.parts[view].title}
            </h3>
            <Markdown text={problem.parts[view].prompt} />
            {hint && (
              <div className="so-hint">
                <strong>Hint</strong>
                <Markdown text={problem.parts[view].hint} />
              </div>
            )}
            {view + 1 < total && view >= passed && <p className="so-locked">Part {view + 2} unlocks when every test through part {view + 1} passes.</p>}
            <p className="so-source">Reported: {problem.reported}</p>

            {!mock && (
              <div className="so-ref">
                {refStep === 0 && (
                  <button type="button" className="nc-link-btn" onClick={() => setRefStep(1)}>
                    Show a reference solution
                  </button>
                )}
                {refStep === 1 && (
                  <div className="so-ref-ask">
                    <p>Try every part yourself first. In the real OA there's no answer key, and reading one now makes the practice count for less.</p>
                    <div className="nc-row">
                      <button type="button" className="nc-btn nc-btn--run" onClick={() => setRefStep(2)}>
                        Show it anyway
                      </button>
                      <button type="button" className="nc-btn nc-btn--run" onClick={() => setRefStep(0)}>
                        Keep trying
                      </button>
                    </div>
                  </div>
                )}
                {refStep === 2 && (
                  <>
                    <p className="nc-muted nc-small">One way to solve every part. Read it, close it, then write your own from memory.</p>
                    <pre className="so-ref-code">{problem.reference}</pre>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <section className={`nc-pane nc-pane--work${pane !== "question" ? " is-shown" : ""}${pane === "console" ? " show-console" : ""}`}>
          <div className="nc-editor-wrap">
            <div className="nc-editor-bar">
              <span>TypeScript</span>
              <span className="nc-muted nc-kbd">⌘/Ctrl + Enter tests</span>
              {resetAsk ? (
                <span className="so-reset-ask">
                  Clear your code?{" "}
                  <button type="button" className="nc-link-btn" onClick={reset}>
                    Reset
                  </button>{" "}
                  <button type="button" className="nc-link-btn" onClick={() => setResetAsk(false)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" className="nc-link-btn" onClick={() => setResetAsk(true)}>
                  Reset
                </button>
              )}
            </div>
            <CodeEditor value={code} lang="typescript" onChange={onCode} onRun={run} />
          </div>

          <div className="nc-console">
            <div className="nc-console-tabs">
              <button type="button" className="is-active">
                Tests
              </button>
            </div>
            <div className="nc-console-body so-results" aria-live="polite">
              {note && <p className="nc-good-note">{note}</p>}
              {!outcome && !busy && !live.length && (
                <p className="nc-muted">Press Test to run every test through part {view + 1}. Your code runs in this browser.</p>
              )}
              {outcome?.kind === "compile" && (
                <div className="nc-verdict">
                  <h3 className="nc-bad">Compile error</h3>
                  <pre className="nc-error">{outcome.error}</pre>
                </div>
              )}
              {outcome?.kind === "timeout" && (
                <p className="nc-bad">Stopped: a test ran for more than 9 seconds without finishing. Look for an infinite loop or a call you never await.</p>
              )}
              {shown.length > 0 && <ResultList results={shown} upTo={view} />}
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function ResultList({ results, upTo }: { results: TestResult[]; upTo: number }) {
  const parts = Array.from({ length: upTo + 1 }, (_, i) => i);
  return (
    <div className="so-result-groups">
      {parts.map((p) => {
        const rs = results.filter((r) => r.part === p);
        if (!rs.length) return null;
        const good = rs.filter((r) => r.passed).length;
        return (
          <div key={p} className="so-result-group">
            <h4>
              Part {p + 1}{" "}
              <span className={good === rs.length ? "nc-good" : "nc-bad"}>
                {good}/{rs.length} passed
              </span>
            </h4>
            <ul>
              {rs.map((r, i) => (
                <li key={i} className={r.passed ? "is-pass" : "is-fail"}>
                  <span aria-hidden="true">{r.passed ? "✓" : "✗"}</span>
                  <div>
                    <span>{r.name}</span>
                    {!r.passed && r.error && <pre className="nc-error">{r.error}</pre>}
                    {r.stdout && <pre className="so-stdout">{r.stdout}</pre>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
