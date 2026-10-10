import { useEffect, useRef, useState } from "react";
import { conceptById } from "../../neetcode/concepts";
import { Panel, traceFor } from "../../neetcode/viz";

// Plays a concept's trace: the data (arrays, pointers, trees, graphs…) moves step by step while the
// matching line of the skeleton code lights up.

export default function ConceptPlayer({ id }: { id: string }) {
  const info = conceptById.get(id)!;
  const steps = traceFor(id);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [speed, setSpeed] = useState(1);
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setI(0);
  }, [id]);

  useEffect(() => {
    if (!playing) return;
    const atEnd = i >= steps.length - 1;
    const t = window.setTimeout(() => setI(atEnd ? 0 : i + 1), (atEnd ? 2600 : 1150) / speed);
    return () => window.clearTimeout(t);
  }, [playing, i, speed, steps.length]);

  const step = steps[Math.min(i, steps.length - 1)];

  // Keep the running line visible inside the code box.
  useEffect(() => {
    const el = codeRef.current?.querySelector(".is-line");
    if (el && codeRef.current) {
      const box = codeRef.current;
      const top = (el as HTMLElement).offsetTop;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 24) box.scrollTop = top - box.clientHeight / 2;
    }
  }, [step?.line]);

  if (!step) return null;
  return (
    <div className="cp">
      <div className="cp-stage" aria-live="polite">
        {step.panels.map((p, k) => (
          <PanelView key={k} p={p} />
        ))}
      </div>
      <p className="cp-note">{step.note}</p>

      <div className="cp-controls">
        <button type="button" onClick={() => setI(0)} aria-label="Restart">
          ⏮
        </button>
        <button type="button" onClick={() => (setPlaying(false), setI(Math.max(0, i - 1)))} aria-label="Previous step">
          ◀
        </button>
        <button type="button" className="cp-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" onClick={() => (setPlaying(false), setI(Math.min(steps.length - 1, i + 1)))} aria-label="Next step">
          ▶
        </button>
        <button type="button" className="cp-speed" onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))} aria-label="Change speed">
          {speed}×
        </button>
        <span className="cp-count">
          {i + 1}/{steps.length}
        </span>
      </div>

      <pre className="cp-code" ref={codeRef}>
        {info.python.split("\n").map((line, k) => (
          <span key={k} className={k + 1 === step.line ? "is-line" : ""}>
            <i>{k + 1}</i>
            {line || " "}
            {"\n"}
          </span>
        ))}
      </pre>
    </div>
  );
}

