import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Concept, Problem, getProblem } from "../../neetcode/api";
import { markGuess, useProgress } from "../../neetcode/progress";
import CodeIDE from "./CodeIDE";

// The pop-up after a card flips: the question, then "which concepts apply?". Answering reveals the
// approaches that work (and why); "Let's code" opens the coding screen.

type Props = { slug: string; card: number; concepts: Concept[]; onClose: () => void };

export default function QuestionSheet({ slug, card, concepts, onClose }: Props) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [coding, setCoding] = useState(false);
  const progress = useProgress([]);
  const solved = progress.solved.includes(slug);

  useEffect(() => {
    getProblem(slug)
      .then(setProblem)
      .catch((e) => setError(e.message));
  }, [slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !coding && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, coding]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const correct = problem?.concepts || [];
  const wrongPicks = picked.filter((c) => !correct.includes(c));
  const nailed = !!problem && picked.includes(correct[0]) && wrongPicks.length === 0;

  const answer = () => {
    setRevealed(true);
    markGuess(slug, nailed);
  };

  const frame = document.querySelector(".phone-frame") || document.body;
  return (
    <>
      {createPortal(
        <div className="gs-backdrop nc-backdrop" onClick={onClose}>
          <div className="gs nc-sheet" role="dialog" aria-modal="true" aria-label="Question" onClick={(e) => e.stopPropagation()}>
            <div className="nc-sheet-head">
              <span className="nc-card-badge">Card {card}</span>
              {solved && <span className="nc-solved-badge">✓ Solved</span>}
              <button type="button" className="gs-icon-btn nc-close" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="gs-body nc-sheet-body">
              {error && <p className="ob-error">{error}</p>}
              {!problem && !error && <div className="nc-skeleton" aria-label="Loading question" />}
              {problem && (
                <>
                  <div>
                    <h2 className="nc-q-title">{problem.title}</h2>
                    <div className="nc-q-sub">
                      <span className={`nc-diff nc-diff--${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
                      <span className="nc-muted">NeetCode #{problem.n}</span>
                    </div>
                  </div>
                  <div className="nc-statement nc-statement--sheet" dangerouslySetInnerHTML={{ __html: problem.content }} />

                  <div className="nc-quiz">
                    <h3>Which concepts can solve this?</h3>
                    <p className="nc-muted nc-small">Pick every approach that applies, then check your answer.</p>
                    <div className="nc-concept-grid">
                      {concepts.map((c) => {
                        const isPicked = picked.includes(c.id);
                        const isRight = correct.includes(c.id);
                        let cls = isPicked ? " is-picked" : "";
                        if (revealed) cls = isPicked && isRight ? " is-right" : isPicked ? " is-wrong" : isRight ? " is-missed" : " is-off";
                        return (
                          <button key={c.id} type="button" className={`nc-concept${cls}`} aria-pressed={isPicked} disabled={revealed} onClick={() => toggle(c.id)}>
                            {revealed && isRight && <span aria-hidden="true">✓ </span>}
                            {revealed && isPicked && !isRight && <span aria-hidden="true">✗ </span>}
                            {c.label}
                          </button>
                        );
                      })}
                    </div>

                    {!revealed ? (
                      <button type="button" className="nc-primary" disabled={!picked.length} onClick={answer}>
                        Answer
                      </button>
                    ) : (
                      <div className={`nc-reveal${nailed ? " is-good" : ""}`}>
                        <strong>{nailed ? "Nailed it!" : picked.some((p) => correct.includes(p)) ? "Close!" : "Not quite."}</strong>
                        <p>
                          Correct approach{correct.length > 1 ? "es" : ""}:{" "}
                          {correct.map((c, i) => (
                            <span key={c}>
                              {i > 0 && ", "}
                              <b>{concepts.find((x) => x.id === c)?.label}</b>
                              {i === 0 && correct.length > 1 ? " (main)" : ""}
                            </span>
                          ))}
                          .
                        </p>
                        <p>{problem.why}</p>
                        <button type="button" className="nc-primary" onClick={() => setCoding(true)}>
                          Let's code →
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        frame,
      )}
      {coding && problem && <CodeIDE problem={problem} onClose={() => setCoding(false)} />}
    </>
  );
}
