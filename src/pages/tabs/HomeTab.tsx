import { useEffect, useState } from "react";
import CompanyLogo from "../../components/CompanyLogo";
import HeartButton from "../../components/HeartButton";
import TierLaunchpad from "../../components/TierLaunchpad";
import { LEVELS, Level, RESOURCES, WINDOWS, WindowId } from "../../data/homeFeed";
import { Posting, PostingsResponse, fetchPostings, subscribeToPostings, timeAgo } from "../../utils/postings";
import { Profile } from "../../utils/profile";
import { SavedJobsApi } from "../../utils/savedJobs";
import { canSaveLocally, pushKey } from "../../utils/accountSync";

// Home tab: 1) job postings  2) company tier list by interview difficulty  3) contractor & startup roles.

type Props = { firstName: string; profile: Profile; saved: SavedJobsApi };

/** Starts on the level that fits the student: underclassmen programs, internships, new grad roles, or rotational programs. */
function defaultLevel(profile: Profile): Level {
  const a = profile.answers;
  if (a.academicLevel === "freshman" || a.academicLevel === "sophomore") return "underclassmen";
  if (a.positionTypes?.length && a.positionTypes.every((p) => p === "rotational_ldp")) return "rotational";
  const wantsFullTime = a.positionTypes?.includes("full_time_new_grad") || a.positionTypes?.includes("rotational_ldp");
  const onlyFullTime = wantsFullTime && !a.positionTypes?.some((p) => p.includes("internship"));
  return onlyFullTime || a.academicLevel === "senior" ? "entry" : "internship";
}

const PAGE = 25;