function PanelView({ p }: { p: Panel }) {
  switch (p.t) {
    case "array":
      return (
        <div className="cp-panel">
          {p.label && <span className="cp-label">{p.label}</span>}
          <div className="cp-array">
            {p.items.map((v, k) => {
              const cls = [
                p.hl?.includes(k) && "hl",
                p.ok?.includes(k) && "ok",
                p.dim?.includes(k) && "dim",
                p.win && k >= p.win[0] && k <= p.win[1] && "win",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <span key={k} className="cp-cellwrap">
                  <span className={`cp-cell ${cls}`}>{v}</span>
                  <span className="cp-idx">{k}</span>
                  <span className="cp-ptr">{p.ptr?.[k] || ""}</span>
                </span>
              );
            })}
          </div>
        </div>
      );
    case "map":
      return (
        <div className="cp-panel">
          <span className="cp-label">{p.label}</span>
          <div className="cp-map">
            {p.entries.length === 0 && <span className="cp-empty">{"{ }"}</span>}
            {p.entries.map(([k, v]) => (
              <span key={String(k)} className={`cp-entry${p.hl !== undefined && String(p.hl) === String(k) ? " hl" : ""}`}>
                {k} → {v}
              </span>
            ))}
          </div>
        </div>
      );
    case "stack":
      return (
        <div className="cp-panel">
          <span className="cp-label">{p.label}</span>
          <div className="cp-stack">
            {p.items.length === 0 && <span className="cp-empty">empty</span>}
            {p.items.map((v, k) => (
              <span key={k} className={`cp-entry${k === p.items.length - 1 ? " hl" : ""}`}>
                {v}
              </span>
            ))}
          </div>
        </div>
      );
    case "vars":
      return p.vars.length ? (
        <div className="cp-vars">
          {p.vars.map(([k, v]) => (
            <span key={k}>
              {k} = <b>{v}</b>
            </span>
          ))}
        </div>
      ) : null;
    case "list":
      return <ListView p={p} />;
    case "nodes":
      return <NodesView p={p} />;
    case "grid":
      return (
        <div className="cp-panel">
          {p.label && <span className="cp-label">{p.label}</span>}
          <table className="cp-grid">
            {p.colHead && (
              <thead>
                <tr>
                  {p.rowHead && <th />}
                  {p.colHead.map((h, k) => (
                    <th key={k}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {p.cells.map((row, r) => (
                <tr key={r}>
                  {p.rowHead && <th>{p.rowHead[r]}</th>}
                  {row.map((v, c) => {
                    const hl = p.hl?.some(([a, b]) => a === r && b === c);
                    const ok = p.ok?.some(([a, b]) => a === r && b === c);
                    return (
                      <td key={c} className={ok ? "ok" : hl ? "hl" : ""}>
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "intervals":
      return (
        <div className="cp-panel">
          <span className="cp-label">{p.label}</span>
          <div className="cp-intervals">
            {p.items.length === 0 && <span className="cp-empty">empty</span>}
            {p.items.map(([s, e], k) => (
              <div key={k} className="cp-iv-row">
                <span
                  className={`cp-iv${p.hl?.includes(k) ? " hl" : ""}${p.ok?.includes(k) ? " ok" : ""}`}
                  style={{ left: `${(s / p.max) * 100}%`, width: `${Math.max(2, ((e - s) / p.max) * 100)}%` }}
                >
                  [{s},{e}]
                </span>
              </div>
            ))}
            <div className="cp-iv-axis">
              {[0, 5, 10, 15].map((t) => (
                <span key={t} style={{ left: `${(t / p.max) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    case "bits":
      return (
        <div className="cp-panel">
          {p.rows.map((row) => (
            <div key={row.label} className="cp-bits">
              <span className="cp-bits-label">
                {row.label} <small>({row.value})</small>
              </span>
              {Array.from({ length: p.width }, (_, k) => p.width - 1 - k).map((bit) => (
                <span key={bit} className={`cp-bit${(row.value >> bit) & 1 ? " one" : ""}${p.hl?.includes(bit) ? " hl" : ""}`}>
                  {(row.value >> bit) & 1}
                </span>
              ))}
            </div>
          ))}
        </div>
      );
  }
}

function ListView({ p }: { p: Extract<Panel, { t: "list" }> }) {
  const n = p.vals.length;
  const W = 300;
  const gap = W / (n + 2);
  const x = (i: number) => gap * (i + 1) + gap / 2; // i = -1 (left ∅) … n (right ∅)
  const y = 34;
  return (
    <div className="cp-panel">
      <span className="cp-label">linked list</span>
      <svg className="cp-svg" viewBox={`0 0 ${W} 80`} role="img" aria-label="Linked list pointers">
        <defs>
          <marker id="cp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#a5b4fc" />
          </marker>
        </defs>
        {p.next.map((t, i) => {
          const target = t === null ? (i === 0 ? -1 : n) : t;
          const right = target > i;
          const x1 = x(i) + (right ? 13 : -13);
          const x2 = x(target) + (right ? -13 : 13);
          const bend = right ? y - 16 : y + 16;
          return <path key={i} d={`M${x1},${y} Q${(x1 + x2) / 2},${bend} ${x2},${y}`} className="cp-edge" markerEnd="url(#cp-arrow)" />;
        })}
        {[-1, n].map((k) => (
          <text key={k} x={x(k)} y={y + 4} className="cp-null">
            ∅
          </text>
        ))}
        {p.vals.map((v, i) => (
          <g key={i}>
            <rect x={x(i) - 13} y={y - 13} width="26" height="26" rx="7" className="cp-node" />
            <text x={x(i)} y={y + 4} className="cp-node-text">
              {v}
            </text>
          </g>
        ))}
        {Object.entries(p.ptr).map(([k, label]) => (
          <text key={k} x={x(Number(k))} y={74} className="cp-ptr-text">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function NodesView({ p }: { p: Extract<Panel, { t: "nodes" }> }) {
  const W = 300;
  const H = p.height || 150;
  const pos = new Map(p.nodes.map((n) => [n.id, { x: 14 + n.x * (W - 28), y: 14 + n.y * (H - 34) }]));
  return (
    <div className="cp-panel">
      <svg className="cp-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Diagram">
        {p.edges.map((e, k) => {
          const a = pos.get(e.a);
          const b = pos.get(e.b);
          if (!a || !b) return null;
          return (
            <g key={k}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`cp-edge${e.hl ? " hl" : ""}`} />
              {e.label && (
                // Tree edges going left get their label on the left, so labels don't sit on the lines.
                <text
                  x={(a.x + b.x) / 2 + (p.directed && b.x < a.x ? -5 : 5)}
                  y={(a.y + b.y) / 2 - 2}
                  textAnchor={p.directed && b.x < a.x ? "end" : "start"}
                  className="cp-edge-label"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {p.nodes.map((n) => {
          const q = pos.get(n.id)!;
          const cls = p.hl?.includes(n.id) ? "hl" : p.done?.includes(n.id) ? "done" : p.soft?.includes(n.id) ? "soft" : "";
          return (
            <g key={n.id} className={`cp-gnode ${cls}`}>
              <circle cx={q.x} cy={q.y} r="12" />
              <text x={q.x} y={q.y + 4}>
                {n.label}
              </text>
              {n.note && (
                <text x={q.x} y={q.y + 25} className="cp-gnote">
                  {n.note}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
