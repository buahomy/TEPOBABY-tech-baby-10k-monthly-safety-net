import { Profile } from "../utils/storage";
import GeminiChat from "./GeminiChat";
import QuestionFeed from "./QuestionFeed";

export default function BehavioralTab({ profile }: { profile: Profile }) {
  const context = `The student is a ${profile.year} at ${profile.university}, targeting "${profile.targetRole || "a tech internship"}".${
    profile.resume ? ` Their resume:\n${profile.resume}` : ""
  }`;

  return (
    <div className="grid">
      <GeminiChat
        title="Elevator pitch: “Tell me about yourself”"
        placeholder="Paste a rough draft, or just list your major, projects, and what role you want…"
        systemPrompt={`You are a tech recruiter coaching a student. Turn their notes into a 45–60 second "tell me about yourself" pitch: present → past → future → why this role. Keep it natural and specific. Then give 2 short tips. ${context}`}
      />

      <section className="card">
        <h3>STAR answer practice</h3>
        <p>
          Answer out loud using <strong>S</strong>ituation, <strong>T</strong>ask, <strong>A</strong>ction,{" "}
          <strong>R</strong>esult.
        </p>
        <button disabled title="Whisper transcription coming soon">
          🎙 Record answer (Whisper — coming soon)
        </button>
        <p className="muted small">
          For now, type your answer in the coach below. Voice recording will be transcribed with Whisper and sent to the
          same coach.
        </p>
      </section>

      <GeminiChat
        title="STAR coach"
        placeholder="Paste the question, then your answer…"
        systemPrompt={`You are a behavioral interview coach. Score the student's answer on each STAR part (1–5), point out what's missing, and rewrite it in under 150 words with a measurable result. ${context}`}
      />

      <QuestionFeed type="behavioral" />
    </div>
  );
}
