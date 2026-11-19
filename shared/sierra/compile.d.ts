// Types for shared/sierra/compile.js.

export function loadSierraModule(
  tsCode: string,
  entry: string[],
  consoleShim?: Pick<Console, "log" | "error" | "warn" | "info">,
): Record<string, unknown>;

type Shim = Pick<Console, "log" | "error" | "warn" | "info">;
type Program = (...args: unknown[]) => void;

export function compileStdinProgram(tsCode: string): Program;
export function runStdinProgram(program: Program, input: string, debug?: (line: string) => void): Promise<string>;
export function loadProblemModule(problem: { kind: string; entry: string[] }, tsCode: string, consoleShim?: Shim): Record<string, unknown>;
