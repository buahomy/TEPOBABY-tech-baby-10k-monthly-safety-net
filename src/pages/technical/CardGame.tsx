import { useMemo, useState } from "react";
import { Concept, ProblemSummary } from "../../neetcode/api";
import { markFlipped, reshuffle, useProgress } from "../../neetcode/progress";
import QuestionSheet from "./QuestionSheet";

// 150 face-down cards numbered 1–150, each hiding a random NeetCode 150 problem. Flip one to start:
// read the question, guess the concepts, then code it.

type Props = { problems: ProblemSummary[]; concepts: Concept[] };

export default function CardGame({ problems, concepts }: Props) {
  const slugs = useMemo(() => problems.map((p) => p.slug), [problems]);
  const progress = useProgress(slugs);
  const bySlug = useMemo(() => new Map(problems.map((p) => [p.slug, p])), [problems]);
  const [flipping, setFlipping] = useState<string | null>(null);
  const [open, setOpen] = useState<{ slug: string; card: number } | null>(null);

  const flip = (slug: string, card: number) => {
    if (flipping) return;
    if (progress.flipped.includes(slug)) return setOpen({ slug, card });
    setFlipping(slug);
    markFlipped(slug);
    window.setTimeout(() => {
      setFlipping(null);
      setOpen({ slug, card });
    }, 700);
  };

  const random = () => {
    const unflipped = progress.order.map((s, i) => [s, i + 1] as const).filter(([s]) => !progress.flipped.includes(s));
    const pool = unflipped.length ? unflipped : progress.order.map((s, i) => [s, i + 1] as const);
    const [slug, card] = pool[Math.floor(Math.random() * pool.length)];
    document.getElementById(`nc-card-${card}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => flip(slug, card), 350);
  };

  const solved = progress.solved.filter((s) => bySlug.has(s)).length;

  return (
    <>
      <section className="block">
        <div className="block-head">
          <h2>Card Game</h2>
          <span className="block-tag">NeetCode 150</span>
        </div>
        <p className="block-note">
          Each card hides a random NeetCode 150 question. Flip one, guess which concepts solve it, then code it with tests like
          NeetCode.
        </p>
        <div className="nc-stats">
          <div>
            <strong>{solved}</strong>
            <span>solved</span>
          </div>
          <div>
            <strong>{progress.flipped.length}</strong>
            <span>flipped</span>
          </div>
          <div>
            <strong>{Object.values(progress.guessed).filter(Boolean).length}</strong>
            <span>concepts nailed</span>
          </div>
        </div>
        <div className="nc-progress" aria-label={`${solved} of 150 solved`}>
          <i style={{ width: `${(solved / 150) * 100}%` }} />
        </div>
        <div className="nc-row">
          <button type="button" className="nc-primary" onClick={random}>
            🎲 Flip a random card
          </button>
          <button
            type="button"
            className="nc-secondary"
            onClick={reshuffle}
            title="Shuffle the problems behind the cards you haven't flipped yet"
          >
            Shuffle
          </button>
        </div>
      </section>

      <div className="nc-grid" role="list" aria-label="Question cards">
        {progress.order.map((slug, i) => {
          const p = bySlug.get(slug);
          if (!p) return null;
          const card = i + 1;
          const flipped = progress.flipped.includes(slug) || flipping === slug;
          const done = progress.solved.includes(slug);
          return (
            <button
              key={slug}
              id={`nc-card-${card}`}
              type="button"
              role="listitem"
              className={`nc-card${flipped ? " is-flipped" : ""}${done ? " is-solved" : ""}${flipping === slug ? " is-flipping" : ""}`}
              onClick={() => flip(slug, card)}
              aria-label={flipped ? `Card ${card}: ${p.title}, ${p.difficulty}${done ? ", solved" : ""}` : `Card ${card}, face down`}
            >
              <span className="nc-card-inner">
                <span className="nc-face nc-face--front">
                  <span className="nc-card-num">{card}</span>
                </span>
                <span className={`nc-face nc-face--back nc-face--${p.difficulty.toLowerCase()}`}>
                  <span className="nc-card-small">#{card}</span>
                  <span className="nc-card-title">{p.title}</span>
                  {done && <span className="nc-card-check">✓</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {open && <QuestionSheet slug={open.slug} card={open.card} concepts={concepts} onClose={() => setOpen(null)} />}
    </>
  );
}
