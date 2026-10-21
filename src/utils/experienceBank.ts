// AI Agent: the student's experience bank. Every resume version they upload is parsed into entries
// (experiences, projects, leadership) with bullets, plus skills and education, and merged here with
// anything they type in. Duplicates across versions are merged, so each fact appears once.
// Signed in: saved to the account (/api/agent/bank). Guest: saved on this device.

import type { BankEntry } from "../../shared/agentPrompt.js";
import type { ResumeSections } from "./ginny";
import { canSaveLocally } from "./accountSync";

export type { BankEntry };
export type Bank = {
  entries: BankEntry[];
  skills: string[];
  education: string[];
  sources: { id: string; fileName: string; addedAt: string }[];
  updatedAt?: string;
};

const KEY = "tepobaby.experienceBank.v1";
const XHR = { "X-Requested-With": "XmlHttpRequest" };

export const emptyBank = (): Bank => ({ entries: [], skills: [], education: [], sources: [] });
export const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`;
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function loadBank(signedIn: boolean): Promise<Bank> {
  if (signedIn) {
    const res = await fetch("/api/agent/bank");
    if (res.ok) {
      const { bank } = await res.json();
      if (bank) return { ...emptyBank(), ...bank };
    }
  }
  try {
    const local = JSON.parse(localStorage.getItem(KEY) || "null");
    if (local?.entries) return { ...emptyBank(), ...local };
  } catch {
    // ignore
  }
  return emptyBank();
}

export async function saveBank(signedIn: boolean, bank: Bank): Promise<void> {
  try {
    if (!canSaveLocally()) return;
    localStorage.setItem(KEY, JSON.stringify(bank));
  } catch {
    // storage full: still saved to the account below when signed in
  }
  if (signedIn) {
    const res = await fetch("/api/agent/bank", { method: "PUT", headers: { ...XHR, "Content-Type": "application/json" }, body: JSON.stringify({ bank }) });
    if (!res.ok) throw new Error("Couldn't save your experience to your account. It's kept on this device for now.");
  }
}

type Parsed = {
  fileName: string;
  entries: { kind: BankEntry["kind"]; title: string; org: string; dates: string; bullets: string[] }[];
  skills: string[];
  education: string[];
};

/** Reads one resume PDF on the server (in memory, name and contact details removed). */
export async function parseResume(file: File): Promise<Parsed> {
  if (file.type && file.type !== "application/pdf") throw new Error(`${file.name}: please upload PDFs.`);
  if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: must be under 5 MB.`);
  const res = await fetch("/api/agent/parse", {
    method: "POST",
    headers: { ...XHR, "Content-Type": "application/pdf", "X-File-Name": file.name.replace(/[^\x20-\x7e]/g, "") },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${file.name}: ${data.error || "couldn't read it."}`);
  return data;
}

/** Merges a parsed resume version into the bank: same role → one entry, same bullet → one bullet. */
export function mergeParsed(bank: Bank, parsed: Parsed): Bank {
  const source = { id: uid("s"), fileName: parsed.fileName, addedAt: new Date().toISOString() };
  const entries = bank.entries.map((e) => ({ ...e, bullets: [...e.bullets] }));
  for (const p of parsed.entries) {
    const key = norm(`${p.title} ${p.org}`);
    let entry = entries.find((e) => e.kind === p.kind && norm(`${e.title} ${e.org}`) === key);
    if (!entry) {
      entry = { id: uid("e"), kind: p.kind, title: p.title, org: p.org, dates: p.dates, bullets: [] };
      entries.push(entry);
    }
    if (!entry.dates && p.dates) entry.dates = p.dates;
    for (const text of p.bullets) {
      if (!entry.bullets.some((b) => norm(b.text) === norm(text))) entry.bullets.push({ id: uid("b"), text, source: parsed.fileName });
    }
  }
  return {
    ...bank,
    entries,
    skills: mergeSkills(bank.skills, parsed.skills),
    education: [...bank.education, ...parsed.education.filter((l) => !bank.education.some((x) => norm(x) === norm(l)))],
    sources: [...bank.sources, source],
  };
}

export const mergeSkills = (have: string[], add: string[]) => {
  const out = [...have];
  for (const s of add.map((x) => x.trim()).filter(Boolean)) if (!out.some((x) => norm(x) === norm(s))) out.push(s);
  return out;
};

export const bulletCount = (b: Bank) => b.entries.reduce((n, e) => n + e.bullets.length, 0);

/** Every bullet by id, for checking what a model returns. */
export const bulletIndex = (b: Bank) => new Map(b.entries.flatMap((e) => e.bullets.map((x) => [x.id, { entry: e, bullet: x }] as const)));

const header = (e: { title: string; org: string; dates: string }) => [[e.title, e.org].filter(Boolean).join(", "), e.dates && `(${e.dates})`].filter(Boolean).join(" ");

/** Resume sections in the shape the ATS reads, from a list of entries + skills + education. */
export function sectionsFrom(entries: { kind: string; title: string; org: string; dates: string; bullets: { text: string }[] }[], skills: string[], education: string[]): ResumeSections {
  const lines = (kind: (k: string) => boolean) => entries.filter((e) => kind(e.kind)).flatMap((e) => [header(e), ...e.bullets.map((b) => b.text)]);
  return {
    experience: lines((k) => k !== "project"),
    projects: lines((k) => k === "project"),
    skills: skills.length ? [skills.join(", ")] : [],
    education,
  };
}

/** The whole bank as one resume: used for the first ATS check of each role. */
export const bankSections = (b: Bank) => sectionsFrom(b.entries, b.skills, b.education);
