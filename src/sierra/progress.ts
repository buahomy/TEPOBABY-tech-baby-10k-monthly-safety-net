// Sierra OA practice progress: parts passed per problem, code drafts, and mock OA history.
// Saved on this device and mirrored to the student's account (see utils/accountSync.ts).

import { useEffect, useState } from "react";
import { canSaveLocally, pushKey } from "../utils/accountSync";

export const SIERRA_KEY = "tepobaby.sierra.v1";
export const SIERRA_DRAFTS = "tepobaby.sierra.drafts.v1";

export type MockResult = { at: string; minutes: number; usedSec: number; passed: number; total: number; tasks: { id: string; passed: number; parts: number }[] };
export type SierraProgress = { parts: Record<string, number>; mocks: MockResult[] };

const empty = (): SierraProgress => ({ parts: {}, mocks: [] });

function read(): SierraProgress {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(SIERRA_KEY) || "{}") };
  } catch {
    return empty();
  }
}

function save(key: string, value: unknown) {
  try {
    if (!canSaveLocally()) return;
    localStorage.setItem(key, JSON.stringify(value));
    pushKey(key);
  } catch {
    // storage full or blocked: progress just won't persist
  }
}

const listeners = new Set<(p: SierraProgress) => void>();

export function useSierraProgress() {
  const [p, setP] = useState<SierraProgress>(read);
  useEffect(() => {
    listeners.add(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}

function update(fn: (p: SierraProgress) => SierraProgress) {
  const next = fn(read());
  save(SIERRA_KEY, next);
  listeners.forEach((l) => l(next));
}

/** Records that parts 1..count of a problem pass (never lowers it). */
export const markPartsPassed = (id: string, count: number) =>
  update((p) => (count > (p.parts[id] || 0) ? { ...p, parts: { ...p.parts, [id]: count } } : p));

export const addMock = (m: MockResult) => update((p) => ({ ...p, mocks: [m, ...p.mocks].slice(0, 20) }));

// Drafts: practice drafts are keyed by problem id; a mock OA uses "mock:<id>" so it starts clean.
function readDrafts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SIERRA_DRAFTS) || "{}") || {};
  } catch {
    return {};
  }
}

export const loadSierraDraft = (key: string): string | null => readDrafts()[key] ?? null;

export function saveSierraDraft(key: string, code: string | null) {
  const d = readDrafts();
  if (code === null) delete d[key];
  else d[key] = code;
  save(SIERRA_DRAFTS, d);
}

export function clearMockDrafts() {
  const d = readDrafts();
  for (const k of Object.keys(d)) if (k.startsWith("mock:")) delete d[k];
  save(SIERRA_DRAFTS, d);
}
