import { clubs, opportunities } from "../data/mock";
import { Profile } from "../utils/storage";

export default function OpportunitiesTab({ profile }: { profile: Profile }) {
  const early = profile.year === "Freshman" || profile.year === "Sophomore";
  const programs = opportunities.filter((o) => o.forYears.includes(profile.year));
  const recommendedClubs = clubs.filter(
    (c) =>
      (!c.forIdentity && !c.forFirstGen) ||
      (c.forFirstGen && profile.firstGen) ||
      (c.forIdentity && profile.identity && c.forIdentity.includes(profile.identity)),
  );

  return (
    <div className="grid">
      <section className="card">
        <h3>Early-career programs</h3>
        {early ? (
          <ul className="list">
            {programs.map((o) => (
              <li key={o.name}>
                <div className="row between wrap">
                  <strong>
                    {o.company} {o.name}
                  </strong>
                  <span className="muted small">{o.deadline}</span>
                </div>
                <p>{o.description}</p>
                <a href={o.link} target="_blank" rel="noreferrer">
                  Learn more ↗
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Programs like Microsoft Explore and Google STEP are for freshmen and sophomores. As a {profile.year}, focus on
            regular internships in the Jobs tab.
          </p>
        )}
      </section>

      <section className="card">
        <h3>Clubs & communities for you</h3>
        <ul className="list">
          {recommendedClubs.map((c) => (
            <li key={c.name}>
              <a href={c.link} target="_blank" rel="noreferrer">
                {c.name} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
