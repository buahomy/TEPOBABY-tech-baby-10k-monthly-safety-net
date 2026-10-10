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
  const [camera, setCamera] = useState<"off" | "on" | "denied">("off");
  const stopRef = useRef<null | (() => void)>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const wantCamera = useRef(false);

  // Self-view camera: stays in this browser like a real video interview; it's never sent to OpenAI.
  const startCamera = async () => {
    wantCamera.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      // The session may have ended while the camera was starting: don't leave it on.
      if (!wantCamera.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      camStream.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamera("on");
    } catch {
      if (wantCamera.current) setCamera("denied"); // keep going audio-only
    }
  };
  const stopCamera = () => {
    wantCamera.current = false;
    camStream.current?.getTracks().forEach((t) => t.stop());
    camStream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera("off");
  };

  useEffect(() => {
    getInterviewStatus()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
    return () => {
      stopRef.current?.();
      wantCamera.current = false;
      camStream.current?.getTracks().forEach((t) => t.stop());
    };
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
    startCamera();
    try {
      stopRef.current = await startVoiceInterview(
        {
          company,
          level: profile.answers.academicLevel || "",
          target: targetFrom(profile),
        },
        {
          onState: (st) => {
            setState(st);
            if (st === "ended") stopCamera();
          },
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
      stopCamera();
    }
  };

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    stopCamera();
  };

  const live = state === "live" || state === "connecting";
  const label =
    state === "connecting" ? "Connecting…" : state === "live" ? (speaking === "agent" ? "North West is speaking" : speaking === "user" ? "Listening…" : "Your turn") : "Start practice";
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
          North West, a Senior Software Engineer{company === "generic" ? "" : ` at ${picked.label}`}, interviews you out loud.
          Focus: {picked.focus}.
        </p>

        <div className="iv-stage">
          <div className="star-col" aria-label="STAR progress">
            {PHASES.map((p) => (
              <div key={p} className={`star-box star--${boxes[p].status || "pending"}${lastPhase === p ? " is-last" : ""}`} title={boxes[p].note || p}>
                <span className="star-letter">{p[0]}</span>
                <span className="star-word">{p}</span>
              </div>
            ))}
          </div>

          <div className={`cam-panel${camera === "on" ? " is-on" : ""}`}>
            <video ref={videoRef} className="cam-video" autoPlay playsInline muted aria-label="Your camera" />
            {camera !== "on" && (
              <div className="cam-empty">
                <img src="/logos/openai-white.png" alt="" />
                <span>
                  {camera === "denied"
                    ? "Camera is off. Practicing audio-only."
                    : live
                      ? "Turning on your camera…"
                      : "Your camera turns on when you start, like a real video interview."}
                </span>
              </div>
            )}
            <div className={`cam-agent${speaking === "agent" ? " is-talking" : ""}`} aria-live="polite">
              <span className="cam-agent-logo">
                <img src="/logos/openai.png" alt="OpenAI" />
              </span>
              <span className="cam-agent-name">
                North West{speaking === "agent" ? " · speaking" : live ? " · listening" : ""}
              </span>
              {speaking === "agent" && (
                <span className="cam-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
            {live && <span className="cam-live">● LIVE</span>}
          </div>
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
            <img className="iv-orb-logo" src="/logos/openai-white.png" alt="" />
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
        {caption && state === "live" && <p className="iv-caption">North West: “{caption}”</p>}
        {error && <p className="ob-error">{error}</p>}
        {enabled === false && <p className="gs-note">Voice practice isn't set up yet: the server needs an OPENAI_API_KEY.</p>}
        <p className="block-foot">
          🔒 Your voice goes straight to OpenAI to run the interview. Your camera is only shown to you on this screen and
          is never sent anywhere. Tepobaby doesn't record or store your audio or video. Use headphones for the best
          experience.
        </p>
      </section>
    </>
  );
}
