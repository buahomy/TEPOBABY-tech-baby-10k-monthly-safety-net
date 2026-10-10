import { useState } from "react";
import tierData from "../data/tiers.json";

// Company tiers as a launchpad: every logo is a shortcut that opens that company's careers page.

type Company = { name: string; domain: string; careers: string };
type Tier = { id: string; label: string; detail: string; color: string; companies: Company[] };

const TIERS = tierData.tiers as Tier[];

function AppIcon({ company }: { company: Company }) {
  const [failed, setFailed] = useState(false);
  return (
    <a
      className="app-icon"
      href={company.careers}
      target="_blank"
      rel="noreferrer"
      title={`${company.name} careers`}
      aria-label={`${company.name} careers (opens in a new tab)`}
    >
      <span className="app-icon-tile" aria-hidden="true">
        {failed ? (
          <span className="app-icon-letter">{company.name[0]}</span>
        ) : (
          <img src={`/api/logo/${company.domain}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        )}
      </span>
      <span className="app-icon-name">{company.name}</span>
    </a>
  );
}

export default function TierLaunchpad() {
  return (
    <div className="tier-list">
      {TIERS.map((t) => (
        <div className="tier-row" key={t.id}>
          <div className="tier-label" style={{ background: t.color }} title={t.detail}>
            {t.label}
          </div>
          <div className="tier-apps">
            {t.companies.map((c) => (
              <AppIcon key={c.name} company={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
