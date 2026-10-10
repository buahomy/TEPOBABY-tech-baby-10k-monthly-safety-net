import Icon from "../components/Icon";
import PhoneShell from "../components/PhoneShell";
import { User } from "../utils/auth";
import { AnswerId, Profile, STEPS, labelFor } from "../utils/profile";
import "./onboarding.css";

// Placeholder home until the real feed (postings, clubs, opportunities) is built.
// It shows what was saved so students can check their answers.

type Props = {
  user: User | null; // null = guest
  profile: Profile;
  onEdit: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

const SUMMARY: AnswerId[] = ["academicLevel", "graduation", "workAuthStatus", "needsSponsorship", "firstGen"];

export default function Home({ user, profile, onEdit, onSignIn, onSignOut }: Props) {
  const firstName = user?.name.split(" ")[0];

  return (
    <PhoneShell label="tepobaby home" className="phone-frame--flex">
      <div className="ob">
        <div className="ob-step">
          <span className="ob-eyebrow">All set</span>
          <h1 className="ob-question">{firstName ? `You're in, ${firstName}.` : "You're all set."}</h1>
          <p className="ob-helper">
            {user
              ? "Your answers are saved to your account."
              : "Your answers are saved on this device. Sign in with your .edu email to keep them on any device."}{" "}
            Your home feed with postings, clubs and opportunities picked for you is coming next.
          </p>

          <dl className="ob-summary">
            {SUMMARY.map((id) => (
              <div key={id}>
                <dt>{STEPS.find((s) => s.id === id)!.question}</dt>
                <dd>{labelFor(id, profile.answers[id]) || "—"}</dd>
              </div>
            ))}
          </dl>

          <button type="button" className="primary-action ob-continue" onClick={onEdit}>
            <span>Review my answers</span>
            <Icon name="arrow" />
          </button>
          <p className="ob-helper ob-center">
            {user ? (
              <>
                {user.email} ·{" "}
                <button type="button" className="text-link" onClick={onSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                Browsing as guest ·{" "}
                <button type="button" className="text-link" onClick={onSignIn}>
                  Sign in with .edu
                </button>{" "}
                ·{" "}
                <button type="button" className="text-link" onClick={onSignOut}>
                  Clear my answers
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </PhoneShell>
  );
}
