// AI Agent results: the latest generated résumé for each saved job (score, suggestions, the curated
// résumé). Saved to the account with the rest of the student's data (accountSync), on the device for
// guests. Kept apart from aiAgent.ts so My jobs can read a score without loading the PDF code.

import { useSyncExternalStore } from "react";
import type { BankEntry } from "../../shared/agentPrompt.js";
import type { ResumeSections } from "./ginny";
import type { AtsRecord } from "./savedJobs";
import { canSaveLocally, pushKey } from "./accountSync";

export const TARGET = 85;
export const RESULTS_KEY = "tepobaby.aiAgent.v2";

export type Curated = {
  entries: { entryId: string; kind: BankEntry["kind"]; title: string; org: string; dates: string; link?: string; bullets: { bulletId: string; text: string; original: string }[] }[];
  skills: string[];
  note: string;
  sections: ResumeSections;
  dropped?: number; // bullets left out to keep the PDF to one page
};

export type Result = {
  score: number; // the generated résumé's ATS score
  baseline: number; // all of the student's resources, before curating
  history: number[]; // score after each Claude Code round
  curated: Curated | null;
  missingSkills: { skill: string; required: boolean }[];
  gaps: string[]; // requirements the résumé shows little evidence for
  suggestions: string[]; // what to add to Applicant's resources to reach the target
  description?: string;
  error?: string;
  at: string;
};

type State = Record<string, Result>;

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(RESULTS_KEY) || "null");
    if (s && typeof s === "object") return s;
  } catch {
    // ignore
  }
  return {};
}

let state: State | null = null; // read on first use, after sign-in has loaded the account's copy
const cur = () => (state ??= load());
const listeners = new Set<() => void>();

export function setResult(id: string, r: Result) {
  state = { ...cur(), [id]: r };
  try {
    if (canSaveLocally()) {
      localStorage.setItem(RESULTS_KEY, JSON.stringify(state));
      pushKey(RESULTS_KEY);
    }
  } catch {
    try {
      // Storage full: drop job descriptions (they can be fetched again) and retry.
      localStorage.setItem(RESULTS_KEY, JSON.stringify(Object.fromEntries(Object.entries(cur()).map(([k, x]) => [k, { ...x, description: undefined }]))));
    } catch {
      // keep it in memory for this visit
    }
  }
  listeners.forEach((l) => l());
}

/** After sign-in pulls the account's copy, or sign-out clears it. */
export function reloadResults() {
  state = null;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useResult = (id: string): Result | undefined => useSyncExternalStore(subscribe, () => cur()[id]);

/** The score to keep with an application when the student marks the job applied. */
export function atsRecordFor(id: string): AtsRecord | undefined {
  const r = cur()[id];
  if (!r?.curated) return undefined;
  return { score: r.score, firstScore: r.baseline, history: [r.baseline, ...r.history], target: TARGET, rounds: r.history.length, scoredAt: r.at, via: "AI Agent" };
}
