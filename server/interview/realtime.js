// Behavioral mock interviews with the OpenAI Realtime API (voice, over WebRTC).
//
// The browser never sees our OpenAI key: the server mints a short-lived client secret
// (POST /v1/realtime/client_secrets) with the whole session baked in — the interviewer's persona,
// company focus, rigor and evaluation criteria (system instructions), the voice, turn detection,
// and the STAR feedback tools. The browser then connects straight to OpenAI with that secret
// (POST /v1/realtime/calls, SDP over WebRTC) and gets tool calls on the "oai-events" data channel.

export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
const VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";

export const realtimeEnabled = () => !!process.env.OPENAI_API_KEY;

// ---- Interviewer personas ----

const COMPANIES = {
  generic: {
    label: "Generic",
    focus: [
      "Ask classic behavioral questions for software engineering internships and new grad roles: teamwork, conflict, failure, ambiguity, ownership, learning something fast.",
      "Value clear individual contribution, sound reasoning, and concrete, measurable results.",
    ],
  },
  google: {
    label: "Google",
    focus: [
      "Focus on scale and complexity: probe how the candidate handled growth (from thousands to billions of requests), edge cases, and system trade-offs.",
      "Test 'Googleyness': collaboration across teams, handling ambiguity, humility, and doing the right thing for users.",
      "Listen closely for 'I' versus 'we' in their actions. Google cares heavily about individual contribution.",
      "If a result lacks metrics, follow up, for example: 'That sounds like a solid technical effort, but what was the measurable latency or throughput impact of that change?'",
    ],
  },
  amazon: {
    label: "Amazon",
    focus: [
      "You are evaluating Amazon's Leadership Principles, like a Principal Engineer would. Explicitly test Customer Obsession, Ownership, Bias for Action, Dive Deep and Deliver Results, and name the principle you're probing.",
      "Ask follow-up questions if the candidate fails to show bias for action, or fails to give quantifiable business metrics for 'Deliver Results'.",
      "Push on what they personally decided, the data they used, and what they'd do differently.",
    ],
  },
  meta: {
    label: "Meta",
    focus: [
      "Focus on moving fast and impact: rapid execution, shipping under time pressure, and measurable impact for users.",
      "Probe personal engineering ownership: what the candidate built and drove themselves, start to finish.",
      "Reward pragmatism over over-engineering. Challenge answers that spent weeks polishing instead of shipping and iterating.",
    ],
  },
};

export const companyOptions = () => Object.entries(COMPANIES).map(([id, c]) => ({ id, label: c.label }));

function instructions(companyId, ctx) {
  const c = COMPANIES[companyId] || COMPANIES.generic;
  const where = companyId === "generic" ? "a top tech company" : c.label;
  return [
    `You are Alex, a Senior Software Engineer at ${where}, running a behavioral mock interview for a U.S. college student${ctx.level ? ` (${ctx.level})` : ""} applying to ${ctx.target || "software engineering internships and new grad roles"}.`,
    "Your goal is to evaluate each answer with the STAR method: Situation, Task, Action, Result.",
    "",
    "Persona and behavior:",
    "- Professional, polite and direct, like a real engineering interviewer. Speak English.",
    "- Keep your spoken turns short: 1 to 3 sentences, so the candidate does most of the talking.",
    "- Ask one behavioral question at a time. Start by greeting the candidate in one sentence, then ask your first question.",
    "- Let the candidate finish a thought before following up. If a STAR part is missing or vague, follow up naturally in your own voice. For example, if they skip the result: 'Thanks for detailing those steps! Before we move on, what was the actual impact after you shipped that?'",
    "- After an answer has a clear Situation, Task, Action and Result, give one sentence of honest feedback, then move to a new question.",
    "",
    `Company focus (${c.label}):`,
    ...c.focus.map((f) => `- ${f}`),
    "",
    "Tools (call them silently; never mention them out loud):",
    "- Call start_new_question every time you ask a new main question, with the question text.",
    "- Call update_star_progress whenever the candidate covers or skips a STAR component:",
    "  - complete: that part is clear and specific.",
    "  - needs_clarification: it's there but vague; you're asking a follow-up.",
    "  - missing_detail: it's missing or weak enough that the candidate should revise and redo that part.",
    "  Always include a brief feedback_note, e.g. 'No quantifiable metric provided'.",
  ].join("\n");
}

const TOOLS = [
  {
    type: "function",
    name: "update_star_progress",
    description: "Call this whenever the candidate covers or skips a component of the STAR method.",
    parameters: {
      type: "object",
      properties: {
        phase: { type: "string", enum: ["Situation", "Task", "Action", "Result"] },
        status: { type: "string", enum: ["complete", "missing_detail", "needs_clarification"] },
        feedback_note: {
          type: "string",
          description: "Brief note on what was missing (e.g., 'No quantifiable metric provided').",
        },
      },
      required: ["phase", "status"],
    },
  },
  {
    type: "function",
    name: "start_new_question",
    description: "Call this every time you ask the candidate a new main behavioral question. Resets the STAR tracker.",
    parameters: {
      type: "object",
      properties: { question: { type: "string", description: "The question you just asked, in one sentence." } },
      required: ["question"],
    },
  },
];

/** Mints a short-lived client secret for one interview session. Returns { value, expiresAt, model }. */
export async function createSession({ company, level, target }) {
  const session = {
    type: "realtime",
    model: REALTIME_MODEL,
    instructions: instructions(company, { level, target }),
    audio: {
      input: {
        turn_detection: { type: "semantic_vad" },
        transcription: { model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe" },
      },
      output: { voice: VOICE },
    },
    tools: TOOLS,
    tool_choice: "auto",
  };

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ session }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `OpenAI ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return { value: data.value, expiresAt: data.expires_at ?? null, model: REALTIME_MODEL };
}
