import { useEffect, useRef, useState } from "react";

// The video reflection drill: Sierra's assessment ends with a short recorded explanation. This records
// the student on their own device (camera + mic) so they can watch it back. Nothing is uploaded; the
// recording lives only in this tab and is gone when it closes. Without a camera, it's a 90-second
// talk-it-out timer.

const LIMIT = 90;

export const REFLECTION_PROMPTS = [
  "What you built, and which parts fully work.",
  "One key design choice, and why you made it.",
  "Edge cases you handled (empty input, failures, limits).",
  "How you used AI, and something you checked or fixed in its output. If AI wasn't allowed, how you'd test it.",
  "What you'd add for production: tests, logging, metrics, limits.",
];

export default function SierraReflection() {
  const [state, setState] = useState<"idle" | "asking" | "recording" | "done" | "nocam">("idle");
  const [left, setLeft] = useState(LIMIT);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const preview = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef(0);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(
    () => () => {
      window.clearInterval(timer.current);
      stopTracks();
    },
    [],
  );

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const tick = (onEnd: () => void) => {
    setLeft(LIMIT);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(timer.current);
          onEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record here. Use the timer and talk it out loud instead.");
      return;
    }
    setState("asking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      stream.current = s;
      if (preview.current) {
        preview.current.srcObject = s;
        preview.current.play().catch(() => {});
      }
      chunks.current = [];
      const r = new MediaRecorder(s);
      recorder.current = r;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const blob = new Blob(chunks.current, { type: r.mimeType || "video/webm" });
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        stopTracks();
        setState("done");
      };
      r.start();
      setState("recording");
      tick(() => recorder.current?.state === "recording" && recorder.current.stop());
    } catch {
      stopTracks();
      setState("idle");
      setError("Camera or microphone access was blocked. You can still practice with the timer.");
    }
  }

  const stop = () => {
    window.clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    else setState("done");
  };

  const talkOnly = () => {
    setError("");
    setState("nocam");
    tick(() => setState("done"));
  };

  return (
    <div className="so-reflect">
      <ol className="so-prompts">
        {REFLECTION_PROMPTS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>

      <div className="so-cam">
        <video ref={preview} className={state === "recording" ? "is-live" : ""} muted playsInline hidden={state !== "recording" && state !== "asking"} />
        {state === "done" && url && <video className="so-playback" src={url} controls playsInline />}
        {(state === "recording" || state === "nocam") && (
          <div className="so-cam-bar">
            <span className="so-rec">{state === "recording" ? "● REC" : "Talking"}</span>
            <span className="so-clock">{left}s</span>
            <button type="button" className="nc-btn nc-btn--run" onClick={stop}>
              Stop
            </button>
          </div>
        )}
      </div>

      {(state === "idle" || state === "done") && (
        <div className="nc-row">
          <button type="button" className="nc-primary" onClick={startRecording}>
            {state === "done" ? "Record again" : "Record a 90-second reflection"}
          </button>
          <button type="button" className="nc-secondary" onClick={talkOnly}>
            Timer only
          </button>
        </div>
      )}
      {state === "done" && <p className="nc-muted nc-small">{url ? "Watch it back: eye contact, pace, and did you say what doesn't work?" : "Done. Did you cover all five points?"}</p>}
      {error && <p className="nc-bad nc-small">{error}</p>}
      <p className="nc-muted nc-small">The recording stays on this device and disappears when you leave. Tepobaby never uploads it.</p>
    </div>
  );
}
