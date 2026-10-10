import { useState } from "react";

type Props = { onSignIn: (email: string, name: string) => void };

// TODO: replace the email form with real Google OAuth (Google Identity Services)
// and enforce the .edu check on the server, using the `hd`/email claim from the ID token.
export default function Landing({ onSignIn }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.edu$/.test(clean)) {
      setError("Use your school email ending in .edu.");
      return;
    }
    onSignIn(clean, clean.split("@")[0]);
  };

  return (
    <main className="landing">
      <section className="hero">
        <h1>TEPOBABY</h1>
        <p className="tagline">No connections? No problem.</p>
        <p className="lead">
          Interview prep, fresh interview questions, and a networking playbook for high school and college students
          breaking into tech.
        </p>

        <form className="card signin" onSubmit={submit}>
          <button type="button" className="google" disabled title="Google sign-in coming soon">
            Continue with Google (.edu only) — coming soon
          </button>
          <div className="divider">or, for now</div>
          <label>
            School email
            <input
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary">
            Get started
          </button>
        </form>

        <ul className="features">
          <li>
            <strong>Fresh questions</strong> from the last 48–72 hours and the past week
          </li>
          <li>
            <strong>Behavioral + technical</strong> practice with AI feedback
          </li>
          <li>
            <strong>Networking playbook</strong>: alumni, cold messages, informational interviews
          </li>
          <li>
            <strong>Early programs</strong> like Microsoft Explore and Google STEP
          </li>
        </ul>
      </section>
    </main>
  );
}
