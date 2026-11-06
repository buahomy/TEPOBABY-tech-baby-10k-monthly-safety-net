// Ginny's Claude Code chat: talks to Claude Code on the author's Mac through the server.
// Only shows for the accounts in CLAUDE_CHAT_EMAILS; the server checks every request.

const XHR = { "X-Requested-With": "XmlHttpRequest", "Content-Type": "application/json" };
const KEY = "tepobaby.claudeChat";

export type Approval = { tool: string; command?: string; url?: string; detail: string; canApprove: boolean };
export type ClaudeMessage = { role: "user" | "claude"; text: string; tools?: string[]; approve?: Approval[]; files?: string[]; error?: string };
export type ClaudeEvent =
  | { t: "text"; v: string }
  | { t: "tool"; name: string; detail: string }
  | { t: "done"; sessionId: string | null; error: string | null; approve: Approval[]; files?: string[] };

/** This tab's conversation: survives closing Ginny, gone when the tab closes. */
export type ClaudeThread = { sessionId: string | null; messages: ClaudeMessage[]; sentJobs: string[] };

export function loadThread(): ClaudeThread {
  try {
    const t = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (t?.messages) return t;
  } catch {
    // ignore
  }
  return { sessionId: null, messages: [], sentJobs: [] };
}

export function saveThread(t: ClaudeThread) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // keep it in memory for this visit
  }
}

/** Opens on the phone: a PDF Claude Code saved to the Mac's Desktop. */
export const fileUrl = (name: string) => `/api/claude/file?name=${encodeURIComponent(name)}`;

export async function claudeStatus(): Promise<{ allowed: boolean; online: boolean }> {
  const res = await fetch("/api/claude/status");
  return res.ok ? res.json() : { allowed: false, online: false };
}

/** A saved job's description as plain text ("" when the posting can't be read). */
export async function jobText(url: string): Promise<string> {
  const res = await fetch("/api/claude/job", { method: "POST", headers: XHR, body: JSON.stringify({ url }) });
  return res.ok ? (await res.json()).text : "";
}

export async function sendToClaude(
  body: { message: string; sessionId: string | null; job?: { title: string; company: string; url: string; text: string }; approve?: Approval[] },
  onEvent: (e: ClaudeEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/claude/chat", { method: "POST", headers: XHR, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't reach Claude Code.");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }
}
