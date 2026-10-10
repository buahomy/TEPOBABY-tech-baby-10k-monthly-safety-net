import { useEffect, useState } from "react";
import CompanyLogo from "../../components/CompanyLogo";
import Icon from "../../components/Icon";
import TierLaunchpad from "../../components/TierLaunchpad";
import { LEVELS, Level, RESOURCES, WINDOWS, WindowId } from "../../data/homeFeed";
import { Posting, PostingsResponse, fetchPostings, subscribeToPostings, timeAgo } from "../../utils/postings";
import { Profile } from "../../utils/profile";

// Home tab: 1) job postings  2) company tier list by interview difficulty  3) contractor & startup roles.

type Props = { firstName: string; profile: Profile };

/** Starts on the level that fits the student: underclassmen programs, internships, or new grad roles. */
function defaultLevel(profile: Profile): Level {
  const a = profile.answers;
  if (a.academicLevel === "freshman" || a.academicLevel === "sophomore") return "underclassmen";
  const wantsFullTime = a.positionTypes?.includes("full_time_new_grad") || a.positionTypes?.includes("rotational_ldp");
  const onlyFullTime = wantsFullTime && !a.positionTypes?.some((p) => p.includes("internship"));
  return onlyFullTime || a.academicLevel === "senior" ? "entry" : "internship";
}

const PAGE = 25;
const FALLBACK_REFRESH_MS = 10 * 60 * 1000;

