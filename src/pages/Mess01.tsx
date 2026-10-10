import { useEffect, useState } from "react";
import "./mess01.css";

// Welcome screen ported from the Figma Make file "TEPOBABY" (b5IEjWIqPE1QZrVzTYJ3Eu).
// Served at /mess-01. Styles live in mess01.css, scoped under `.m01`.

type IconName = "radar" | "people" | "spark" | "arrow" | "lock";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    radar: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 3.5V12l5.8-5.8" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.8 18.5c.4-3.2 2.1-5 5.2-5s4.8 1.8 5.2 5" />
        <path d="M15 5.4a3 3 0 0 1 0 5.4M16 13.2c2.5.4 3.8 2.1 4.1 4.7" />
      </>
    ),
    spark: (
      <>
        <path d="M12 2.8c.6 4.9 2.6 7.1 7.2 7.7-4.6.6-6.6 2.8-7.2 7.7-.6-4.9-2.6-7.1-7.2-7.7C9.4 9.9 11.4 7.7 12 2.8Z" />
        <path d="M19.3 3.2c.2 1.7.9 2.4 2.5 2.6-1.6.2-2.3 1-2.5 2.7-.2-1.7-.9-2.5-2.5-2.7 1.6-.2 2.3-.9 2.5-2.6Z" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="3" />
        <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={`icon icon-${name}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

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

export default function Mess01() {
  const [selection, setSelection] = useState<"student" | "guest" | null>(null);

  // The rest of the app uses a light page background; match the design's canvas here.
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#090b14";
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  const onKey = (choice: "student" | "guest") => (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") setSelection(choice);
  };

  return (
    <main className="m01 app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="phone-frame" aria-label="tepobaby welcome screen">
        <div className="status-bar" aria-label="iOS status bar">
          <span className="time">9:41</span>
          <div className="status-icons" aria-hidden="true">
            <span className="cellular">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="wifi" />
            <span className="battery">
              <i />
            </span>
          </div>
        </div>

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
              onClick={() => setSelection("student")}
              onKeyDown={onKey("student")}
            >
              <span className="edu-chip">.edu</span>
              <span>{selection === "student" ? "Student access selected" : "Get Started with .edu Email"}</span>
              <Icon name="arrow" />
            </div>
            <p className="primary-helper">
              <Icon name="lock" />
              Verified email unlocks alumni matching, clubs & peer mocks
            </p>

            <div className="divider">
              <span />
              <p>or</p>
              <span />
            </div>

            <div
              className="guest-action"
              role="button"
              tabIndex={0}
              onClick={() => setSelection("guest")}
              onKeyDown={onKey("guest")}
            >
              {selection === "guest" ? "Browsing as guest" : "I’ll just browse around"}
            </div>
            <p className="guest-helper">Explore public job links & contractor roles without progress saving.</p>
          </div>
        </div>

        <div className="home-indicator" aria-hidden="true" />
      </section>
    </main>
  );
}
