// Everything is stored in the browser for now. Swap for a real backend later.

export type Profile = {
  email: string;
  name: string;
  year: "Freshman" | "Sophomore" | "Junior" | "Senior" | "Grad" | "";
  university: string;
  visa: "None" | "Need CPT" | "Need OPT" | "Need CPT + OPT" | "";
  firstGen: boolean;
  identity: string;
  targetRole: string;
  resume: string;
};

export const emptyProfile: Profile = {
  email: "",
  name: "",
  year: "",
  university: "",
  visa: "",
  firstGen: false,
  identity: "",
  targetRole: "",
  resume: "",
};

const PROFILE_KEY = "tepobaby.profile";
const GEMINI_KEY = "tepobaby.geminiKey";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private window etc.) — app still works for this session.
  }
}

export function loadProfile(): Profile | null {
  const raw = read(PROFILE_KEY);
  if (!raw) return null;
  try {
    return { ...emptyProfile, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile | null) {
  write(PROFILE_KEY, p ? JSON.stringify(p) : null);
}

export function loadGeminiKey(): string {
  return read(GEMINI_KEY) ?? "";
}

export function saveGeminiKey(key: string) {
  write(GEMINI_KEY, key.trim() || null);
}
