import { useEffect, useRef, useState } from "react";
import { Profile } from "../../utils/profile";
import { StarPhase, StarStatus, getInterviewStatus, startVoiceInterview } from "../../utils/realtime";
import "../interview.css";

// Interview tab: Behavioral (live AI voice interviewer, STAR tracker) and Technical (coming soon).

type Props = { profile: Profile };
type Mode = "behavioral" | "technical";

const COMPANIES = [
  { id: "generic", label: "Generic", focus: "Classic behavioral questions" },
  { id: "google", label: "Google", focus: "Scale, trade-offs & Googleyness" },
  { id: "amazon", label: "Amazon", focus: "Leadership Principles" },
  { id: "meta", label: "Meta", focus: "Move fast & impact" },
];

const PHASES: StarPhase[] = ["Situation", "Task", "Action", "Result"];
const MAX_MINUTES = 15;

type Box = { status: StarStatus | null; note: string };
const emptyBoxes = (): Record<StarPhase, Box> => ({
  Situation: { status: null, note: "" },
  Task: { status: null, note: "" },
  Action: { status: null, note: "" },
  Result: { status: null, note: "" },
});

function targetFrom(profile: Profile) {
  const p = profile.answers.positionTypes || [];
  if (p.includes("full_time_new_grad")) return "new grad software engineering roles";
  return "software engineering internships";
}

export default function InterviewTab({ profile }: Props) {
  const [mode, setMode] = useState<Mode>("behavioral");
  return (
    <div className="tab-page">
      <div className="iv-tabs" role="tablist" aria-label="Interview type">
        {(["behavioral", "technical"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "is-active" : ""} onClick={() => setMode(m)}>
            {m === "behavioral" ? "Behavioral" : "Technical"}
          </button>
        ))}
      </div>
      {mode === "behavioral" ? <Behavioral profile={profile} /> : <Technical />}
    </div>
  );
}

function Technical() {
  return (
    <section className="block">
      <div className="block-head">
        <h2>Technical practice</h2>
        <span className="block-tag">Coming soon</span>
      </div>
      <p className="block-note">
        Live coding mock interviews with an AI interviewer, NeetCode-style pattern drills, and company-specific question
        sets based on the Company tiers.
      </p>
    </section>
  );
}

function Behavioral({ profile }: { profile: Profile }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [company, setCompany] = useState("generic");
  const [state, setState] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [speaking, setSpeaking] = useState<"agent" | "user" | null>(null);
  const [boxes, setBoxes] = useState(emptyBoxes);
  const [lastPhase, setLastPhase] = useState<StarPhase | null>(null);
  const [question, setQuestion] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const stopRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    getInterviewStatus()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
    return () => stopRef.current?.();
  }, []);

  // Session timer, with an automatic stop to keep sessions (and API cost) bounded.
  useEffect(() => {
    if (state !== "live") return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [state]);
  useEffect(() => {
    if (seconds >= MAX_MINUTES * 60) stopRef.current?.();
  }, [seconds]);

  const start = async () => {
    setError("");
    setBoxes(emptyBoxes());
    setLastPhase(null);
    setQuestion("");
    setCaption("");
    setSeconds(0);
    try {
      stopRef.current = await startVoiceInterview(
        {
          company,
          level: profile.answers.academicLevel || "",
          target: targetFrom(profile),
        },
        {
          onState: setState,
          onSpeaking: setSpeaking,
          onStar: (phase, status, note) => {
            setBoxes((b) => ({ ...b, [phase]: { status, note } }));
            setLastPhase(phase);
          },
          onQuestion: (q) => {
            setQuestion(q);
            setBoxes(emptyBoxes());
            setLastPhase(null);
          },
          onCaption: setCaption,
          onError: setError,
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  };

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
  };

  const live = state === "live" || state === "connecting";
  const label =
    state === "connecting" ? "Connecting…" : state === "live" ? (speaking === "agent" ? "Alex is speaking" : speaking === "user" ? "Listening…" : "Your turn") : "Start practice";
  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const picked = COMPANIES.find((c) => c.id === company)!;

  return (
    <>
      <section className="block">
        <div className="block-head">
          <h2>Behavioral mock interview</h2>
        </div>
        <div className="iv-companies" role="radiogroup" aria-label="Interviewer">
          {COMPANIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={company === c.id}
              className={`iv-company${company === c.id ? " is-active" : ""}`}
              disabled={live}
              onClick={() => setCompany(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="block-note">
          Alex, a Senior Software Engineer{company === "generic" ? "" : ` at ${picked.label}`}, interviews you out loud.
          Focus: {picked.focus}.
        </p>

        <div className="star-boxes" aria-label="STAR progress">
          {PHASES.map((p) => (
            <div key={p} className={`star-box star--${boxes[p].status || "pending"}${lastPhase === p ? " is-last" : ""}`} title={boxes[p].note || p}>
              <span className="star-letter">{p[0]}</span>
              <span className="star-word">{p}</span>
            </div>
          ))}
        </div>
        <div className="star-legend" aria-hidden="true">
          <span>
            <i className="dot dot--complete" /> Passed
          </span>
          <span>
            <i className="dot dot--needs_clarification" /> Needs clarification
          </span>
          <span>
            <i className="dot dot--missing_detail" /> Revise & redo
          </span>
        </div>
        {lastPhase && boxes[lastPhase].note && (
          <p className={`star-note star-note--${boxes[lastPhase].status}`}>
            <strong>{lastPhase}:</strong> {boxes[lastPhase].note}
          </p>
        )}

        <div className="iv-center">
          <button
            type="button"
            className={`iv-orb${live ? " is-live" : ""}${speaking ? ` is-${speaking}` : ""}`}
            onClick={live ? stop : start}
            disabled={enabled === false || state === "connecting"}
            aria-label={live ? "End practice" : "Start practice"}
          >
            <span className="iv-orb-icon" aria-hidden="true">
              {live ? "■" : "🎙"}
            </span>
          </button>
          <p className="iv-status">
            {label}
            {state === "live" && (
              <span className="iv-timer">
                {" "}
                · {mm}:{ss}
              </span>
            )}
          </p>
          {live && <p className="iv-hint">Tap to end. Sessions stop after {MAX_MINUTES} minutes.</p>}
        </div>

        {question && (
          <div className="iv-question">
            <span className="iv-q-label">Question</span>
            <p>{question}</p>
          </div>
        )}
        {caption && state === "live" && <p className="iv-caption">Alex: “{caption}”</p>}
        {error && <p className="ob-error">{error}</p>}
        {enabled === false && <p className="gs-note">Voice practice isn't set up yet: the server needs an OPENAI_API_KEY.</p>}
        <p className="block-foot">
          🔒 Your voice goes straight to OpenAI to run the interview. Tepobaby doesn't record or store your audio. Use
          headphones for the best experience.
        </p>
      </section>
    </>
  );
}
