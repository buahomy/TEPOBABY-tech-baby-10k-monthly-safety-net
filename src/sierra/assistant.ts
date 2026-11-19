// Calls the Sierra OA coding assistant (server/ginny: POST /api/ginny/code-assist), a Gemini stand-in
// for the AI assistant embedded in Sierra's CoderPad assessment.

export type AssistMessage = { role: "user" | "model"; text: string };
export type AssistContext = { problem: string; part: string; prompt: string; code: string };

export async function askAssistant(messages: AssistMessage[], context: AssistContext): Promise<string> {
  const res = await fetch("/api/ginny/code-assist", {
    method: "POST",
    headers: { "X-Requested-With": "XmlHttpRequest", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages.map(({ role, text }) => ({ role, text })), context }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The assistant didn't answer. Try again.");
  return data.text as string;
}
