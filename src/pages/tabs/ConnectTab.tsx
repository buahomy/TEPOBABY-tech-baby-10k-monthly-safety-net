import { useEffect, useMemo, useState } from "react";
import CompanyLogo from "../../components/CompanyLogo";
import { User } from "../../utils/auth";
import { copyText, linkedinPage, peopleUrl, searchUrl } from "../../utils/linkedin";
import { Profile } from "../../utils/profile";
import { SavedJobsApi } from "../../utils/savedJobs";
import "../connect.css";
import { canSaveLocally, pushKey } from "../../utils/accountSync";

// Connect: pick a job (or type a company), then
//   1. Find alumni from your school there: LinkedIn People tab filtered by your school, an
//      outreach message, informational interview questions, and the referral question.
//   2. Connect with recruiters there: LinkedIn People tab filtered by "technical recruiter".

type Props = {
  user: User | null;
  profile: Profile;
  saved: SavedJobsApi;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBrowse: () => void;
};

const PREFS = "tepobaby.connect.v1";
type Prefs = { name?: string; school?: string; company?: string; pages?: Record<string, string> };

function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS) || "{}");
  } catch {
    return {};
  }
}

function writePrefs(p: Prefs) {
  try {
    if (!canSaveLocally()) return;
    localStorage.setItem(PREFS, JSON.stringify(p));
    pushKey(PREFS);
  } catch {
    // ignore
  }
}

/** "whitman" from whitman.edu, as a last resort when the school isn't in the list. */
const schoolGuess = (email?: string) => {
  const d = email?.split("@")[1]?.split(".").slice(-2, -1)[0];
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : "";
};

const REFERRAL_ASK = "Would it be okay if I reached out to you again if I find any interesting roles that I think fit my experience?";

