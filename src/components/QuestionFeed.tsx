import { useMemo, useState } from "react";
import { InterviewQuestion, questions } from "../data/mock";

// Two windows only: very fresh (≤72h) and this week (≤7 days). Nothing older is shown.
const WINDOWS = { "Last 48–72 hrs": 72, "Past week": 168 } as const;
type Timeframe = keyof typeof WINDOWS;

type Props = { type: InterviewQuestion["type"] };

export default function QuestionFeed({ type }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>("Last 48–72 hrs");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  const list = useMemo(
    () =>
      questions.filter(
        (q) =>
          q.type === type &&
          q.postedHoursAgo <= WINDOWS[timeframe] &&
          (!company || q.company.toLowerCase().includes(company.toLowerCase())) &&
          (!role || q.role.toLowerCase().includes(role.toLowerCase())),
      ),
    [type, timeframe, company, role],
  );

  return (
    <section className="card">
      <div className="row between wrap">
        <h3>Recent {type} questions</h3>
        <div className="segmented">
          {(Object.keys(WINDOWS) as Timeframe[]).map((w) => (
            <button key={w} className={w === timeframe ? "active" : ""} onClick={() => setTimeframe(w)}>
              {w}
            </button>
          ))}
        </div>
      </div>
      <div className="row wrap">
        <input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input placeholder="Position (e.g. SWE Intern)" value={role} onChange={(e) => setRole(e.target.value)} />
      </div>
      <p className="muted small">Sample data. The scraper (Glassdoor, Reddit, LeetCode Discuss) will feed this list.</p>

      {list.length === 0 ? (
        <p className="muted">No questions in this window. Try "Past week" or clear the filters.</p>
      ) : (
        <ul className="list">
          {list.map((q) => (
            <li key={q.id}>
              <div className="row between wrap">
                <strong>{q.company}</strong>
                <span className="muted small">
                  {q.role} · {q.round} · {q.source} · {q.postedHoursAgo}h ago
                </span>
              </div>
              <p>
                {q.question} {q.difficulty && <span className={`pill ${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
