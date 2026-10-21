import { useEffect, useState } from "react";
import { Concept, ProblemSummary, getProblemList } from "../../neetcode/api";
import CardGame from "./CardGame";
import Roadmap from "./Roadmap";
import "./technical.css";
import { canSaveLocally, pushKey } from "../../utils/accountSync";

// Technical practice, built entirely on the NeetCode 150: a Card Game and a concept Roadmap,
// side by side.

type Sub = "cards" | "roadmap";

export default function TechnicalPractice() {
  const [sub, setSub] = useState<Sub>(() => {
    try {
      return localStorage.getItem("tepobaby.technical.sub") === "roadmap" ? "roadmap" : "cards";
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
        {(["cards", "roadmap"] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={sub === s} className={sub === s ? "is-active" : ""} onClick={() => pick(s)}>
            {s === "cards" ? "🃏 Card Game" : "🗺️ Roadmap"}
          </button>
        ))}
      </div>
      {error && <p className="ob-error">{error}</p>}
      {!data && !error && <div className="nc-skeleton nc-skeleton--tall" aria-label="Loading the NeetCode 150" />}
      {data && (sub === "cards" ? <CardGame problems={data.problems} concepts={data.concepts} /> : <Roadmap problems={data.problems} />)}
    </>
  );
}
