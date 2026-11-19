// Types for shared/sierra/problems.js.

export type SierraPart = { title: string; prompt: string; hint: string };
export type SierraProblem = {
  id: string;
  title: string;
  kind: "easy" | "project" | "stdin";
  minutes: number;
  reported: string;
  entry: string[];
  intro: string;
  parts: SierraPart[];
  starter: string;
  reference: string;
};

export const SIERRA_PROBLEMS: SierraProblem[];
export const sierraProblemById: Map<string, SierraProblem>;
