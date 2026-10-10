import { useState } from "react";
import { ChatTurn, askGemini, resolveKey } from "../utils/gemini";
import { loadGeminiKey } from "../utils/storage";

type Props = { title: string; systemPrompt: string; placeholder: string };

export default function GeminiChat({ title, systemPrompt, placeholder }: Props) {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatTurn[] = [...history, { role: "user", text }];
    setHistory(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const reply = await askGemini(resolveKey(loadGeminiKey()), next, systemPrompt);
      setHistory([...next, { role: "model", text: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="chat">
        {history.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            {t.text}
          </div>
        ))}
        {busy && <div className="bubble model muted">Thinking…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      <textarea
        rows={4}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
      />
      <div className="row between">
        <span className="muted small">⌘/Ctrl + Enter to send</span>
        <button className="primary" onClick={send} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </section>
  );
}
