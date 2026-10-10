// Calls Gemini straight from the browser. The key never touches our servers.
// Default key comes from VITE_GEMINI_API_KEY (.env.local); a user's own key overrides it.

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export type ChatTurn = { role: "user" | "model"; text: string };

export function resolveKey(userKey: string): string {
  return userKey || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || "";
}

export async function askGemini(
  apiKey: string,
  history: ChatTurn[],
  systemPrompt: string,
): Promise<string> {
  if (!apiKey) throw new Error("No Gemini API key. Add one in Settings.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Gemini quota used up. Add your own key in Settings.");
    throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
}
