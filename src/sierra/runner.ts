// Starts the Sierra test worker and collects results. If the worker sends nothing for QUIET_MS (a
// synchronous infinite loop, or a test stuck in a busy loop), it's stopped and the run reports a timeout.

export type TestResult = { part: number; name: string; passed: boolean; error?: string; ms: number; stdout: string };
export type SierraOutcome =
  | { kind: "compile"; error: string }
  | { kind: "timeout"; results: TestResult[] }
  | { kind: "done"; results: TestResult[] };

const QUIET_MS = 9000;
let worker: Worker | null = null;

const spawn = () => (worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }));

export function runSierraTests(problemId: string, code: string, upTo: number, onProgress?: (r: TestResult[]) => void): Promise<SierraOutcome> {
  const w = worker || spawn();
  const results: TestResult[] = [];
  return new Promise((resolve) => {
    let timer = 0;
    const finish = (outcome: SierraOutcome) => {
      clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      resolve(outcome);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        w.terminate();
        worker = null;
        finish({ kind: "timeout", results });
      }, QUIET_MS);
    };
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "compile") finish({ kind: "compile", error: m.error });
      else if (m.type === "test") {
        results.push({ part: m.part, name: m.name, passed: m.passed, error: m.error, ms: m.ms, stdout: m.stdout || "" });
        onProgress?.([...results]);
        arm();
      } else if (m.type === "done") finish({ kind: "done", results });
    };
    w.addEventListener("message", onMsg);
    arm();
    w.postMessage({ code, problemId, upTo });
  });
}
