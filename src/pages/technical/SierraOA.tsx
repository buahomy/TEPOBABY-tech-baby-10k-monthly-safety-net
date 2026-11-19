import { useEffect, useMemo, useState } from "react";
import {
  SIERRA_PROBLEMS,
  sierraProblemById,
} from "../../../shared/sierra/problems.js";
import type { SierraProblem } from "../../../shared/sierra/problems.js";
import {
  addMock,
  clearMockDrafts,
  markPartsPassed,
  useSierraProgress,
} from "../../sierra/progress";
import SierraWorkspace, { clock } from "./SierraWorkspace";
import SierraReflection from "./SierraReflection";
import CodeIDE from "./CodeIDE";
import { Problem, getProblem } from "../../neetcode/api";
import { useProgress } from "../../neetcode/progress";
import "./sierra.css";

// Interview → Technical → Sierra OA. Practice for Sierra's Software Engineer, Agent (new grad)
// CoderPad assessment, built from what candidates report: 2 easy coding questions + a TypeScript
// project that grows in parts + a recorded video reflection, in 60–90 minutes.
// Sections: the brief, the 1point3acres version (the format exactly as one new-grad candidate reported it),
// the practice problems (graded in the browser), a timed mock OA, and the guide.

type Mock = {
  startedAt: number;
  minutes: number;
  tasks: string[];
  passed: Record<string, number>;
  phase: "coding" | "reflect";
};
const MOCK_KEY = "tepobaby.sierra.mock"; // device only: a mock in progress isn't synced

function readMock(): Mock | null {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) || "null");
  } catch {
    return null;
  }
}
function writeMock(m: Mock | null) {
  try {
    if (m) localStorage.setItem(MOCK_KEY, JSON.stringify(m));
    else localStorage.removeItem(MOCK_KEY);
  } catch {
    // ignore
  }
}

const EASY = SIERRA_PROBLEMS.filter((p) => p.kind === "easy");

// LeetCode problems that match the OA's easy questions, opened in the NeetCode coding screen
// (same problems as in the Card Game, so solving one here also marks its card solved).
const LEETCODE = [
  {
    slug: "merge-intervals",
    n: 56,
    title: "Merge Intervals",
    level: "Medium",
    why: "Same skill as the one question labeled Sierra OA (intervals).",
  },
  {
    slug: "longest-substring-without-repeating-characters",
    n: 3,
    title: "Longest Substring Without Repeating Characters",
    level: "Medium",
    why: "Listed for the new-grad Agent role. Then try it with characters arriving one at a time.",
  },
  {
    slug: "word-ladder",
    n: 127,
    title: "Word Ladder",
    level: "Hard",
    why: "BFS. The coding problem in another Sierra online assessment.",
  },
  {
    slug: "number-of-islands",
    n: 200,
    title: "Number of Islands",
    level: "Medium",
    why: "BFS/DFS speed for graph questions.",
  },
  {
    slug: "two-sum",
    n: 1,
    title: "Two Sum",
    level: "Easy",
    why: "Hashmap warm-up. Aim for under 5 minutes.",
  },
  {
    slug: "group-anagrams",
    n: 49,
    title: "Group Anagrams",
    level: "Medium",
    why: "Hashmap and string grouping.",
  },
];
const PROJECTS = SIERRA_PROBLEMS.filter((p) => p.kind === "project");
const STDIN = SIERRA_PROBLEMS.filter((p) => p.kind === "stdin");
const pickOne = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// The stdin template for CoderPad's TypeScript (Node): read everything once, split on whitespace.
const STDIN_TEMPLATE = `const data: number[] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, n + 1);
console.log(answer);`;
const TOTAL_PARTS = SIERRA_PROBLEMS.reduce((n, p) => n + p.parts.length, 0);

