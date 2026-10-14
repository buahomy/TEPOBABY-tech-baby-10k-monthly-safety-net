// The student's own OpenAI API key for voice practice. It stays in this browser: "remember" keeps it
// in localStorage, otherwise it lasts until the tab closes (sessionStorage). It's only ever sent to
// api.openai.com, never to Tepobaby's server.

const KEY = "tepobaby.openaiKey";

export function getOpenAIKey(): string {
  try {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function saveOpenAIKey(key: string, remember: boolean) {
  try {
    clearOpenAIKey();
    (remember ? localStorage : sessionStorage).setItem(KEY, key);
  } catch {
    // storage blocked: the key still works for this page visit (kept in React state)
  }
}

export function clearOpenAIKey() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export const looksLikeKey = (k: string) => /^sk-[A-Za-z0-9_-]{20,}$/.test(k.trim());

/** "sk-…AbCd" for showing which key is saved. */
export const maskKey = (k: string) => `sk-…${k.slice(-4)}`;

/** Checks the key with OpenAI (lists models). Returns null if it works, or a message. */
export async function checkOpenAIKey(key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    if (res.ok) return null;
    if (res.status === 401) return "OpenAI didn't accept that key. Copy it again from platform.openai.com/api-keys.";
    if (res.status === 403) return "That key doesn't have access to the API. Check its permissions on platform.openai.com.";
    if (res.status === 429) return null; // rate-limited or out of credits; starting a session explains which
    return "Couldn't check the key with OpenAI right now. Try again in a moment.";
  } catch {
    return "Couldn't reach OpenAI. Check your connection and try again.";
  }
}
