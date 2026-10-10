// Bottom tab bar: Home · Interview · (+) · Connect · Profile.
// The active tab's icon switches from outline to solid; "+" is the raised upload button.

export type Tab = "home" | "interview" | "connect" | "profile";

type Props = { active: Tab; onSelect: (tab: Tab) => void; onUpload: () => void };

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "interview", label: "Interview" },
  { id: "connect", label: "Connect" },
  { id: "profile", label: "Profile" },
];

function NavIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const shapes: Record<Tab, React.ReactNode> = {
    home: <path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.6v-5.6H9.6V20H5a1 1 0 0 1-1-1z" />,
    interview: (
      <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-7.5l-4.8 3.6v-3.6H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z" />
    ),
    connect: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.2 19.5c.4-3.6 2.5-5.7 5.8-5.7s5.4 2.1 5.8 5.7z" />
        <circle cx="16.6" cy="8.6" r="2.6" />
        <path d="M16.2 13.6c2.7.1 4.3 2.1 4.6 5.4h-4.1c-.2-2.1-.9-3.9-2.2-5.1.5-.2 1.1-.3 1.7-.3z" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8.5" r="3.7" />
        <path d="M4.8 20c.6-3.9 3.4-6 7.2-6s6.6 2.1 7.2 6z" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="nav-icon"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[tab]}
    </svg>
  );
}

export default function BottomNav({ active, onSelect, onUpload }: Props) {
  const item = (t: (typeof TABS)[number]) => (
    <button
      key={t.id}
      type="button"
      className={`nav-item${active === t.id ? " is-active" : ""}`}
      aria-current={active === t.id ? "page" : undefined}
      onClick={() => onSelect(t.id)}
    >
      <NavIcon tab={t.id} active={active === t.id} />
      <span>{t.label}</span>
    </button>
  );

  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.slice(0, 2).map(item)}
      <button type="button" className="nav-plus" aria-label="Upload an image" onClick={onUpload}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      </button>
      {TABS.slice(2).map(item)}
    </nav>
  );
}
