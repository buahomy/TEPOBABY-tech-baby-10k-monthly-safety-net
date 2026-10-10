// Onboarding answers. Signed-in students: saved on the server per Google account.
// Guests: saved in this browser only, and moved to their account if they sign in later.
// Use these later to recommend postings, resources, organizations, clubs and opportunities.

import questions from "../data/onboarding.json";

export type Option = { value: string; label: string };
export type Step = {
  id: AnswerId;
  section: string;
  type: "single" | "monthYear";
  question: string;
  helper?: string;
  options?: Option[];
};
export type Section = { id: string; title: string; note?: string };

export type MonthYear = { month: number; year: number };

export type Answers = {
  academicLevel: "freshman" | "sophomore" | "junior" | "senior";
  graduation: MonthYear;
  fullTimeAvailable: "yes" | "no";
  returningToSchool: "yes" | "no";
  workAuthorized: "yes" | "no";
  needsSponsorship: "yes" | "no";
  workAuthStatus: "us_citizen_pr" | "f1_cpt" | "f1_opt" | "h1b" | "other_visa" | "require_sponsorship";
  gender: "male" | "female" | "non_binary" | "prefer_not_to_say";
  raceEthnicity: "asian" | "black" | "hispanic_latino" | "white" | "two_or_more" | "prefer_not_to_say";
  lgbtq: "yes" | "no" | "prefer_not_to_say";
  firstGen: "yes" | "no" | "unsure" | "prefer_not_to_say";
};
export type AnswerId = keyof Answers;

export type Profile = { answers: Partial<Answers>; completedAt: string | null };

export const STEPS = questions.steps as Step[];
export const SECTIONS = questions.sections as Section[];

export async function getProfile(): Promise<Profile | null> {
  const res = await fetch("/api/profile", { credentials: "same-origin" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Couldn't load your profile.");
  return (await res.json()).profile ?? null;
}

export async function saveAnswersToServer(answers: Partial<Answers>, complete = false): Promise<Profile> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XmlHttpRequest" },
    body: JSON.stringify({ answers, complete }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't save your answer. Please try again.");
  return data.profile;
}

// ---- Guest answers (this browser only) ----

const GUEST_KEY = "tepobaby.guestProfile";

/** Returns the guest profile, or null if this browser never started browsing as a guest. */
export function loadGuestProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { answers: p.answers ?? {}, completedAt: p.completedAt ?? null };
  } catch {
    return null;
  }
}

export function startGuestProfile(): Profile {
  const existing = loadGuestProfile();
  if (existing) return existing;
  const fresh: Profile = { answers: {}, completedAt: null };
  writeGuest(fresh);
  return fresh;
}

export function clearGuestProfile() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    // ignore
  }
}

function writeGuest(p: Profile) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(p));
  } catch {
    throw new Error("Couldn't save on this device. Private browsing may block storage.");
  }
}

export async function saveAnswersAsGuest(answers: Partial<Answers>, complete = false): Promise<Profile> {
  const prev = loadGuestProfile() ?? { answers: {}, completedAt: null };
  const next: Profile = { answers: { ...prev.answers, ...answers }, completedAt: prev.completedAt };
  if (complete) {
    const missing = STEPS.filter((s) => next.answers[s.id] === undefined);
    if (missing.length) throw new Error("Please answer every question first.");
    next.completedAt ??= new Date().toISOString();
  }
  writeGuest(next);
  return next;
}

/**
 * After a guest signs in: copy their device answers into the account (answers already on the
 * account win), then forget the device copy. Returns the account's profile.
 */
export async function moveGuestAnswersToAccount(): Promise<Profile | null> {
  const server = await getProfile();
  const guest = loadGuestProfile();
  if (!guest || Object.keys(guest.answers).length === 0) {
    clearGuestProfile();
    return server;
  }

  const have = server?.answers ?? {};
  const missing = Object.fromEntries(
    Object.entries(guest.answers).filter(([id]) => have[id as AnswerId] === undefined),
  ) as Partial<Answers>;
  if (Object.keys(missing).length === 0) {
    clearGuestProfile();
    return server;
  }

  const merged = { ...have, ...missing };
  const complete = STEPS.every((s) => merged[s.id] !== undefined) && (!!guest.completedAt || !!server?.completedAt);
  const saved = await saveAnswersToServer(missing, complete);
  clearGuestProfile();
  return saved;
}

export function labelFor(id: AnswerId, value: unknown): string {
  const step = STEPS.find((s) => s.id === id);
  if (step?.type === "monthYear" && value && typeof value === "object") {
    const { month, year } = value as MonthYear;
    return `${MONTHS[month - 1]} ${year}`;
  }
  return step?.options?.find((o) => o.value === value)?.label ?? "";
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
