import { useState } from "react";
import CommunityLaunchpad from "../../components/CommunityLaunchpad";
import CompanyLogo from "../../components/CompanyLogo";
import HeartButton from "../../components/HeartButton";
import Icon from "../../components/Icon";
import { User } from "../../utils/auth";
import { timeAgo } from "../../utils/postings";
import { Profile, SECTIONS, STEPS, labelFor } from "../../utils/profile";
import { JobStatus, SavedJobsApi } from "../../utils/savedJobs";

// Profile tab: account, saved / applied jobs, every onboarding answer grouped by section,
// and edit / sign-out actions.

type Props = {
  user: User | null; // null = guest
  profile: Profile;
  saved: SavedJobsApi;
  onBrowse: () => void;
  onEdit: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

function MyJobs({ saved, onBrowse, signedIn }: { saved: SavedJobsApi; onBrowse: () => void; signedIn: boolean }) {
  const [tab, setTab] = useState<JobStatus>("saved");
  const counts = {
    saved: saved.jobs.filter((j) => j.status === "saved").length,
    applied: saved.jobs.filter((j) => j.status === "applied").length,
  };
  const list = saved.jobs.filter((j) => j.status === tab);

  return (
    <section className="block" aria-labelledby="h-myjobs">
      <div className="block-head">
        <h2 id="h-myjobs">My jobs</h2>
        <span className="block-sub">{signedIn ? "saved to your account" : "saved on this device"}</span>
      </div>

      <div className="segmented" role="tablist" aria-label="My jobs">
        {(["saved", "applied"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "is-active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "saved" ? "♥ Saved" : "✓ Applied"} · {counts[t]}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="empty">
          {tab === "saved" ? (
            <>
              Tap the ♥ on any job posting to save it here.{" "}
              <button type="button" className="text-link" onClick={onBrowse}>
                Browse postings
              </button>
            </>
          ) : (
            "Mark a saved job as applied to track it here."
          )}
        </p>
      ) : (
        <ul className="posting-list">
          {list.map((j) => (
            <li key={j.id} className="posting-row">
              <div className="posting posting--saved">
                <a className="saved-main" href={j.url} target="_blank" rel="noreferrer">
                  <CompanyLogo company={j.company} domain={j.domain} />
                  <span className="posting-copy">
                    <span className="posting-company">{j.company}</span>
                    <span className="posting-title">{j.title}</span>
                    <span className="posting-meta">
                      <span className="posting-loc">{j.location}</span> ·{" "}
                      {j.status === "applied" && j.appliedAt ? `applied ${timeAgo(j.appliedAt)}` : `saved ${timeAgo(j.savedAt)}`}
                    </span>
                  </span>
                </a>
                <button
                  type="button"
                  className={`status-btn${j.status === "applied" ? " is-applied" : ""}`}
                  onClick={() => saved.setStatus(j.id, j.status === "applied" ? "saved" : "applied")}
                >
                  {j.status === "applied" ? "✓ Applied" : "Mark applied"}
                </button>
              </div>
              <HeartButton saved label={`${j.title} at ${j.company}`} onToggle={() => saved.remove(j.id)} />
            </li>
          ))}
        </ul>
      )}
      {saved.error && <p className="ob-error">{saved.error}</p>}
    </section>
  );
}

export default function ProfileTab({ user, profile, saved, onBrowse, onEdit, onSignIn, onSignOut }: Props) {
  const name = user?.name || "Guest";

  return (
    <div className="tab-page">
      <header className="profile-head">
        <span className="avatar" aria-hidden="true">
          {user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : name[0]}
        </span>
        <div>
          <h1 className="tab-title">{name}</h1>
          <p className="tab-kicker">
            {user ? user.email : "Browsing as guest · answers saved on this device"}
          </p>
        </div>
      </header>

      <MyJobs saved={saved} onBrowse={onBrowse} signedIn={!!user} />

      {SECTIONS.map((section) => (
        <section className="block" key={section.id} aria-label={section.title}>
          <div className="block-head">
            <h2>{section.title}</h2>
          </div>
          <dl className="answer-list">
            {STEPS.filter((s) => s.section === section.id).map((s) => (
              <div key={s.id}>
                <dt>{s.question}</dt>
                <dd>{labelFor(s.id, profile.answers[s.id]) || "—"}</dd>
              </div>
            ))}
          </dl>
          {section.id === "identity" && <CommunityLaunchpad answers={profile.answers} />}
        </section>
      ))}

      <button type="button" className="primary-action tab-cta" onClick={onEdit}>
        <span>Review my answers</span>
        <Icon name="arrow" />
      </button>
      <p className="tab-links">
        {user ? (
          <button type="button" className="text-link" onClick={onSignOut}>
            Sign out
          </button>
        ) : (
          <>
            <button type="button" className="text-link" onClick={onSignIn}>
              Sign in with .edu
            </button>{" "}
            ·{" "}
            <button type="button" className="text-link" onClick={onSignOut}>
              Clear my data
            </button>
          </>
        )}
      </p>
    </div>
  );
}
