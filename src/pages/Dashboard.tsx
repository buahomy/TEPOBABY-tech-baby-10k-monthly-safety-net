import { useState } from "react";
import { Profile } from "../utils/storage";
import BehavioralTab from "../components/BehavioralTab";
import TechnicalTab from "../components/TechnicalTab";
import JobsTab from "../components/JobsTab";
import OpportunitiesTab from "../components/OpportunitiesTab";
import SettingsTab from "../components/SettingsTab";

const TABS = ["Behavioral", "Technical", "Jobs & Networking", "Opportunities", "Settings"] as const;
type Tab = (typeof TABS)[number];

type Props = { profile: Profile; onProfileChange: (p: Profile) => void; onSignOut: () => void };

export default function Dashboard({ profile, onProfileChange, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>("Behavioral");

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">TEPOBABY</strong>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "tab active" : "tab"} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        <div className="row">
          <span className="muted small">
            {profile.name || profile.email} · {profile.year}
          </span>
          <button className="link" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        {tab === "Behavioral" && <BehavioralTab profile={profile} />}
        {tab === "Technical" && <TechnicalTab profile={profile} />}
        {tab === "Jobs & Networking" && <JobsTab profile={profile} onProfileChange={onProfileChange} />}
        {tab === "Opportunities" && <OpportunitiesTab profile={profile} />}
        {tab === "Settings" && <SettingsTab profile={profile} onProfileChange={onProfileChange} />}
      </main>
    </div>
  );
}
