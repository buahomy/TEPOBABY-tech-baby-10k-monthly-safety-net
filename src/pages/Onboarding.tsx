import { useState } from "react";
import { Profile } from "../utils/storage";

type Props = { profile: Profile; onDone: (p: Profile) => void; onSignOut: () => void };

export default function Onboarding({ profile, onDone, onSignOut }: Props) {
  const [p, setP] = useState(profile);
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP({ ...p, [key]: value });

  return (
    <main className="narrow">
      <header className="row between">
        <h2>Tell us about you</h2>
        <button className="link" onClick={onSignOut}>
          Sign out
        </button>
      </header>
      <p className="muted">We use this to recommend programs, clubs, and roles that fit you. It stays in your browser.</p>

      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(p);
        }}
      >
        <label>
          Name
          <input value={p.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label>
          University
          <input required value={p.university} onChange={(e) => set("university", e.target.value)} />
        </label>
        <label>
          Year
          <select required value={p.year} onChange={(e) => set("year", e.target.value as Profile["year"])}>
            <option value="">Choose…</option>
            <option>Freshman</option>
            <option>Sophomore</option>
            <option>Junior</option>
            <option>Senior</option>
            <option>Grad</option>
          </select>
        </label>
        <label>
          Work authorization
          <select value={p.visa} onChange={(e) => set("visa", e.target.value as Profile["visa"])}>
            <option value="">Choose…</option>
            <option>None</option>
            <option>Need CPT</option>
            <option>Need OPT</option>
            <option>Need CPT + OPT</option>
          </select>
        </label>
        <label>
          Target position
          <input
            placeholder="e.g. Software Engineering Intern"
            value={p.targetRole}
            onChange={(e) => set("targetRole", e.target.value)}
          />
        </label>
        <label>
          Race / identity <span className="muted">(optional, used only to suggest clubs)</span>
          <select value={p.identity} onChange={(e) => set("identity", e.target.value)}>
            <option value="">Prefer not to say</option>
            <option>Black</option>
            <option>Latinx</option>
            <option>Hispanic</option>
            <option>Asian</option>
            <option>Native American</option>
            <option>Woman</option>
            <option>Other</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.firstGen} onChange={(e) => set("firstGen", e.target.checked)} />
          I'm a first-generation college student
        </label>
        <button type="submit" className="primary">
          Continue
        </button>
      </form>
    </main>
  );
}
