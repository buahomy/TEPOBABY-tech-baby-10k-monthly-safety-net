import { useState } from "react";
import communities from "../data/communities.json";
import { Answers } from "../utils/profile";
import AppIcon from "./AppIcon";

// Organizations, clubs, non-profits and programs matched to the student's answers, shown as a
// launchpad of logo shortcuts. Answers are only used here in the app to choose what to show.

type Org = {
  name: string;
  domain: string;
  url: string;
  who: string;
  for: string[];
  also?: string[];
  tile?: string;
  localLogo?: string;
};
type Group = { id: string; label: string };

const GROUPS = communities.groups as Group[];
const ORGS = communities.orgs as Org[];

/** Which groups fit this student, most specific first; "everyone" always comes last. */
export function matchingGroups(a: Partial<Answers>): string[] {
  const ids: string[] = [];
  if (a.firstGen === "yes" || a.firstGen === "unsure") ids.push("first_gen");
  if (a.raceEthnicity === "black") ids.push("black");
  if (a.raceEthnicity === "hispanic_latino") ids.push("hispanic_latino");
  if (a.raceEthnicity === "asian") ids.push("asian");
  if (a.raceEthnicity === "two_or_more") ids.push("two_or_more");
  if (a.gender === "female" || a.gender === "non_binary") ids.push("women_nonbinary");
  if (a.lgbtq === "yes") ids.push("lgbtq");
  ids.push("everyone");
  return ids;
}

export default function CommunityLaunchpad({ answers }: { answers: Partial<Answers> }) {
  const [showAll, setShowAll] = useState(false);
  const mine = matchingGroups(answers);
  const groupIds = showAll ? GROUPS.map((g) => g.id) : mine;

  // Each organization appears once, in the first group it fits.
  const shown = new Set<string>();
  const rows = groupIds
    .map((id) => {
      const orgs = ORGS.filter(
        (o) =>
          o.for.includes(id) &&
          !shown.has(o.name) &&
          // Programs with several requirements (e.g. Latinas in Tech) only show when all fit.
          (showAll || (o.also ?? []).every((t) => mine.includes(t))),
      );
      orgs.forEach((o) => shown.add(o.name));
      return { group: GROUPS.find((g) => g.id === id)!, orgs };
    })
    .filter((r) => r.orgs.length > 0);

  return (
    <div className="community">
      <h3 className="community-title">Programs & organizations for you</h3>
      <p className="block-note">
        These organizations open the door to elite connections in the industry. Members get exclusive company
        partners, recruiter events and referrals that fast-track them to interviews, and often to offers. Tap a logo to
        visit and join.
      </p>

      {rows.map(({ group, orgs }) => (
        <div className="community-group" key={group.id}>
          <p className="community-label">{group.label}</p>
          <div className="community-apps">
            {orgs.map((o) => (
              <AppIcon
                key={o.name}
                name={o.name}
                domain={o.domain}
                href={o.url}
                title={`${o.name}: ${o.who}`}
                tile={o.tile}
                logo={o.localLogo}
              />
            ))}
          </div>
        </div>
      ))}

      <button type="button" className="more-btn" onClick={() => setShowAll((v) => !v)}>
        {showAll ? "Show only programs for me" : `Show all ${ORGS.length} programs`}
      </button>
    </div>
  );
}
