import { useState } from "react";

// Launchpad shortcut: an app-style logo tile that opens a site in a new tab.

type Props = { name: string; domain: string; href: string; title?: string; tile?: string };

export default function AppIcon({ name, domain, href, title, tile }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <a
      className="app-icon"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title || name}
      aria-label={`${title || name} (opens in a new tab)`}
    >
      <span className="app-icon-tile" aria-hidden="true" style={tile ? { background: tile } : undefined}>
        {failed ? (
          <span className="app-icon-letter">{name.replace(/^\W+/, "")[0]}</span>
        ) : (
          <img src={`/api/logo/${domain}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        )}
      </span>
      <span className="app-icon-name">{name}</span>
    </a>
  );
}
