import "../pages/mess01.css";

// The phone frame (ambient glow, home indicator) shared by every screen.
// In the installed Home Screen app the mock home indicator is hidden by CSS.

type Props = { label: string; className?: string; children: React.ReactNode };

export default function PhoneShell({ label, className = "", children }: Props) {
  return (
    <main className="m01 app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className={`phone-frame ${className}`} aria-label={label}>
        {children}

        <div className="home-indicator" aria-hidden="true" />
      </section>
    </main>
  );
}
