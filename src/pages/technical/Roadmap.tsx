import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProblemSummary } from "../../neetcode/api";
import { conceptById } from "../../neetcode/concepts";
import { useProgress } from "../../neetcode/progress";
import ConceptPlayer from "./ConceptPlayer";

// The NeetCode roadmap: 18 concepts and their prerequisites (dashed lines). Hover a concept (or tap
// it on a phone) for its skeleton code, the inputs it works on, a live line-by-line animation, and
// its runtime.

// x: % of the width, y: px from the top. Same layout as NeetCode's roadmap, narrowed for a phone.
const NODES: { id: string; x: number; y: number; small?: boolean }[] = [
  { id: "arrays", x: 50, y: 26 },
  { id: "twoPointers", x: 29, y: 100 },
  { id: "stack", x: 73, y: 100 },
  { id: "binarySearch", x: 15, y: 178 },
  { id: "slidingWindow", x: 50, y: 178 },
  { id: "linkedList", x: 85, y: 178 },
  { id: "trees", x: 40, y: 258 },
  { id: "tries", x: 13, y: 338 },
  { id: "backtracking", x: 74, y: 338 },
  { id: "heap", x: 33, y: 420 },
  { id: "graphs", x: 60, y: 420 },
  { id: "oneDP", x: 87, y: 420 },
  { id: "intervals", x: 10, y: 508, small: true },
  { id: "greedy", x: 30, y: 508, small: true },
  { id: "advGraphs", x: 50, y: 508, small: true },
  { id: "twoDP", x: 70, y: 508, small: true },
  { id: "bits", x: 90, y: 508, small: true },
  { id: "math", x: 62, y: 594 },
];

const EDGES: [string, string][] = [
  ["arrays", "twoPointers"],
  ["arrays", "stack"],
  ["twoPointers", "binarySearch"],
  ["twoPointers", "slidingWindow"],
  ["twoPointers", "linkedList"],
  ["binarySearch", "trees"],
  ["linkedList", "trees"],
  ["trees", "tries"],
  ["trees", "heap"],
  ["trees", "backtracking"],
  ["backtracking", "graphs"],
  ["backtracking", "oneDP"],
  ["heap", "intervals"],
  ["heap", "greedy"],
  ["heap", "advGraphs"],
  ["graphs", "advGraphs"],
  ["graphs", "twoDP"],
  ["graphs", "math"],
  ["oneDP", "twoDP"],
  ["oneDP", "bits"],
  ["bits", "math"],
];

const HEIGHT = 624;
const NODE_H = 36;

type Props = { problems: ProblemSummary[] };

export default function Roadmap({ problems }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(357);
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef(0);
  const progress = useProgress([]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, { total: number; solved: number }>();
    for (const p of problems) {
      const c = m.get(p.category) || { total: 0, solved: 0 };
      c.total++;
      if (progress.solved.includes(p.slug)) c.solved++;
      m.set(p.category, c);
    }
    return m;
  }, [problems, progress.solved]);

  const pos = useMemo(() => new Map(NODES.map((n) => [n.id, { x: (n.x / 100) * w, y: n.y }])), [w]);
  const hoverable = typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;

  const show = (id: string) => {
    window.clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const hideSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 350);
  };

  const frame = document.querySelector(".phone-frame") || document.body;
  const info = open ? conceptById.get(open) : null;
  const c = open ? counts.get(open) : null;

  return (
    <section className="block nc-roadmap-block">
      <div className="block-head">
        <h2>Roadmap</h2>
        <span className="block-tag">18 concepts</span>
      </div>
      <p className="block-note">
        {hoverable ? "Hover" : "Tap"} a concept to see its skeleton code, the inputs it works on, a live walkthrough, and its runtime. Lines show
        what to learn first.
      </p>

      <div className="nc-map" ref={box} style={{ height: HEIGHT }}>
        <svg className="nc-map-edges" width={w} height={HEIGHT} aria-hidden="true">
          {EDGES.map(([a, b]) => {
            const p = pos.get(a)!;
            const q = pos.get(b)!;
            const y1 = p.y + NODE_H / 2;
            const y2 = q.y - NODE_H / 2;
            const mid = (y1 + y2) / 2;
            const lit = open === a || open === b;
            return <path key={`${a}-${b}`} d={`M${p.x},${y1} C${p.x},${mid} ${q.x},${mid} ${q.x},${y2}`} className={lit ? "is-lit" : ""} />;
          })}
        </svg>
        {NODES.map((n) => {
          const p = pos.get(n.id)!;
          const ct = counts.get(n.id);
          const pct = ct ? (ct.solved / ct.total) * 100 : 0;
          return (
            <button
              key={n.id}
              type="button"
              className={`nc-node${n.small ? " is-small" : ""}${open === n.id ? " is-open" : ""}`}
              style={{ left: p.x, top: p.y }}
              onMouseEnter={hoverable ? () => show(n.id) : undefined}
              onMouseLeave={hoverable ? hideSoon : undefined}
              onFocus={() => show(n.id)}
              onClick={() => (open === n.id && !hoverable ? setOpen(null) : show(n.id))}
              aria-expanded={open === n.id}
            >
              <span className="nc-node-label">{conceptById.get(n.id)?.label}</span>
              <span className="nc-node-bar" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      {open &&
        info &&
        createPortal(
          <div className="nc-pop" role="dialog" aria-label={info.label} onMouseEnter={() => window.clearTimeout(closeTimer.current)} onMouseLeave={hoverable ? hideSoon : undefined}>
            <div className="nc-pop-head">
              <div>
                <h3>{info.label}</h3>
                <div className="nc-badges">
                  <span className="nc-badge">
                    <small>time</small>
                    {info.time}
                  </span>
                  <span className="nc-badge">
                    <small>space</small>
                    {info.space}
                  </span>
                  {c && (
                    <span className="nc-muted nc-small">
                      {c.solved}/{c.total} solved
                    </span>
                  )}
                </div>
              </div>
              <button type="button" className="gs-icon-btn" onClick={() => setOpen(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="nc-pop-body">
              <h4>Works on</h4>
              <div className="nc-chips">
                {info.inputs.map((x) => (
                  <span key={x} className="nc-chip">
                    {x}
                  </span>
                ))}
              </div>

              <h4>What it does</h4>
              <p className="nc-pop-text">{info.what}</p>

              <h4>Live walkthrough</h4>
              <ConceptPlayer id={info.id} />

              <h4>Runtime</h4>
              <div className="nc-runtime">
                <span>
                  <small>Time</small>
                  <b>{info.time}</b>
                </span>
                <span>
                  <small>Space</small>
                  <b>{info.space}</b>
                </span>
              </div>
              <p className="nc-small nc-muted">{info.runtimeNote}</p>
            </div>
          </div>,
          frame,
        )}
    </section>
  );
}
