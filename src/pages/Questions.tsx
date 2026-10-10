import { useState } from "react";
import Icon from "../components/Icon";
import PhoneShell from "../components/PhoneShell";
import { AnswerId, Answers, MONTHS, MonthYear, Profile, SECTIONS, STEPS } from "../utils/profile";
import "./onboarding.css";

// One page per section (Year of Study → Internship Eligibility → Work Authorization → Demographics),
// each with all of that section's questions. Answers are saved when the student taps Continue.

type Props = {
  firstName: string;
  initial: Profile | null;
  startAt?: number;
  save: (answers: Partial<Answers>, complete: boolean) => Promise<Profile>;
  onDone: (profile: Profile) => void;
};

const PAGES = SECTIONS.map((section) => ({ section, steps: STEPS.filter((s) => s.section === section.id) }));

function firstIncompletePage(answers: Partial<Answers>) {
  const i = PAGES.findIndex((p) => p.steps.some((s) => answers[s.id] === undefined));
  return i === -1 ? 0 : i;
}

/** Suggested graduation date from class standing: May of the expected final year. */
function suggestedGraduation(level: Answers["academicLevel"] | undefined): MonthYear {
  const now = new Date();
  const springYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const yearsLeft = { senior: 0, junior: 1, sophomore: 2, freshman: 3 }[level ?? "junior"];
  return { month: 5, year: springYear + yearsLeft };
}

export default function Questions({ firstName, initial, startAt, save, onDone }: Props) {
  const [answers, setAnswers] = useState<Partial<Answers>>(initial?.answers ?? {});
  const [page, setPage] = useState(() => startAt ?? firstIncompletePage(initial?.answers ?? {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { section, steps } = PAGES[page];
  const isLast = page === PAGES.length - 1;

  // Graduation shows a suggested date; treat it as answered so Continue isn't blocked.
  const pageAnswers = (): Partial<Answers> => {
    const out: Partial<Answers> = {};
    for (const s of steps) {
      const v = s.id === "graduation" ? (answers.graduation ?? suggestedGraduation(answers.academicLevel)) : answers[s.id];
      if (v !== undefined) (out as Record<string, unknown>)[s.id] = v;
    }
    return out;
  };
  const unanswered = steps.filter((s) => pageAnswers()[s.id] === undefined).length;

  const set = <K extends AnswerId>(id: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setError("");
  };

  const next = async () => {
    if (unanswered || saving) return;
    setSaving(true);
    setError("");
    try {
      const profile = await save(pageAnswers(), isLast);
      setAnswers(profile.answers);
      if (isLast) onDone(profile);
      else setPage(page + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your answers.");
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    if (page === 0 || saving) return;
    setError("");
    setPage(page - 1);
  };

  return (
    <PhoneShell label="tepobaby onboarding" className="phone-frame--flex">
      <div className="ob">
        <header className="ob-top">
          <button
            type="button"
            className="ob-back"
            onClick={back}
            disabled={page === 0 || saving}
            aria-label="Previous section"
          >
            <Icon name="back" />
          </button>
          <div
            className="ob-progress"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={1}
            aria-valuemax={PAGES.length}
            aria-valuenow={page + 1}
          >
            <span style={{ width: `${((page + 1) / PAGES.length) * 100}%` }} />
          </div>
          <span className="ob-count">
            {page + 1}/{PAGES.length}
          </span>
        </header>

        <div className="ob-step" key={section.id}>
          <span className="ob-eyebrow">
            Section {page + 1} of {PAGES.length}
          </span>
          <h1 className="ob-question">{section.title}</h1>
          {page === 0 && (
            <p className="ob-helper">Hi {firstName} 👋 A few quick questions to personalize Tepobaby.</p>
          )}
          {section.note && <p className="ob-helper">{section.note}</p>}

          {steps.map((step) => (
            <div className="ob-field" key={step.id} role="group" aria-labelledby={`q-${step.id}`}>
              <p className="ob-field-q" id={`q-${step.id}`}>
                {step.question}
              </p>
              {step.helper && <p className="ob-field-help">{step.helper}</p>}

              {step.type === "single" ? (
                <div className="ob-pills" role="radiogroup" aria-labelledby={`q-${step.id}`}>
                  {step.options!.map((o) => {
                    const selected = answers[step.id] === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`ob-pill${selected ? " is-selected" : ""}`}
                        onClick={() => set(step.id, o.value as Answers[typeof step.id])}
                      >
                        {selected && <Icon name="check" />}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <MonthYearPicker
                  value={answers.graduation ?? suggestedGraduation(answers.academicLevel)}
                  onChange={(v) => set("graduation", v)}
                />
              )}
            </div>
          ))}

          {error && (
            <p className="ob-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="ob-footer">
          <button
            type="button"
            className="primary-action ob-continue"
            disabled={!!unanswered || saving}
            onClick={next}
          >
            <span>
              {saving
                ? "Saving…"
                : unanswered
                  ? `${unanswered} question${unanswered > 1 ? "s" : ""} left`
                  : isLast
                    ? "Finish"
                    : "Continue"}
            </span>
            {!saving && !unanswered && <Icon name="arrow" />}
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}

function MonthYearPicker({ value, onChange }: { value: MonthYear; onChange: (v: MonthYear) => void }) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => thisYear + i);

  return (
    <div className="ob-picker">
      <div className="ob-months" role="group" aria-label="Month">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            type="button"
            aria-pressed={value.month === i + 1}
            className={`ob-chip${value.month === i + 1 ? " is-selected" : ""}`}
            onClick={() => onChange({ ...value, month: i + 1 })}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="ob-years" role="group" aria-label="Year">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            aria-pressed={value.year === y}
            className={`ob-chip${value.year === y ? " is-selected" : ""}`}
            onClick={() => onChange({ ...value, year: y })}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}
