import tierData from "../data/tiers.json";
import AppIcon from "./AppIcon";

// Company tiers as a launchpad: every logo is a shortcut that opens that company's careers page.

type Company = { name: string; domain: string; careers: string };
type Tier = { id: string; label: string; detail: string; color: string; companies: Company[] };

const TIERS = tierData.tiers as Tier[];

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
              <AppIcon key={c.name} name={c.name} domain={c.domain} href={c.careers} title={`${c.name} careers`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
