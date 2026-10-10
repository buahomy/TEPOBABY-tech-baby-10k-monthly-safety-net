import { useState } from "react";
import { Profile, loadGeminiKey, saveGeminiKey } from "../utils/storage";

type Props = { profile: Profile; onProfileChange: (p: Profile) => void };

export default function SettingsTab({ profile, onProfileChange }: Props) {
  const [key, setKey] = useState(loadGeminiKey);
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid">
      <section className="card stack">
        <h3>Your Gemini API key</h3>
        <p className="muted">
          By default the app uses a shared free-tier key. If it runs out of quota, use your own:
        </p>
        <ol>
          <li>
            Go to{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
              Google AI Studio ↗
            </a>
          </li>
          <li>Create and copy an API key</li>
          <li>Paste it below</li>
        </ol>
        <input
          type="password"
          placeholder="AIza…"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setSaved(false);
          }}
        />
        <div className="row">
          <button
            className="primary"
            onClick={() => {
              saveGeminiKey(key);
              setSaved(true);
            }}
          >
            Save key
          </button>
          {saved && <span className="muted small">Saved in this browser.</span>}
        </div>
        <p className="muted small">Your key is stored only in your browser and sent only to Google.</p>
      </section>

      <section className="card stack">
        <h3>Profile</h3>
        <p>
          {profile.name} · {profile.email}
          <br />
          {profile.year} at {profile.university}
          {profile.visa && profile.visa !== "None" && ` · ${profile.visa}`}
        </p>
        <button onClick={() => onProfileChange({ ...profile, year: "" })}>Edit answers</button>
      </section>
    </div>
  );
}
