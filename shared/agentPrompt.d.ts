// Types for shared/agentPrompt.js (used by the browser app).

export type BankBullet = { id: string; text: string; source?: string };
export type BankEntry = { id: string; kind: "experience" | "project" | "leadership"; title: string; org: string; dates: string; bullets: BankBullet[] };
export type BankForPrompt = { entries: BankEntry[]; skills: string[] };

export const CURATE_SYSTEM: string;
export const CURATE_SHAPE: string;
export function curatePrompt(p: {
  jobTitle: string;
  company: string;
  requirements: string[];
  missingSkills: string[];
  gaps: string[];
  bank: BankForPrompt;
  target: number;
  lastScore?: number | null;
  round: number;
}): string;
