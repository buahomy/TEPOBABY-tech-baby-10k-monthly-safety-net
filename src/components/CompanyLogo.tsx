import { useState } from "react";

// A company's logo (served and cached by our server), falling back to its first letter.

type Props = { company: string; domain?: string | null };

export default function CompanyLogo({ company, domain }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!domain && !failed;

  return (
    <span className={`logo-tile${showImage ? " logo-tile--image" : ""}`} aria-hidden="true">
      {showImage ? (
        <img src={`/api/logo/${domain}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        company[0]
      )}
    </span>
  );
}
