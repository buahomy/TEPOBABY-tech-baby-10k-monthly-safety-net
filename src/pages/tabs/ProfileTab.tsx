import { Suspense, lazy, useState } from "react";
import CommunityLaunchpad from "../../components/CommunityLaunchpad";
import CompanyLogo from "../../components/CompanyLogo";
import HeartButton from "../../components/HeartButton";
import Icon from "../../components/Icon";
import { User } from "../../utils/auth";
import { timeAgo } from "../../utils/postings";
import { Profile, SECTIONS, STEPS, labelFor } from "../../utils/profile";
import { JobStatus, STAGES, SavedJob, SavedJobsApi, Stage } from "../../utils/savedJobs";

// Profile tab: account, saved / applied jobs (each saved job with the AI Agent's ✨ Generate), the
// AI Agent's Applicant's resources, every onboarding answer grouped by section, and edit / sign-out.

// Loaded on first visit to Profile, so the AI Agent (and its PDF code) isn't in the app's first download.
const ApplicantResources = lazy(() => import("../AIAgent"));
const JobAgent = lazy(() => import("../AIAgent").then((m) => ({ default: m.JobAgent })));

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
  // Applied list: stable order by when you applied (changing a stage never reshuffles it).
  const list = saved.jobs
    .filter((j) => j.status === tab)
    .sort((a, b) => (tab === "applied" ? (b.appliedAt || "").localeCompare(a.appliedAt || "") : 0));
  const stageCounts = STAGES.map((st) => ({ ...st, n: list.filter((j) => (j.stage || "applied") === st.id).length })).filter((x) => x.n > 0);

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

      {tab === "applied" && list.length > 0 && (
        <>
          <div className="pipeline" aria-label="Your pipeline">
            {stageCounts.map((st) => (
              <span key={st.id} className={`stage-chip stage--${st.id}`}>
                {st.label} · {st.n}
              </span>
            ))}
          </div>
          <p className="block-foot">Applied jobs stay here until you remove them. Daily job updates never touch this list.</p>
        </>
      )}

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
                {j.status === "applied" ? (
                  <StageToggle job={j} onStage={(st) => saved.setStage(j.id, st)} onUnapply={() => saved.setStatus(j.id, "saved")} />
                ) : (
                  <Suspense
                    fallback={
                      <div className="saved-actions">
                        <button type="button" className="status-btn" onClick={() => saved.setStatus(j.id, "applied")}>
                          Mark applied
                        </button>
                      </div>
                    }
                  >
                    <JobAgent job={j} signedIn={signedIn} onApplied={(ats) => saved.setStatus(j.id, "applied", ats)} />
                  </Suspense>
                )}
                {j.status === "applied" && <ApplicationDetails job={j} />}
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

/**
 * Applied job → "Details": the résumé's ATS score for this application (kept by the AI Agent). Hover
 * (or focus) the score to see how it got there.
 */
function ApplicationDetails({ job }: { job: SavedJob }) {
  const [open, setOpen] = useState(false);
  const a = job.ats;
  const steps = a ? [a.firstScore, ...a.history.filter((x, i) => i > 0 || x !== a.firstScore)] : [];
  const tip = a
    ? [
        `Résumé ATS score for this application: ${a.score}/100${a.target ? ` (target ${a.target}+)` : ""}`,
        steps.length > 1 ? `Score by round: ${steps.join(" → ")}` : "",
        `Curated by the ${a.via}${a.rounds ? ` in ${a.rounds} round${a.rounds > 1 ? "s" : ""}` : ""}`,
        a.scoredAt ? `Scored ${new Date(a.scoredAt).toLocaleDateString()}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  return (
    <div className="app-details">
      <button type="button" className="app-details-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide details ▴" : "Details ▾"}
      </button>
      {open && (
        <div className="app-details-body">
          {a ? (
            <>
              <span className={`ats-chip${a.target && a.score >= a.target ? " is-ok" : ""}`} tabIndex={0} data-tip={tip} aria-label={tip}>
                Résumé ATS {a.score}
              </span>
              <span className="app-details-note">{steps.length > 1 ? `up from ${a.firstScore}` : "Hover for details"}</span>
            </>
          ) : (
            <span className="app-details-note">No résumé score: this application wasn't prepared with the AI Agent.</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Hiring-stage toggle for an applied job: tap to open the stages, pick one to update. */
function StageToggle({ job, onStage, onUnapply }: { job: SavedJob; onStage: (s: Stage) => void; onUnapply: () => void }) {
  const [open, setOpen] = useState(false);
  const current = STAGES.find((s) => s.id === (job.stage || "applied"))!;
  return (
    <div className="stage-toggle">
      <div className="stage-row">
        <button
          type="button"
          className={`stage-btn stage--${current.id}`}
          aria-expanded={open}
          aria-label={`Stage: ${current.label}. Change stage`}
          onClick={() => setOpen((v) => !v)}
        >
          {current.label} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
        {job.stageUpdatedAt && <span className="stage-when">updated {timeAgo(job.stageUpdatedAt)}</span>}
      </div>
      {open && (
        <div className="stage-options" role="radiogroup" aria-label="Application stage">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === current.id}
              className={`stage-chip stage--${s.id}${s.id === current.id ? " is-current" : ""}`}
              onClick={() => {
                onStage(s.id);
                setOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
          <button type="button" className="text-link stage-undo" onClick={onUnapply}>
            Move back to Saved
          </button>
        </div>
      )}
    </div>
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
      <Suspense fallback={<section className="block"><p className="empty">Loading your resources…</p></section>}>
        <ApplicantResources signedIn={!!user} />
      </Suspense>

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