export default function HomeTab({ firstName, profile }: Props) {
  const [level, setLevel] = useState<Level>(() => defaultLevel(profile));
  const [windowId, setWindowId] = useState<WindowId>("fresh");
  const needsSponsorship =
    profile.answers.needsSponsorship === "yes" || profile.answers.workAuthorized === "no";
  const [hideNoSponsorship, setHideNoSponsorship] = useState(needsSponsorship);

  const [feed, setFeed] = useState<PostingsResponse | null>(null);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Load the first page whenever a filter changes. Postings update once every morning (7:00 AM ET);
  // when that update lands the server pushes a message (Server-Sent Events) and the list reloads
  // quietly. A slow timer is only a fallback if the live connection drops.
  useEffect(() => {
    const ctrl = new AbortController();
    const load = (quiet: boolean) => {
      if (!quiet) setLoading(true);
      fetchPostings({ level, window: windowId, hideNoSponsorship, limit: PAGE, signal: ctrl.signal })
        .then((data) => {
          setFeed(data);
          setPostings(data.postings);
          setError("");
        })
        .catch((e: Error) => {
          if (e.name !== "AbortError") setError("Couldn't load postings. Check your connection and try again soon.");
        })
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    };
    load(false);

    const stream = subscribeToPostings(() => load(true));
    const fallback = window.setInterval(() => load(true), FALLBACK_REFRESH_MS);
    return () => {
      ctrl.abort();
      stream();
      window.clearInterval(fallback);
    };
  }, [level, windowId, hideNoSponsorship]);

  const loadMore = () => {
    setLoadingMore(true);
    fetchPostings({ level, window: windowId, hideNoSponsorship, limit: PAGE, offset: postings.length })
      .then((data) => setPostings((prev) => [...prev, ...data.postings]))
      .catch(() => setError("Couldn't load more postings."))
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="tab-page">
      <header className="tab-header">
        <div>
          <p className="tab-kicker">Hi {firstName} 👋</p>
          <h1 className="tab-title">Here's what's new for you</h1>
        </div>
        <div className="brand-mark brand-mark--sm">
          <img className="brand-image" src="/mess-01/favicon.png" alt="" />
        </div>
      </header>

      {/* 1) Job postings */}
      <section className="block" aria-labelledby="h-postings">
        <div className="block-head">
          <h2 id="h-postings">Job postings</h2>
          <span className="block-tag block-tag--live">
            <span className="live-dot" aria-hidden="true" />
            Live
          </span>
        </div>

        <div className="level-tabs" role="tablist" aria-label="Level">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={level === l.id}
              className={`level-tab${level === l.id ? " is-active" : ""}`}
              onClick={() => setLevel(l.id)}
            >
              <span>{l.label}</span>
              {feed && <span className="tab-count">{feed.counts[l.id][windowId]}</span>}
            </button>
          ))}
        </div>

        <div className="segmented" role="tablist" aria-label="Posted">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={windowId === w.id}
              className={windowId === w.id ? "is-active" : ""}
              onClick={() => setWindowId(w.id)}
            >
              {w.label}
            </button>
          ))}
        </div>

        {needsSponsorship && (
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={hideNoSponsorship}
              onChange={(e) => setHideNoSponsorship(e.target.checked)}
            />
            <span>Hide roles that say they don't sponsor visas</span>
          </label>
        )}

        {loading ? (
          <ul className="posting-list" aria-busy="true" aria-label="Loading postings">
            {[0, 1, 2].map((i) => (
              <li key={i} className="posting posting--skeleton" />
            ))}
          </ul>
        ) : error && postings.length === 0 ? (
          <p className="empty">{error}</p>
        ) : postings.length === 0 ? (
          <p className="empty">
            {level === "underclassmen"
              ? "Programs for freshmen & sophomores (like Microsoft Explore) are rare and mostly open Aug–Oct. None were posted in this window. Try “This week”, or check Internship: many internships accept every class year."
              : "No new postings in this window. Try “This week”."}
          </p>
        ) : (
          <ul className="posting-list">
            {postings.map((p) => (
              <li key={p.id}>
                <a className="posting" href={p.url} target="_blank" rel="noreferrer">
                  <CompanyLogo company={p.company} domain={p.domain} />
                  <span className="posting-copy">
                    <span className="posting-company">{p.company}</span>
                    <span className="posting-title">{p.title}</span>
                    <span className="posting-meta">
                      <span className="posting-loc">{p.location}</span> · {timeAgo(p.postedAt, p.postedApprox)}
                      {p.sponsorship === "yes" && <span className="chip-ok">Sponsors visa</span>}
                      {p.sponsorship === "no" && <span className="chip-warn">No sponsorship</span>}
                      {p.sponsorship === "citizens" && <span className="chip-warn">U.S. citizens only</span>}
                    </span>
                  </span>
                  <Icon name="arrow" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {!loading && feed && postings.length < feed.total && (
          <button type="button" className="more-btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Show more (${feed.total - postings.length})`}
          </button>
        )}
        <p className="block-foot">
          Updated every morning at 7:00 AM ET{feed?.updatedAt ? ` · last update ${timeAgo(feed.updatedAt)}` : ""}. From
          SimplifyJobs, speedyapply, company job boards (Greenhouse, Lever, Ashby) and Hacker News. Links open the
          original application.
        </p>
      </section>

      {/* 2) Company tier list */}
      <section className="block" aria-labelledby="h-tiers">
        <div className="block-head">
          <h2 id="h-tiers">Company tiers</h2>
          <span className="block-sub">by interview difficulty</span>
        </div>

        <p className="block-note">
          Tap a logo to jump straight to that company's careers page. New roles often go live on a company's own site
          before any job list picks them up, and some never reach the lists at all, so checking the companies you care
          about every day gets you in early. Think of these as shortcuts.
        </p>
        <TierLaunchpad />
        <p className="block-foot">
          Hardest at the top, for internship and new grad interviews. Based on what students report on Glassdoor,
          LeetCode Discuss and Reddit.
        </p>
      </section>

      {/* 3) Contractor & startup roles */}
      <section className="block" aria-labelledby="h-resources">
        <div className="block-head">
          <h2 id="h-resources">Contractor & startup roles</h2>
        </div>
        <p className="block-note">
          Startup and contract roles rarely make it onto the big job lists above. Small teams often post only on their
          own sites and a few niche boards, and the roles are very specific. Going straight to these sites is the best
          way to find them.
        </p>
        <ul className="resource-list">
          {RESOURCES.map((r) => (
            <li key={r.name}>
              <a className="resource" href={r.url} target="_blank" rel="noreferrer">
                <span className="resource-copy">
                  <span className="resource-name">{r.name}</span>
                  <span className="resource-detail">{r.detail}</span>
                </span>
                <span className={`kind kind-${r.kind.toLowerCase()}`}>{r.kind}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
