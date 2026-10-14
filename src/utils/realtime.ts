// Browser side of behavioral voice practice: WebRTC straight to the OpenAI Realtime API. Our server
// only provides the session setup (persona, rules, STAR tools); the browser exchanges it for a
// short-lived client secret using the student's own OpenAI API key, which never reaches our server.
// Interviewer audio plays through an <audio> element; STAR tool calls and transcripts arrive on the
// "oai-events" data channel.

export type StarPhase = "Situation" | "Task" | "Action" | "Result";
export type StarStatus = "complete" | "needs_clarification" | "missing_detail";

export type InterviewHandlers = {
  onState: (s: "connecting" | "live" | "ended") => void;
  onSpeaking: (who: "agent" | "user" | null) => void;
  onStar: (phase: StarPhase, status: StarStatus, note: string) => void;
  onQuestion: (question: string) => void;
  onCaption: (text: string) => void;
  onError: (message: string) => void;
};

export type InterviewOptions = { company: string; level: string; target: string };

const XHR = { "X-Requested-With": "XmlHttpRequest", "Content-Type": "application/json" };
const PHASES: StarPhase[] = ["Situation", "Task", "Action", "Result"];
const STATUSES: StarStatus[] = ["complete", "needs_clarification", "missing_detail"];

/** Thrown when OpenAI rejects the student's key, so the app can ask for a new one. */
export class BadKeyError extends Error {}

export async function getInterviewStatus(): Promise<{ enabled: boolean; companies: { id: string; label: string }[] }> {
  const res = await fetch("/api/interview/status");
  return res.json();
}

/** Starts a live voice interview. Returns a function that ends it. */
export async function startVoiceInterview(opts: InterviewOptions, apiKey: string, h: InterviewHandlers): Promise<() => void> {
  h.onState("connecting");
  let mic: MediaStream | null = null;
  let pc: RTCPeerConnection | null = null;
  const audio = new Audio();
  audio.autoplay = true;
  let ended = false;

  const stop = () => {
    if (ended) return;
    ended = true;
    try {
      pc?.getSenders().forEach((s) => s.track?.stop());
      pc?.close();
    } catch {
      // already closed
    }
    mic?.getTracks().forEach((t) => t.stop());
    audio.srcObject = null;
    h.onSpeaking(null);
    h.onState("ended");
  };

  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    h.onState("ended");
    throw new Error("Microphone access is needed for voice practice. Allow it in your browser and try again.");
  }

  try {
    const res = await fetch("/api/interview/config", { method: "POST", headers: XHR, body: JSON.stringify(opts) });
    const config = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(config.error || "Couldn't start a voice session.");

    // Short-lived secret for this one session, created with the student's own key.
    const secretRes = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session: config.session }),
    });
    const session = await secretRes.json().catch(() => ({}));
    if (!secretRes.ok) throw keyError(secretRes.status, JSON.stringify(session));

    pc = new RTCPeerConnection();
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc && ["failed", "disconnected", "closed"].includes(pc.connectionState) && !ended) {
        if (pc.connectionState !== "closed") h.onError("The voice connection dropped.");
        stop();
      }
    };
    pc.addTrack(mic.getTracks()[0], mic);

    const dc = pc.createDataChannel("oai-events");
    const send = (msg: unknown) => dc.readyState === "open" && dc.send(JSON.stringify(msg));
    let caption = "";

    dc.onopen = () => {
      h.onState("live");
      send({ type: "response.create" }); // North West greets and asks the first question
    };
    dc.onmessage = (e) => {
      let ev: any;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (ev.type) {
        case "output_audio_buffer.started":
          h.onSpeaking("agent");
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          h.onSpeaking(null);
          break;
        case "input_audio_buffer.speech_started":
          h.onSpeaking("user");
          break;
        case "input_audio_buffer.speech_stopped":
          h.onSpeaking(null);
          break;
        case "response.output_audio_transcript.delta":
          caption += ev.delta || "";
          h.onCaption(caption);
          break;
        case "response.output_audio_transcript.done":
          caption = "";
          if (ev.transcript) h.onCaption(ev.transcript);
          break;
        case "response.done": {
          // Tool calls arrive as function_call output items; answer each, then let North West continue.
          const calls = (ev.response?.output || []).filter((o: any) => o.type === "function_call");
          for (const call of calls) {
            let args: any = {};
            try {
              args = JSON.parse(call.arguments || "{}");
            } catch {
              // ignore malformed args
            }
            if (call.name === "update_star_progress" && PHASES.includes(args.phase) && STATUSES.includes(args.status)) {
              h.onStar(args.phase, args.status, String(args.feedback_note || ""));
            } else if (call.name === "start_new_question" && args.question) {
              h.onQuestion(String(args.question));
            }
            send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ ok: true }) } });
          }
          if (calls.length) send({ type: "response.create" });
          break;
        }
        case "error":
          h.onError(ev.error?.message || "The voice session hit an error.");
          break;
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdp = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: { Authorization: `Bearer ${session.value}`, "Content-Type": "application/sdp" },
    });
    if (!sdp.ok) throw keyError(sdp.status, await sdp.text().catch(() => ""));
    await pc.setRemoteDescription({ type: "answer", sdp: await sdp.text() });
  } catch (err) {
    stop();
    throw err;
  }

  return stop;
}

/** Plain-words errors for problems with the student's OpenAI account. */
function keyError(status: number, detail: string): Error {
  if (status === 401) return new BadKeyError("OpenAI didn't accept your API key. Enter it again below.");
  if (status === 403) return new BadKeyError("Your API key doesn't have access to the Realtime API. Check its permissions on platform.openai.com.");
  if (status === 429 && /insufficient_quota|billing|credit/i.test(detail)) {
    return new Error("Your OpenAI account is out of credits. Add credits at platform.openai.com/settings/organization/billing, then try again.");
  }
  if (status === 429) return new Error("OpenAI is busy right now. Try again in a minute.");
  if (status === 404 && /model/i.test(detail)) return new Error("Your OpenAI account can't use the realtime voice model yet. Check your account's model access.");
  return new Error("OpenAI didn't accept the voice connection. Try again.");
}
