// Types for shared/sierra/compile.js.

export function loadSierraModule(
  tsCode: string,
  entry: string[],
  consoleShim?: Pick<Console, "log" | "error" | "warn" | "info">,
): Record<string, unknown>;
