// Technical-tab progress, kept on this device: the shuffled card order, which cards were flipped,
// concept guesses, solved problems, and code drafts.

import { useCallback, useEffect, useState } from "react";
import { canSaveLocally, pushKey } from "../utils/accountSync";

const KEY = "tepobaby.neetcode.v1";
const DRAFTS = "tepobaby.neetcode.drafts.v1";

export type Progress = {
  order: string[]; // card number i (1-based) shows problem order[i - 1]
  flipped: string[];
  solved: string[];
  guessed: Record<string, boolean>; // slug -> picked the right concept(s)
};

const empty = (): Progress => ({ order: [], flipped: [], solved: [], guessed: {} });

function read(): Progress {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return empty();
  }
}

function write(p: Progress) {
  try {
    if (!canSaveLocally()) return;
    localStorage.setItem(KEY, JSON.stringify(p));
    pushKey(KEY);
  } catch {
    // storage full or blocked: progress just won't persist
  }
}

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const listeners = new Set<(p: Progress) => void>();

export function useProgress(allSlugs: string[]) {
  const [p, setP] = useState<Progress>(read);

  useEffect(() => {
    listeners.add(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);

  // Deal a fresh shuffled deck the first time (or if the problem list changed).
  useEffect(() => {
    if (!allSlugs.length) return;
    const cur = read();
    const same = cur.order.length === allSlugs.length && allSlugs.every((s) => cur.order.includes(s));
    if (!same) update((x) => ({ ...x, order: shuffle(allSlugs) }));
  }, [allSlugs]);

  return p;
}

export function update(fn: (p: Progress) => Progress) {
  const next = fn(read());
  write(next);
  listeners.forEach((l) => l(next));
}

export const markFlipped = (slug: string) =>
  update((p) => (p.flipped.includes(slug) ? p : { ...p, flipped: [...p.flipped, slug] }));
export const markSolved = (slug: string) => update((p) => (p.solved.includes(slug) ? p : { ...p, solved: [...p.solved, slug] }));
export const markGuess = (slug: string, right: boolean) => update((p) => ({ ...p, guessed: { ...p.guessed, [slug]: right } }));

/** Reshuffles the cards that haven't been flipped yet; flipped cards keep their numbers. */
export function reshuffle() {
  update((p) => {
    const free = p.order.map((s, i) => (p.flipped.includes(s) ? -1 : i)).filter((i) => i >= 0);
    const moved = shuffle(free.map((i) => p.order[i]));
    const order = [...p.order];
    free.forEach((i, k) => (order[i] = moved[k]));
    return { ...p, order };
  });
}

export function resetDeck() {
  update((p) => ({ ...empty(), solved: p.solved, order: shuffle(p.order) }));
}

// ---- Code drafts ----

export function loadDraft(slug: string, lang: string): string | null {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS) || "{}")[`${slug}:${lang}`] ?? null;
  } catch {
    return null;
  }
}

export function saveDraft(slug: string, lang: string, code: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(DRAFTS) || "{}");
    if (code === null) delete all[`${slug}:${lang}`];
    else all[`${slug}:${lang}`] = code;
    if (!canSaveLocally()) return;
    localStorage.setItem(DRAFTS, JSON.stringify(all));
    pushKey(DRAFTS);
  } catch {
    // ignore
  }
}

export function useLang() {
  const [lang, setLangState] = useState<"python3" | "javascript">(() => {
    try {
      return localStorage.getItem("tepobaby.neetcode.lang") === "javascript" ? "javascript" : "python3";
    } catch {
      return "python3";
    }
  });
  const setLang = useCallback((l: "python3" | "javascript") => {
    setLangState(l);
    try {
      if (!canSaveLocally()) return;
      localStorage.setItem("tepobaby.neetcode.lang", l);
      pushKey("tepobaby.neetcode.lang");
    } catch {
      // ignore
    }
  }, []);
  return [lang, setLang] as const;
}
