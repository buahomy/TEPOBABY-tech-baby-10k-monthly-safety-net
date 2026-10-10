import { useState } from "react";
import { connectTemplate, infoInterviewQuestions, jobs, referralCloser } from "../data/mock";
import { matchResume } from "../utils/resumeMatch";
import { Profile } from "../utils/storage";

type Props = { profile: Profile; onProfileChange: (p: Profile) => void };

function alumniLink(companySlug: string, school: string) {
  return `https://www.linkedin.com/company/${companySlug}/people/?keywords=${encodeURIComponent(school)}`;
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export default function JobsTab({ profile, onProfileChange }: Props) {
  const [showContract, setShowContract] = useState(true);
  const [sponsorOnly, setSponsorOnly] = useState(profile.visa !== "" && profile.visa !== "None");
  const [resume, setResume] = useState(profile.resume);

  const list = jobs.filter((j) => (showContract || !j.contractor) && (!sponsorOnly || j.sponsorsVisa));

  return (
    <div className="grid">
      <section className="card">
        <h3>Your resume</h3>
        <textarea
          rows={6}
          placeholder="Paste your resume text to see how well you match each job…"
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          onBlur={() => onProfileChange({ ...profile, resume })}
        />
      </section>

      <section className="card">
        <div className="row between wrap">
          <h3>Job postings</h3>
          <div className="row wrap">
            <label className="check">
              <input type="checkbox" checked={showContract} onChange={(e) => setShowContract(e.target.checked)} />
              Include contractor roles
            </label>
            <label className="check">
              <input type="checkbox" checked={sponsorOnly} onChange={(e) => setSponsorOnly(e.target.checked)} />
              Sponsors CPT/OPT
            </label>
          </div>
        </div>
        <ul className="list">
          {list.map((j) => {
            const m = resume.trim() ? matchResume(resume, j.description) : null;
            return (
              <li key={j.id}>
                <div className="row between wrap">
                  <strong>
                    {j.title} — {j.company}
                  </strong>
                  <span className="muted small">
                    {j.location} · {j.postedHoursAgo}h ago {j.contractor && "· Contract"}
                  </span>
                </div>
                {m && (
                  <p className="small">
                    Resume match: <strong>{m.score}%</strong>
                    {m.missing.length > 0 && <span className="muted"> · Missing: {m.missing.slice(0, 6).join(", ")}</span>}
                  </p>
                )}
                <div className="row wrap">
                  <a className="button" href={j.directLink} target="_blank" rel="noreferrer">
                    Apply on company site ↗
                  </a>
                  <a className="button" href={alumniLink(j.linkedinCompany, profile.university)} target="_blank" rel="noreferrer">
                    {profile.university} alumni at {j.company} ↗
                  </a>
                  <button onClick={() => copy(connectTemplate(profile.name, profile.university, j.company))}>
                    Copy connect message
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="muted small">
          Bulk messaging is not automated: LinkedIn's terms ban automated messages and can get your account restricted.
          Copy the message and send it yourself.
        </p>
      </section>

      <section className="card">
        <h3>Informational interview playbook</h3>
        <p>You're the interviewer. Be curious about their work so you get a feel for what you'd experience.</p>
        <ol>
          {infoInterviewQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        <p>
          <strong>End with:</strong> “{referralCloser}”
        </p>
        <button onClick={() => copy([...infoInterviewQuestions, referralCloser].join("\n"))}>Copy all</button>
      </section>
    </div>
  );
}
