import Icon from "../../components/Icon";
import { User } from "../../utils/auth";
import { Profile, SECTIONS, STEPS, labelFor } from "../../utils/profile";

// Profile tab: account, every onboarding answer grouped by section, and edit / sign-out actions.

type Props = {
  user: User | null; // null = guest
  profile: Profile;
  onEdit: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

export default function ProfileTab({ user, profile, onEdit, onSignIn, onSignOut }: Props) {
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
              Clear my answers
            </button>
          </>
        )}
      </p>
    </div>
  );
}
