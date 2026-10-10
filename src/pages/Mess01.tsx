import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import PhoneShell from "../components/PhoneShell";
import { AUTH_ERRORS, prepareGoogleSignIn, signInWithGoogle } from "../utils/auth";

// Welcome screen ported from the Figma Make file "TEPOBABY" (b5IEjWIqPE1QZrVzTYJ3Eu).
// Shown to signed-out visitors. Styles live in mess01.css, scoped under `.m01`.

const features = [
  {
    icon: "radar" as const,
    eyebrow: "LIVE INTELLIGENCE",
    title: "Apply Early",
    detail: "Latest postings in 48–72h · Company tier · DS&A difficulty",
  },
  {
    icon: "people" as const,
    eyebrow: "EARLY CAREER",
    title: "Targeted Student Matcher",
    detail: "Year of study · Race · CPT/OPT sponsorship",
  },
  {
    icon: "spark" as const,
    eyebrow: "AI COACHING",
    title: "AI Prep & Networking",
    detail: "STAR audio feedback · Resume match · Outreach",
  },
];

type Props = { onGuest: () => void; initialError?: string };

export default function Mess01({ onGuest, initialError = "" }: Props) {
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState(initialError);

  useEffect(() => {
    prepareGoogleSignIn().catch((e: Error) => setAuthError(e.message));

    // Errors from the redirect flow come back as ?auth_error=<code>.
    const params = new URLSearchParams(location.search);
    const code = params.get("auth_error");
    if (code) {
      setAuthError(AUTH_ERRORS[code] ?? AUTH_ERRORS.failed);
      params.delete("auth_error");
      const rest = params.toString();
      history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
    }
  }, []);

  // Sends the page to Google; it comes back signed in and the app opens onboarding.
  const startEduSignIn = () => {
    if (signingIn) return;
    setAuthError("");
    try {
      signInWithGoogle();
      setSigningIn(true);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : AUTH_ERRORS.failed);
    }
  };

  const onActivate = (action: () => void) => (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  const primaryLabel = signingIn ? "Connecting to Google…" : "Get Started with .edu Email";

  return (
    <PhoneShell label="tepobaby welcome screen">
        <div className="screen-content">
          <header className="brand-row">
            <div className="brand-mark">
              <img className="brand-image" src="/mess-01/favicon.png" alt="Tepobaby app icon" />
            </div>
            <span className="wordmark">Tepobaby</span>
          </header>

          <div className="hero-copy">
            <div className="signal-pill">
              <span className="signal-dot" />
              Your all-in-one tech interview prep, while bedrotting
            </div>
            <p className="hero-title" role="heading" aria-level={1}>
              Interviewmaxx Your Tech Opportunities with <span>Real-Time AI Intelligence</span>
            </p>
          </div>

          <div className="feature-stack" aria-label="Key features">
            {features.map((feature, index) => (
              <article className="feature-card" key={feature.title}>
                <div className={`feature-icon feature-icon-${index + 1}`}>
                  <Icon name={feature.icon} />
                </div>
                <div className="feature-copy">
                  <span className="feature-eyebrow">{feature.eyebrow}</span>
                  <p className="feature-title">{feature.title}</p>
                  <p className="feature-detail">{feature.detail}</p>
                </div>
                <Icon name="arrow" />
              </article>
            ))}
          </div>

          <div className="actions">
            <div
              className="primary-action"
              role="button"
              tabIndex={0}
              aria-busy={signingIn}
              aria-disabled={signingIn}
              onClick={startEduSignIn}
              onKeyDown={onActivate(startEduSignIn)}
            >
              <span className="edu-chip">.edu</span>
              <span>{primaryLabel}</span>
              <Icon name="arrow" />
            </div>
            {authError ? (
              <p className="primary-helper auth-error" role="alert">
                {authError}
              </p>
            ) : (
              <p className="primary-helper">
                <Icon name="lock" />
                Verified email unlocks alumni matching, clubs & peer mocks
              </p>
            )}

            <div className="divider">
              <span />
              <p>or</p>
              <span />
            </div>

            <div
              className="guest-action"
              role="button"
              tabIndex={0}
              onClick={onGuest}
              onKeyDown={onActivate(onGuest)}
            >
              I’ll just browse around
            </div>
            <p className="guest-helper">Explore public job links & contractor roles. Answers are saved on this device only.</p>
          </div>
        </div>
    </PhoneShell>
  );
}