export default function ConnectTab({ user, profile, saved, selectedId, onSelect, onBrowse }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [school, setSchool] = useState(prefs.school || "");
  const [name, setName] = useState(prefs.name || user?.name || "");
  const [typed, setTyped] = useState(prefs.company || "");
  const [useTyped, setUseTyped] = useState(!saved.jobs.length && !!prefs.company);
  const [schoolSource, setSchoolSource] = useState<"saved" | "email" | "guess" | "none">(prefs.school ? "saved" : "none");

  // The school comes from the .edu email (server lookup), unless the student typed their own.
  useEffect(() => {
    if (prefs.school || !user) return;
    fetch("/api/connect/school")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.school) {
          setSchool(d.school);
          setSchoolSource("email");
        } else {
          setSchool(schoolGuess(user.email));
          setSchoolSource("guess");
        }
      })
      .catch(() => {});
  }, [user, prefs.school]);

  useEffect(() => {
    if (!prefs.name && user?.name) setName(user.name);
  }, [user, prefs.name]);

  const save = (patch: Prefs) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writePrefs(next);
  };

  const job = saved.jobs.find((j) => j.id === selectedId) || null;
  const company = (useTyped ? typed : job?.company || "").trim();
  const auto = useMemo(() => linkedinPage(company), [company]);
  const page = (company && prefs.pages?.[company.toLowerCase()]) || auto.page;
  const classOf = profile.answers.graduation?.year ? String(profile.answers.graduation.year) : "";
  const firstName = name.trim().split(/\s+/)[0] || "";

  const alumniMsg = `Hi! My name is ${name.trim() || "[your name]"}, and I also go to ${school || "[your school]"}${
    classOf ? ` (Class of ${classOf})` : ""
  }. I'd love a quick 30-min chat about breaking into the tech industry and to ask about your work at ${
    company || "[company]"
  }. Could you share your availability and the best email to schedule a time? Thank you!`;

  const role = useTyped || !job ? "software engineering roles" : `the ${job.title} role`;
  const recruiterMsg = `Hi! My name is ${name.trim() || "[your name]"}, a student at ${school || "[your school]"}${
    classOf ? ` (Class of ${classOf})` : ""
  }. I'm very interested in ${role} at ${company || "[company]"}. Would you be open to a quick chat about the role and what your team looks for? Thank you!`;

  const questions = [
    `What does a typical day or week look like for you at ${company || "your company"}?`,
    "What does your team work on, and how does your work fit into the bigger product?",
    `How did you get from ${school || "school"} to ${company || "your role"}? What helped the most?`,
    "Which skills, classes or projects made the biggest difference when you were recruiting?",
    `What does ${company || "your company"} look for in interns and new grads, and how would you prepare for the interviews?`,
    "What do you wish you had known when you were a student?",
    "What's the culture like on your team, and how do new hires get mentored?",
    "Is there anyone else you'd recommend I talk to?",
  ];

  return (
    <div className="tab-page">
      <header className="tab-header">
        <div>
          <p className="tab-kicker">Network your way in</p>
          <h1 className="tab-title">Connect</h1>
        </div>
      </header>

      {/* ---- Pick the company ---- */}
      <section className="block">
        <div className="block-head">
          <h2>Pick a job</h2>
        </div>
        {saved.jobs.length > 0 && (
          <div className="cx-jobs" role="radiogroup" aria-label="Saved jobs">
            {saved.jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                role="radio"
                aria-checked={!useTyped && j.id === selectedId}
                className={`cx-job${!useTyped && j.id === selectedId ? " is-active" : ""}`}
                onClick={() => {
                  setUseTyped(false);
                  onSelect(j.id);
                }}
              >
                <CompanyLogo company={j.company} domain={j.domain} />
                <span className="cx-job-text">
                  <strong>{j.company}</strong>
                  <small>{j.title}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        {!saved.jobs.length && (
          <p className="block-note">
            Save a job with ♥ to pick it here,{" "}
            <button type="button" className="cx-link-btn" onClick={onBrowse}>
              browse postings
            </button>
            , or type a company below.
          </p>
        )}
        <label className="cx-field">
          <span>{saved.jobs.length ? "Or type a company" : "Company"}</span>
          <input
            value={typed}
            placeholder="e.g. Google"
            onChange={(e) => {
              setTyped(e.target.value);
              setUseTyped(true);
              save({ company: e.target.value });
            }}
            onFocus={() => typed && setUseTyped(true)}
          />
        </label>

        <div className="cx-me">
          <label className="cx-field">
            <span>Your name</span>
            <input
              value={name}
              placeholder="First Last"
              onChange={(e) => {
                setName(e.target.value);
                save({ name: e.target.value });
              }}
            />
          </label>
          <label className="cx-field">
            <span>School{schoolSource === "email" ? " (from your .edu email)" : ""}</span>
            <input
              value={school}
              placeholder="e.g. Whitman College"
              onChange={(e) => {
                setSchool(e.target.value);
                setSchoolSource("saved");
                save({ school: e.target.value });
              }}
            />
          </label>
        </div>
        {schoolSource === "guess" && <p className="cx-hint">We couldn't find your school from your email. Check the name above; it's what LinkedIn filters by.</p>}
        {!user && <p className="cx-hint">Signed-in students get their school filled in from their .edu email.</p>}
      </section>

      {!company ? (
        <section className="block">
          <p className="empty">Pick a saved job or type a company to get your LinkedIn links and messages.</p>
        </section>
      ) : (
        <>
          {/* ---- 1. Alumni ---- */}
          <section className="block">
            <div className="block-head">
              <h2>
                Find alumni from {school || "your school"} at {company}
              </h2>
            </div>
            <a className="cx-linkedin" href={peopleUrl(page, school || "")} target="_blank" rel="noreferrer">
              <LinkedInMark />
              <span>
                See {company} people from {school || "your school"}
                <small>linkedin.com/company/{page}/people</small>
              </span>
            </a>
            <PageEditor
              company={company}
              page={page}
              known={auto.known && !prefs.pages?.[company.toLowerCase()]}
              fallback={searchUrl(`${company} ${school}`)}
              onChange={(p) => save({ pages: { ...(prefs.pages || {}), [company.toLowerCase()]: p } })}
            />

            <CopyCard title="Message to send" text={alumniMsg} limitNote />

            <div className="cx-sub">
              <h3>Informational interview: questions to ask</h3>
              <ol className="cx-questions">
                {questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              <CopyButton text={questions.map((q, i) => `${i + 1}. ${q}`).join("\n")} label="Copy questions" />
            </div>

            <figure className="cx-quote">
              <blockquote>“{REFERRAL_ASK}”</blockquote>
              <figcaption>
                <strong>End every chat with this.</strong> It's a polite way to set up a referral later without asking for one
                outright.
              </figcaption>
              <CopyButton text={REFERRAL_ASK} label="Copy" />
            </figure>
          </section>

          {/* ---- 2. Recruiters ---- */}
          <section className="block">
            <div className="block-head">
              <h2>Connect with recruiters at {company}</h2>
            </div>
            <a className="cx-linkedin" href={peopleUrl(page, "technical recruiter")} target="_blank" rel="noreferrer">
              <LinkedInMark />
              <span>
                See {company}'s technical recruiters
                <small>linkedin.com/company/{page}/people</small>
              </span>
            </a>
            {!auto.known && (
              <a className="cx-fallback" href={searchUrl(`${company} technical recruiter`)} target="_blank" rel="noreferrer">
                Wrong company page? Search LinkedIn instead ↗
              </a>
            )}
            <CopyCard title="Message to send" text={recruiterMsg} limitNote />
          </section>

          <p className="block-foot">
            {firstName ? `${firstName}, t` : "T"}ip: send a connection request with the message as a note, or message after they
            accept. LinkedIn opens in a new tab; Tepobaby never sees your LinkedIn account.
          </p>
        </>
      )}
    </div>
  );
}

function PageEditor({ company, page, known, fallback, onChange }: { company: string; page: string; known: boolean; fallback: string; onChange: (p: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page);
  useEffect(() => setDraft(page), [page]);
  return (
    <div className="cx-page">
      {!editing ? (
        <p>
          {known ? "LinkedIn page" : "LinkedIn page (best guess)"}: <code>{page}</code>{" "}
          <button type="button" className="cx-link-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
          {!known && (
            <>
              {" · "}
              <a href={fallback} target="_blank" rel="noreferrer">
                Search LinkedIn instead ↗
              </a>
            </>
          )}
        </p>
      ) : (
        <form
          className="cx-page-edit"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = draft.trim().replace(/^.*linkedin\.com\/company\//i, "").replace(/\/.*$/, "");
            if (clean) onChange(clean);
            setEditing(false);
          }}
        >
          <span>linkedin.com/company/</span>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`${company}'s LinkedIn page name`} autoFocus />
          <button type="submit">Save</button>
        </form>
      )}
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`cx-copy${done ? " is-done" : ""}`}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        }
      }}
    >
      {done ? "✓ Copied" : label}
    </button>
  );
}

function CopyCard({ title, text, limitNote }: { title: string; text: string; limitNote?: boolean }) {
  return (
    <div className="cx-card">
      <div className="cx-card-head">
        <h3>{title}</h3>
        <CopyButton text={text} />
      </div>
      <p className="cx-msg">{text}</p>
      {limitNote && (
        <p className={`cx-count${text.length > 300 ? " is-long" : ""}`}>
          {text.length} characters{text.length > 300 ? " · too long for a connection note (300 max); send it as a message after they accept" : " · fits a LinkedIn connection note (300 max)"}
        </p>
      )}
    </div>
  );
}

function LinkedInMark() {
  return (
    <svg className="cx-li" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.1 9.6H4.9V19h2.2V9.6ZM6 5a1.3 1.3 0 1 0 0 2.6A1.3 1.3 0 0 0 6 5Zm13 8.6c0-2.6-.6-4.2-3.4-4.2-1.4 0-2.3.7-2.6 1.4V9.6h-2.2V19H13v-4.6c0-1.2.2-2.4 1.8-2.4 1.5 0 1.5 1.4 1.5 2.5V19H19v-5.4Z"
      />
    </svg>
  );
}
