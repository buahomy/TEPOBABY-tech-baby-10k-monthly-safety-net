import { Suspense, lazy, useEffect, useState } from "react";
import { Concept, ProblemSummary, getProblemList } from "../../neetcode/api";
import CardGame from "./CardGame";
import Roadmap from "./Roadmap";
import "./technical.css";
import { canSaveLocally, pushKey } from "../../utils/accountSync";

const SierraOA = lazy(() => import("./SierraOA"));

// Technical practice: the NeetCode 150 as a Card Game and a concept Roadmap, plus Sierra OA (practice
// for Sierra's new-grad CoderPad assessment, which doesn't need the NeetCode data).

type Sub = "cards" | "roadmap" | "sierra";
const SUBS: { id: Sub; label: string }[] = [
  { id: "cards", label: "🃏 Card Game" },
  { id: "roadmap", label: "🗺️ Roadmap" },
  { id: "sierra", label: "🌲 Sierra OA" },
];

export default function TechnicalPractice() {
  const [sub, setSub] = useState<Sub>(() => {
    try {
      const saved = localStorage.getItem("tepobaby.technical.sub");
      return saved === "roadmap" || saved === "sierra" ? saved : "cards";
    } catch {
      return "cards";
    }
  });
  const [data, setData] = useState<{ concepts: Concept[]; problems: ProblemSummary[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getProblemList()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const pick = (s: Sub) => {
    setSub(s);
    try {
      if (!canSaveLocally()) return;
      localStorage.setItem("tepobaby.technical.sub", s);
      pushKey("tepobaby.technical.sub");
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div className="iv-tabs nc-subtabs" role="tablist" aria-label="Technical practice">
        {SUBS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={sub === s.id} className={sub === s.id ? "is-active" : ""} onClick={() => pick(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      {sub === "sierra" ? (
        <Suspense fallback={<div className="nc-skeleton nc-skeleton--tall" aria-label="Loading Sierra OA practice" />}>
          <SierraOA />
        </Suspense>
      ) : (
        <>
          {error && <p className="ob-error">{error}</p>}
          {!data && !error && <div className="nc-skeleton nc-skeleton--tall" aria-label="Loading the NeetCode 150" />}
          {data && (sub === "cards" ? <CardGame problems={data.problems} concepts={data.concepts} /> : <Roadmap problems={data.problems} />)}
        </>
      )}
    </>
  );
}
