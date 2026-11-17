// Types for shared/sierra/suite.js.

export type SierraTest = { name: string; run: (mod: Record<string, unknown>) => unknown };
export type SierraTestResult = { name: string; passed: boolean; error?: string; ms: number };

export const SIERRA_SUITES: Record<string, SierraTest[][]>;
export function runSierraTest(test: SierraTest, mod: Record<string, unknown>, limitMs?: number): Promise<SierraTestResult>;
