import { FormEvent, useEffect, useRef, useState } from "react";
import { AssistMessage, askAssistant } from "../../sierra/assistant";
import { inline } from "../../sierra/Markdown";

// The AI assistant panel in the Sierra OA coding screen (projects only, like CoderPad's embedded
// assistant). Answers come from Gemini and see the current part and code. Reviewers in the real
// assessment can read every prompt, so the panel keeps the habit visible: plan first, ask for small
// pieces, verify what comes back.

type Props = { problem: string; part: string; prompt: string; code: string; onClose: () => void };

const STARTERS = [
  "Write a TypeScript retry helper with a per-try timeout and full-jitter backoff.",
  "What edge cases am I missing in my current code?",
  "Write 4 console.assert tests for my function.",
  "Explain why this test might be failing.",
];

export default function SierraAssistant({ problem, part, prompt, code, onClose }: Props) {
  const [messages, setMessages] = useState<AssistMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, text: q }];
    setMessages(next);
    setDraft("");
    setError("");
    setBusy(true);
    try {
      const answer = await askAssistant(next, { problem, part, prompt, code });
      setMessages([...next, { role: "model", text: answer }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  return (
    <aside className="so-ai" aria-label="AI assistant">
      <div className="so-ai-head">
        <strong>AI assistant</strong>
        <span className="nc-muted nc-small">Gemini · sees your code</span>
        <button type="button" className="nc-btn nc-btn--icon" onClick={onClose} aria-label="Close the assistant">
          ✕
        </button>
      </div>
      <p className="so-ai-note">
        Like CoderPad's built-in assistant: reviewers can read every prompt. Plan first, ask for small pieces, and read and run everything it
        writes.
      </p>
      <div className="so-ai-list" ref={list} aria-live="polite">
        {messages.length === 0 && (
          <div className="so-ai-starters">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`so-ai-msg so-ai-msg--${m.role}`}>
            <AssistText text={m.text} />
          </div>
        ))}
        {busy && <div className="so-ai-msg so-ai-msg--model nc-muted">Thinking…</div>}
        {error && <p className="nc-bad nc-small">{error}</p>}
      </div>
      <form className="so-ai-form" onSubmit={onSubmit}>
        <label htmlFor="so-ai-input" className="so-sr">
          Prompt
        </label>
        <textarea
          id="so-ai-input"
          rows={2}
          value={draft}
          placeholder="Ask for one small piece…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
        />
        <button type="submit" className="nc-btn nc-btn--submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}

// Shows code fences as code blocks, `code` and **bold** inline, everything else as text. No HTML is injected.
function AssistText({ text }: { text: string }) {
  return (
    <>
      {text.split("```").map((chunk, i) =>
        i % 2 === 1 ? (
          <pre key={i}>{chunk.replace(/^[a-zA-Z]*\n/, "").replace(/\n$/, "")}</pre>
        ) : (
          chunk
            .trim()
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((p, j) => <p key={`${i}-${j}`}>{inline(p)}</p>)
        ),
      )}
    </>
  );
}