// What the student last looked at (tab, window, filters) and how far they expanded each list with
// "Show more", kept on this device so leaving Home and coming back (or a quiet refresh when new
// postings arrive) keeps it all as they left it. "Show less" resets a list to one page.
const VIEW_KEY = "tepobaby.feed.view";
type View = {
  level?: Level;
  windowId?: WindowId;
  hideNoSponsorship?: boolean;
  countries?: Country[];
  research?: boolean;
  shown?: Record<string, number>;
};
type Country = "US" | "UK" | "CA";
const COUNTRIES: { id: Country; label: string }[] = [
  { id: "US", label: "🇺🇸 US" },
  { id: "UK", label: "🇬🇧 UK" },
  { id: "CA", label: "🇨🇦 CA" },
];
function readView(): View {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeView(patch: View) {
  try {
    if (!canSaveLocally()) return;
    localStorage.setItem(VIEW_KEY, JSON.stringify({ ...readView(), ...patch }));
    pushKey(VIEW_KEY);
  } catch {
    // ignore
  }
}
const FALLBACK_REFRESH_MS = 10 * 60 * 1000;

export default function HomeTab({ firstName, profile, saved }: Props) {
  const [level, setLevel] = useState<Level>(() => readView().level ?? defaultLevel(profile));
  const [windowId, setWindowId] = useState<WindowId>(() => readView().windowId ?? (defaultLevel(profile) === "rotational" ? "open" : "fresh"));
  const [research, setResearch] = useState(() => readView().research ?? false);
  // "All open" for programs and research roles, which stay open for weeks.
  const windows = WINDOWS.filter((w) => w.id !== "open" || level === "rotational" || research);
  const needsSponsorship =
    profile.answers.needsSponsorship === "yes" || profile.answers.workAuthorized === "no";
  const [hideNoSponsorship, setHideNoSponsorship] = useState(() => readView().hideNoSponsorship ?? needsSponsorship);
  const [countries, setCountries] = useState<Country[]>(() => (readView().countries?.length ? readView().countries! : ["US"]));
  // How many postings this list was expanded to ("Show more"), per tab + window + filter.
  const listKey = `${level}|${windowId}|${hideNoSponsorship ? 1 : 0}|${countries.join("")}|${research ? "r" : ""}`;
  const shownFor = (key: string) => Math.max(PAGE, readView().shown?.[key] ?? PAGE);
  const setShown = (key: string, n: number) => writeView({ shown: { ...(readView().shown ?? {}), [key]: n } });

  useEffect(() => {
    writeView({ level, windowId, hideNoSponsorship, countries, research });
  }, [level, windowId, hideNoSponsorship, countries, research]);

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
      // Reload as many as the student had expanded to, not just the first page.
      fetchPostings({ level, window: windowId, hideNoSponsorship, countries, research, limit: shownFor(listKey), signal: ctrl.signal })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, windowId, hideNoSponsorship, countries, research]);

  const loadMore = () => {
    setLoadingMore(true);
    const key = listKey;
    fetchPostings({ level, window: windowId, hideNoSponsorship, countries, research, limit: PAGE, offset: postings.length })
      .then((data) =>
        setPostings((prev) => {
          const next = [...prev, ...data.postings];
          setShown(key, next.length);
          return next;
        }),
      )
      .catch(() => setError("Couldn't load more postings."))
      .finally(() => setLoadingMore(false));
  };

  const showLess = () => {
    setPostings((prev) => prev.slice(0, PAGE));
    setShown(listKey, PAGE);
    document.getElementById("h-postings")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

        <div className="feed-filters" role="group" aria-label="Where and what">
          {COUNTRIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={countries.includes(c.id)}
              className={countries.includes(c.id) ? "is-on" : ""}
              onClick={() => {
                const next = countries.includes(c.id) ? countries.filter((x) => x !== c.id) : [...countries, c.id];
                setCountries(next.length ? next : [c.id]); // at least one country
              }}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={research}
            className={`feed-research${research ? " is-on" : ""}`}
            onClick={() => {
              setResearch(!research);
              if (research && windowId === "open" && level !== "rotational") setWindowId("week");
            }}
          >
            🎓 Research
          </button>
        </div>

        <div className="level-tabs" role="tablist" aria-label="Level">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={level === l.id}
              className={`level-tab${level === l.id ? " is-active" : ""}`}
              onClick={() => {
                setLevel(l.id);
                // Programs stay open for weeks, so show them all; other tabs have no "All open".
                if (l.id === "rotational") setWindowId("open");
                else if (windowId === "open") setWindowId("fresh");
              }}
            >
              <span>{l.label}</span>
              {feed && <span className="tab-count">{feed.counts[l.id][windowId]}</span>}
            </button>
          ))}
        </div>

        <div className={`segmented${windows.length === 3 ? " segmented--3" : ""}`} role="tablist" aria-label="Posted">
          {windows.map((w) => (
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
            <span title="Hides a role only when its job description says it doesn't sponsor visas or needs U.S. citizenship / a clearance">
              Hide roles that don't sponsor or need U.S. citizenship
            </span>
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
              : level === "rotational"
                ? "No rotational programs in this window. Try “All open”: most programs stay open for weeks."
                : "No new postings in this window. Try “This week”."}
          </p>
        ) : (
          <ul className="posting-list">
            {postings.map((p) => (
              <li key={p.id} className="posting-row">
                <a className="posting" href={p.url} target="_blank" rel="noreferrer">
                  <CompanyLogo company={p.company} domain={p.domain} />
                  <span className="posting-copy">
                    <span className="posting-company">{p.company}</span>
                    <span className="posting-title">{p.title}</span>
                    <span className="posting-meta">
                      <span className="posting-loc">{p.location}</span> · {timeAgo(p.postedAt, p.postedApprox)}
                      {p.program && level !== "rotational" && <span className="chip-program">Rotational program</span>}
                      {p.research && <span className="chip-research">🎓 Research</span>}
                      {p.countries?.includes("UK") && <span className="chip-country">🇬🇧</span>}
                      {p.countries?.includes("CA") && <span className="chip-country">🇨🇦</span>}
                      {p.sponsorship === "yes" && <span className="chip-ok">Sponsors visa</span>}
                      {p.sponsorship === "no" && <span className="chip-warn">No sponsorship</span>}
                      {p.sponsorship === "citizens" && <span className="chip-warn">U.S. citizens / clearance</span>}
                    </span>
                  </span>
                </a>
                <HeartButton
                  saved={saved.isSaved(p.id)}
                  label={`${p.title} at ${p.company}`}
                  onToggle={() => saved.toggle(p)}
                />
              </li>
            ))}
          </ul>
        )}
        {saved.error && <p className="ob-error">{saved.error}</p>}

        {!loading && feed && (postings.length < feed.total || postings.length > PAGE) && (
          <div className="more-row">
            {postings.length < feed.total && (
              <button type="button" className="more-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : `Show more (${feed.total - postings.length})`}
              </button>
            )}
            {postings.length > PAGE && (
              <button type="button" className="more-btn more-btn--less" onClick={showLess}>
                Show less
              </button>
            )}
          </div>
        )}
        <p className="block-foot">
          Updated every morning at 7:00 AM ET{feed?.updatedAt ? ` · last update ${timeAgo(feed.updatedAt)}` : ""}. From
          SimplifyJobs, speedyapply, company job boards (Greenhouse, Lever, Ashby), company and university career sites
          (Microsoft, Amazon, Workday, Cornell, Brown, Penn…), Hacker News and Google Jobs. Links open the original
          application.
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
                <CompanyLogo company={r.name} domain={r.domain} />
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