export default function SierraOA() {
  const progress = useSierraProgress();
  const [open, setOpen] = useState<string | null>(null);
  const [mock, setMock] = useState<Mock | null>(readMock);
  const [setup, setSetup] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lc, setLc] = useState<{
    slug: string;
    problem?: Problem;
    error?: string;
  } | null>(null);
  const solved = useProgress([]).solved;

  const openLeetCode = (slug: string) => {
    setLc({ slug });
    getProblem(slug)
      .then((problem) =>
        setLc((cur) => (cur?.slug === slug ? { slug, problem } : cur)),
      )
      .catch((e) =>
        setLc((cur) => (cur?.slug === slug ? { slug, error: e.message } : cur)),
      );
  };

  const saveMock = (m: Mock | null) => {
    setMock(m);
    writeMock(m);
  };

  useEffect(() => {
    if (!mock || mock.phase !== "coding") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [mock]);

  const endsAt = mock ? mock.startedAt + mock.minutes * 60000 : 0;
  const timeUp = !!mock && mock.phase === "coding" && now >= endsAt;
  useEffect(() => {
    if (timeUp && mock) {
      setOpen(null);
      saveMock({ ...mock, phase: "reflect" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  const passedParts = SIERRA_PROBLEMS.reduce(
    (n, p) => n + Math.min(progress.parts[p.id] || 0, p.parts.length),
    0,
  );
  const best = progress.mocks.reduce<number | null>(
    (b, m) => (b === null || m.passed / m.total > b ? m.passed / m.total : b),
    null,
  );

  const openProblem = open ? sierraProblemById.get(open) : undefined;
  const inMock =
    !!mock && mock.phase === "coding" && !!open && mock.tasks.includes(open);

  return (
    <div className="so">
      {openProblem && (
        <SierraWorkspace
          key={(inMock ? "mock:" : "") + openProblem.id}
          problem={openProblem}
          draftKey={(inMock ? "mock:" : "") + openProblem.id}
          passed={
            inMock
              ? mock!.passed[openProblem.id] || 0
              : progress.parts[openProblem.id] || 0
          }
          onPassed={(count) => {
            if (inMock && mock) {
              const latest = readMock() || mock;
              saveMock({
                ...latest,
                passed: {
                  ...latest.passed,
                  [openProblem.id]: Math.max(
                    count,
                    latest.passed[openProblem.id] || 0,
                  ),
                },
              });
            }
            markPartsPassed(openProblem.id, count);
          }}
          onClose={() => setOpen(null)}
          mock={inMock ? { endsAt, label: "Mock OA" } : undefined}
        />
      )}

      {lc?.problem && (
        <CodeIDE problem={lc.problem} onClose={() => setLc(null)} />
      )}

      {mock ? (
        <MockView
          mock={mock}
          now={now}
          endsAt={endsAt}
          onOpen={setOpen}
          onSave={saveMock}
        />
      ) : (
        <>
          <section className="so-hero">
            <span className="so-eyebrow">
              Software Engineer, Agent · New Grad · CoderPad
            </span>
            <h2>Sierra OA</h2>
            <p>
              60–90 minutes, solo: <strong>2 easy coding questions</strong>, a{" "}
              <strong>TypeScript project that grows in parts</strong>, then a{" "}
              <strong>recorded video reflection</strong>. Practice each piece
              here, graded in your browser.
            </p>
            <div className="nc-stats">
              <div>
                <strong>
                  {passedParts}/{TOTAL_PARTS}
                </strong>
                <span>parts passed</span>
              </div>
              <div>
                <strong>{progress.mocks.length}</strong>
                <span>mock OAs</span>
              </div>
              <div>
                <strong>
                  {best === null ? "–" : `${Math.round(best * 100)}%`}
                </strong>
                <span>best mock</span>
              </div>
            </div>
            <button
              type="button"
              className="nc-primary"
              onClick={() => setSetup(true)}
            >
              Start a timed mock OA
            </button>
          </section>

          {setup && (
            <MockSetup
              onCancel={() => setSetup(false)}
              onStart={(m) => (setSetup(false), clearMockDrafts(), saveMock(m))}
            />
          )}

          <OnePoint3Acres
            parts={progress.parts}
            onOpen={setOpen}
            onMock={() => {
              clearMockDrafts();
              const second = pickOne(STDIN.filter((p) => p.id !== "stdin-max"));
              saveMock({
                startedAt: Date.now(),
                minutes: 60,
                tasks: ["stdin-max", second.id, pickOne(PROJECTS).id],
                passed: {},
                phase: "coding",
              });
            }}
          />

          <section className="so-block">
            <h3>Format at a glance</h3>
            <div className="so-tiles">
              <Tile
                k="Time"
                v="60–90 min"
                d="One sitting. The timer can't be paused."
              />
              <Tile
                k="Coding"
                v="2 easy + 1 project"
                d="Easy questions first, then a TypeScript project in ~3 parts."
              />
              <Tile
                k="Video"
                v="~90 s"
                d="Recorded at the end: what you built, tradeoffs, AI use."
              />
              <Tile
                k="AI"
                v="Check for the panel"
                d="If CoderPad shows an AI chat panel, it's allowed. No panel, no AI."
              />
            </div>
          </section>

          <section className="so-block">
            <h3>Easy questions</h3>
            <p className="nc-muted nc-small">
              Aim for about 12 minutes each, so the project gets 40+.
            </p>
            <div className="so-list">
              {EASY.map((p) => (
                <ProblemCard
                  key={p.id}
                  p={p}
                  passed={progress.parts[p.id] || 0}
                  onOpen={() => setOpen(p.id)}
                />
              ))}
            </div>
          </section>

          <section className="so-block">
            <h3>LeetCode set for the easy questions</h3>
            <p className="nc-muted nc-small">
              Graded with hidden tests like LeetCode, in JavaScript or Python
              (write TypeScript in the real OA). 12 minutes each for easy, 20
              for medium. No AI: the built-in assistant is for the project.
            </p>
            {lc?.error && (
              <p className="nc-bad nc-small">
                Couldn't load that problem: {lc.error}
              </p>
            )}
            <div className="so-list">
              {LEETCODE.map((p) => {
                const done = solved.includes(p.slug);
                return (
                  <button
                    key={p.slug}
                    type="button"
                    className={`so-card${done ? " is-done" : ""}`}
                    onClick={() => openLeetCode(p.slug)}
                  >
                    <div className="so-card-top">
                      <strong>
                        {p.n}. {p.title}
                      </strong>
                      <span
                        className={`nc-diff nc-diff--${p.level.toLowerCase()}`}
                      >
                        {p.level}
                      </span>
                    </div>
                    <p>{p.why}</p>
                    <div className="so-dots">
                      <span className={done ? "is-on" : ""}>
                        {done
                          ? "✓ Solved"
                          : lc?.slug === p.slug && !lc.problem && !lc.error
                            ? "Loading…"
                            : "Not solved yet"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="so-block">
            <h3>TypeScript projects</h3>
            <p className="nc-muted nc-small">
              Each part unlocks the next. The tests re-check earlier parts, so
              extend your code instead of rewriting it.
            </p>
            <div className="so-list">
              {PROJECTS.map((p) => (
                <ProblemCard
                  key={p.id}
                  p={p}
                  passed={progress.parts[p.id] || 0}
                  onOpen={() => setOpen(p.id)}
                />
              ))}
            </div>
          </section>

          <section className="so-block">
            <h3>Video reflection drill</h3>
            <SierraReflection />
          </section>

          <Guide />

          {progress.mocks.length > 0 && (
            <section className="so-block">
              <h3>Mock OA history</h3>
              <ul className="so-history">
                {progress.mocks.map((m) => (
                  <li key={m.at}>
                    <span>
                      {new Date(m.at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>
                      {m.passed}/{m.total} parts
                    </span>
                    <span className="nc-muted">
                      {Math.round(m.usedSec / 60)} of {m.minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// The OA exactly as 1point3acres post #1192604 (new grad, Oct 2026) reports it, with practice for each step.
function OnePoint3Acres({
  parts,
  onOpen,
  onMock,
}: {
  parts: Record<string, number>;
  onOpen: (id: string) => void;
  onMock: () => void;
}) {
  return (
    <section className="so-block so-1p3a" aria-labelledby="so-1p3a-title">
      <span className="so-eyebrow">
        1point3acres #1192604 · New grad · Oct 2026 · passed, interview invite
        the next day
      </span>
      <h3 id="so-1p3a-title">1point3acres version</h3>
      <p>
        The closest report to your OA. It describes the same three steps as the
        invite, and the bar is low: <strong>two very, very easy</strong>{" "}
        questions (one was literally "find the max"), then a TypeScript project
        in an editor like <strong>VS Code + Copilot</strong> with{" "}
        <strong>three small questions</strong> that the AI mostly answered, then
        a video about what they learned from the AI task.
      </p>

      <ol className="so-steps">
        <li>
          <strong>Two easy questions, read from standard input.</strong> The
          input arrives as text, like <code>"5\n3 -2 9 4 1\n"</code>: the count,
          then the numbers. Parsing it is the only real trap, plus edge cases
          like all-negative numbers.
        </li>
        <li>
          <strong>TypeScript project with the AI assistant.</strong> Let the
          assistant write code, but give it a plan, ask for one part at a time,
          and run the tests before moving on. Reviewers can read your prompts.
        </li>
        <li>
          <strong>Video: what you learned from the AI task.</strong> Say what
          you asked it, where it was wrong, and how you checked it. Use the
          reflection drill below.
        </li>
      </ol>

      <h4>Step 1 · stdin questions</h4>
      <p className="nc-muted nc-small">
        Whole programs graded on hidden inputs. Use about 5 minutes each. The
        first one is the reported question.
      </p>
      <pre className="so-ref-code" aria-label="Standard input template">
        {STDIN_TEMPLATE}
      </pre>
      <div className="so-list">
        {STDIN.map((p) => (
          <ProblemCard
            key={p.id}
            p={p}
            passed={parts[p.id] || 0}
            onOpen={() => onOpen(p.id)}
          />
        ))}
      </div>

      <h4>Step 2 · project with the AI</h4>
      <p className="nc-muted nc-small">
        Pick any project under TypeScript projects below and open the ✨
        assistant. Three parts, like the report.
      </p>

      <h4>Step 3 · video</h4>
      <p className="nc-muted nc-small">
        Record one take with the video reflection drill below.
      </p>

      <div className="so-1p3a-mock">
        <p>
          <strong>1point3acres-format mock:</strong> 60 minutes. Maximum
          element, one more stdin question, and a random project, then the
          video.
        </p>
        <button type="button" className="nc-primary" onClick={onMock}>
          Start the 1point3acres mock
        </button>
      </div>
    </section>
  );
}

function Tile({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="so-tile">
      <span>{k}</span>
      <strong>{v}</strong>
      <p>{d}</p>
    </div>
  );
}

function ProblemCard({
  p,
  passed,
  onOpen,
}: {
  p: SierraProblem;
  passed: number;
  onOpen: () => void;
}) {
  const done = passed >= p.parts.length;
  return (
    <button
      type="button"
      className={`so-card${done ? " is-done" : ""}`}
      onClick={onOpen}
    >
      <div className="so-card-top">
        <strong>{p.title}</strong>
        <span className="nc-muted nc-small">~{p.minutes} min</span>
      </div>
      <p>{p.reported}</p>
      <div
        className="so-dots"
        aria-label={`${Math.min(passed, p.parts.length)} of ${p.parts.length} parts passed`}
      >
        {p.parts.map((part, i) => (
          <span
            key={i}
            className={i < passed ? "is-on" : ""}
            title={part.title}
          >
            {i < passed ? "✓" : i + 1} {part.title}
          </span>
        ))}
      </div>
    </button>
  );
}

function MockSetup({
  onCancel,
  onStart,
}: {
  onCancel: () => void;
  onStart: (m: Mock) => void;
}) {
  const [minutes, setMinutes] = useState(75);
  const [project, setProject] = useState("random");
  const start = () => {
    const pick =
      project === "random"
        ? PROJECTS[Math.floor(Math.random() * PROJECTS.length)].id
        : project;
    onStart({
      startedAt: Date.now(),
      minutes,
      tasks: [...EASY.map((p) => p.id), pick],
      passed: {},
      phase: "coding",
    });
  };
  return (
    <section className="so-block so-setup" aria-label="Mock OA setup">
      <h3>Mock OA setup</h3>
      <label className="so-field">
        <span>Length</span>
        <select
          id="so-mock-minutes"
          className="nc-select"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        >
          <option value={60}>60 minutes</option>
          <option value={75}>75 minutes</option>
          <option value={90}>90 minutes</option>
        </select>
      </label>
      <label className="so-field">
        <span>Project</span>
        <select
          id="so-mock-project"
          className="nc-select"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="random">Surprise me</option>
          {PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <p className="nc-muted nc-small">
        Treat it like the real thing: one sitting, no other tabs, phone away.
        Hints work but reference solutions are hidden. You start from blank
        starter code, and when time runs out you go straight to the reflection.
      </p>
      <div className="nc-row">
        <button type="button" className="nc-primary" onClick={start}>
          Start the clock
        </button>
        <button type="button" className="nc-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function MockView({
  mock,
  now,
  endsAt,
  onOpen,
  onSave,
}: {
  mock: Mock;
  now: number;
  endsAt: number;
  onOpen: (id: string) => void;
  onSave: (m: Mock | null) => void;
}) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [saved, setSaved] = useState(false);
  const tasks = useMemo(
    () => mock.tasks.map((id) => sierraProblemById.get(id)!).filter(Boolean),
    [mock.tasks],
  );
  const passed = tasks.reduce(
    (n, p) => n + Math.min(mock.passed[p.id] || 0, p.parts.length),
    0,
  );
  const total = tasks.reduce((n, p) => n + p.parts.length, 0);
  const left = endsAt - now;

  const finish = () => {
    if (saved) return;
    addMock({
      at: new Date().toISOString(),
      minutes: mock.minutes,
      usedSec: Math.min(
        mock.minutes * 60,
        Math.round((Math.min(Date.now(), endsAt) - mock.startedAt) / 1000),
      ),
      passed,
      total,
      tasks: tasks.map((p) => ({
        id: p.id,
        passed: Math.min(mock.passed[p.id] || 0, p.parts.length),
        parts: p.parts.length,
      })),
    });
    setSaved(true);
  };

  if (mock.phase === "reflect") {
    return (
      <section className="so-block">
        <span className="so-eyebrow">Mock OA · time's up or you finished</span>
        <h3>Record your reflection</h3>
        <p className="nc-muted">
          You passed <strong>{passed}</strong> of <strong>{total}</strong>{" "}
          parts. Now do what the real assessment asks: explain it on camera.
        </p>
        <SierraReflection />
        <div className="nc-row so-gap">
          <button
            type="button"
            className="nc-primary"
            onClick={() => {
              finish();
              onSave(null);
            }}
          >
            Save result and finish
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="so-block so-mock">
      <div className="so-mock-bar">
        <div>
          <span className="so-eyebrow">Mock OA in progress</span>
          <strong
            className={`so-big-clock${left < 5 * 60000 ? " is-low" : ""}`}
          >
            {clock(left)}
          </strong>
        </div>
        <span className="nc-muted">
          {passed}/{total} parts
        </span>
      </div>
      <p className="nc-muted nc-small">
        Suggested split: 12 min per easy question, the rest on the project, 10
        min for the reflection.
      </p>
      <div className="so-list">
        {tasks.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className="so-card"
            onClick={() => onOpen(p.id)}
          >
            <div className="so-card-top">
              <strong>
                {i < 2 ? `Q${i + 1}` : "Project"} · {p.title}
              </strong>
              <span className="nc-muted nc-small">
                {Math.min(mock.passed[p.id] || 0, p.parts.length)}/
                {p.parts.length} parts
              </span>
            </div>
            <p>{p.intro.split("\n")[0].replace(/`/g, "")}</p>
          </button>
        ))}
      </div>
      <div className="nc-row so-gap">
        <button
          type="button"
          className="nc-primary"
          onClick={() => onSave({ ...mock, phase: "reflect" })}
        >
          I'm done: record my reflection
        </button>
        {confirmQuit ? (
          <button
            type="button"
            className="nc-secondary"
            onClick={() => onSave(null)}
          >
            Discard this mock
          </button>
        ) : (
          <button
            type="button"
            className="nc-secondary"
            onClick={() => setConfirmQuit(true)}
          >
            Quit
          </button>
        )}
      </div>
    </section>
  );
}

function Guide() {
  return (
    <section className="so-block so-guide">
      <h3>The guide</h3>

      <details>
        <summary>AI rules and what CoderPad records</summary>
        <ul>
          <li>
            <strong>Easy questions:</strong> probably no AI. CoderPad's built-in
            assistant only works on project-style questions.
          </li>
          <li>
            <strong>TypeScript project:</strong> probably allowed. If an AI chat
            panel appears, Sierra turned it on, and reviewers can read every
            prompt. No panel means no AI anywhere, including other tabs or your
            phone.
          </li>
          <li>
            <strong>Always recorded:</strong> a replay of your coding, including
            pastes and leaving the editor. Type your code; don't paste it.
          </li>
          <li>
            <strong>Optional:</strong> webcam snapshots (not live video),
            full-screen mode, location checks (turn your VPN off), and an AI
            follow-up asking you to explain your code.
          </li>
          <li>
            Live screens later in the process have been reported as strictly no
            AI.
          </li>
        </ul>
      </details>

      <details>
        <summary>Time plan</summary>
        <div className="so-table">
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>60 min</th>
                <th>90 min</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Read everything, check for the AI panel</td>
                <td>3</td>
                <td>5</td>
              </tr>
              <tr>
                <td>Easy Q1</td>
                <td>8</td>
                <td>12</td>
              </tr>
              <tr>
                <td>Easy Q2</td>
                <td>8</td>
                <td>12</td>
              </tr>
              <tr>
                <td>Project part 1</td>
                <td>10</td>
                <td>15</td>
              </tr>
              <tr>
                <td>Project part 2</td>
                <td>12</td>
                <td>18</td>
              </tr>
              <tr>
                <td>Project part 3</td>
                <td>12</td>
                <td>18</td>
              </tr>
              <tr>
                <td>Clean up and record the video</td>
                <td>7</td>
                <td>10</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Stuck for more than 5 minutes? Write <code>// TODO: plan is…</code>{" "}
          and move on. Never squeeze the video.
        </p>
      </details>

      <details>
        <summary>How to work during the test</summary>
        <ol>
          <li>
            Read every file and provided API first. Note the signatures you must
            keep.
          </li>
          <li>Write your plan as a comment before coding.</li>
          <li>Get part 1 working and run it before touching part 2.</li>
          <li>
            Extend, don't rewrite: small functions, clear names. That's what
            reviewers grade.
          </li>
          <li>
            Run often, and add <code>console.assert</code> checks as you go.
          </li>
          <li>
            Comment your tradeoffs, e.g.{" "}
            <code>// break keeps the history contiguous</code>.
          </li>
          <li>
            With AI: plan first, ask for narrow pieces, read and run everything
            it writes, and fix its mistakes.
          </li>
        </ol>
        <p>
          <strong>AI mistakes to catch:</strong> re-awaiting the same promise on
          retry, one timeout around the whole loop instead of each try, keeping
          the oldest messages instead of the newest, dropping the system
          message, merging intervals that only touch.
        </p>
      </details>

      <details>
        <summary>Edge cases that earn points</summary>
        <ul>
          <li>
            Empty input, an empty page, a cursor that repeats or never ends
          </li>
          <li>
            The last retry fails (rethrow), errors that shouldn't be retried
          </li>
          <li>
            One item bigger than the budget, no system message, missing token
            counts
          </li>
          <li>Touching, identical and unsorted intervals</li>
          <li>Cycles, self-references and nodes with no neighbors in graphs</li>
        </ul>
      </details>

      <details>
        <summary>How people lose</summary>
        <ol>
          <li>Running out of time on part 3 (reported more than once).</li>
          <li>Rewriting the code for each part instead of extending it.</li>
          <li>Not running code until the end.</li>
          <li>Pasting AI output without reading it.</li>
          <li>Spending too long on an easy question.</li>
          <li>Rushing or skipping the video.</li>
        </ol>
      </details>

      <details>
        <summary>After the OA: the rest of the loop</summary>
        <ol>
          <li>
            <strong>Recruiter or phone screen</strong> (30–60 min): why Sierra,
            why a startup, your language, salary. May include coding or system
            design.
          </li>
          <li>
            <strong>Take-home</strong> (~3 hrs): a customer-support AI agent
            with an LLM API key and no framework. Which features first, what
            metrics you'd track.
          </li>
          <li>
            <strong>Onsite</strong> (3 × 60 min): debugging (explain each bug's
            customer impact), take-home review with a live extension, and a
            hiring-manager behavioral.
          </li>
        </ol>
        <p>
          Since April 2026 Sierra has been moving to an AI-native loop: a system
          design screen and a Plan → Build (2 hours with AI) → Review onsite.
          Ask your recruiter which format you'll get.
        </p>
        <p>
          Values for the hiring-manager round: Trust, Customer Obsession,
          Craftsmanship, Intensity, Family. Questions candidates got: "What
          motivated you to apply to Sierra?", "Why a startup over a big
          company?", "A project: what went well and what didn't?", "Teach me a
          concept you learned in school."
        </p>
      </details>

      <details>
        <summary>Resources</summary>
        <ul className="so-links">
          <li>
            <a
              href="https://sierra.ai/blog/the-ai-native-interview"
              target="_blank"
              rel="noreferrer"
            >
              Sierra: The AI-native interview
            </a>
          </li>
          <li>
            <a
              href="https://sierra.ai/blog/meet-the-ai-agent-engineer"
              target="_blank"
              rel="noreferrer"
            >
              Sierra: Meet the AI agent engineer
            </a>
          </li>
          <li>
            <a
              href="https://sierra.ai/early-career-program"
              target="_blank"
              rel="noreferrer"
            >
              Sierra: Early career program
            </a>
          </li>
          <li>
            <a
              href="https://prachub.com/interview-guide/sierra-software-engineer-interview-questions-guide-2026"
              target="_blank"
              rel="noreferrer"
            >
              PracHub: Sierra SWE guide
            </a>
          </li>
          <li>
            <a
              href="https://prachub.com/coding-questions/process-time-intervals-and-detect-overlaps-gaps"
              target="_blank"
              rel="noreferrer"
            >
              PracHub: intervals (reported OA question)
            </a>
          </li>
          <li>
            <a
              href="https://prachub.com/interview-questions/fetch-cursor-paginated-conversation-history-and-compact-it-by-token-count"
              target="_blank"
              rel="noreferrer"
            >
              PracHub: paginated history + token compaction
            </a>
          </li>
          <li>
            <a
              href="https://vibeengines.com/handbook/fde-interview-sierra"
              target="_blank"
              rel="noreferrer"
            >
              VibeEngines: Sierra handbook
            </a>
          </li>
          <li>
            <a
              href="https://www.hellointerview.com/blog/meta-ai-enabled-coding"
              target="_blank"
              rel="noreferrer"
            >
              HelloInterview: AI-enabled CoderPad interviews
            </a>
          </li>
          <li>
            <a
              href="https://github.com/azizu06/ai-coding-interview-practice"
              target="_blank"
              rel="noreferrer"
            >
              AI coding interview practice kit
            </a>
          </li>
          <li>
            <a
              href="https://www.aced.io/questions?company=sierra-ai"
              target="_blank"
              rel="noreferrer"
            >
              aced.io: Sierra questions
            </a>
          </li>
          <li>
            <a
              href="https://gaijineer.co/sierra-software-engineer-agent-interview-experience"
              target="_blank"
              rel="noreferrer"
            >
              Gaijineer: SWE Agent experience
            </a>
          </li>
          <li>
            <a
              href="https://www.glassdoor.com/Interview/Sierra-Interview-Questions-E10032095.htm"
              target="_blank"
              rel="noreferrer"
            >
              Glassdoor: Sierra interviews
            </a>
          </li>
          <li>
            <a
              href="https://coderpad.io/resources/docs/screen/tests/cheating-prevention-detection/"
              target="_blank"
              rel="noreferrer"
            >
              CoderPad docs: what's monitored
            </a>
          </li>
          <li>
            <a
              href="https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/"
              target="_blank"
              rel="noreferrer"
            >
              AWS: exponential backoff and jitter
            </a>
          </li>
          <li>
            <a
              href="https://app.coderpad.io/sandbox"
              target="_blank"
              rel="noreferrer"
            >
              CoderPad sandbox
            </a>
          </li>
        </ul>
      </details>
    </section>
  );
}
