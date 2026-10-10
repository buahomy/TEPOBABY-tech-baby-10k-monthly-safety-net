// Onboarding profiles, keyed by Google account ID (`sub`). Stored with server/store.js
// (Upstash Redis on Vercel, a JSON file locally).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const questions = JSON.parse(
  await fs.readFile(path.join(here, "..", "src", "data", "onboarding.json"), "utf8"),
);
export const STEPS = questions.steps;
const STEP_BY_ID = new Map(STEPS.map((s) => [s.id, s]));

/** Returns an error message, or null if `value` is a valid answer for step `id`. */
function validateAnswer(id, value) {
  const step = STEP_BY_ID.get(id);
  if (!step) return `Unknown question "${id}".`;

  if (step.type === "single") {
    return step.options.some((o) => o.value === value) ? null : `Invalid answer for "${id}".`;
  }
  if (step.type === "multi") {
    const allowed = new Set(step.options.map((o) => o.value));
    const ok =
      Array.isArray(value) &&
      value.length > 0 &&
      new Set(value).size === value.length &&
      value.every((v) => allowed.has(v));
    return ok ? null : `Pick at least one valid option for "${id}".`;
  }
  if (step.type === "monthYear") {
    const now = new Date().getFullYear();
    const ok =
      value &&
      typeof value === "object" &&
      Object.keys(value).length === 2 &&
      Number.isInteger(value.month) &&
      value.month >= 1 &&
      value.month <= 12 &&
      Number.isInteger(value.year) &&
      value.year >= now - 1 &&
      value.year <= now + 8;
    return ok ? null : `Invalid date for "${id}".`;
  }
  return `Unsupported question type for "${id}".`;
}

export async function getProfile(sub) {
  const p = await store.get("profiles", sub);
  if (!p) return null;
  return { ...p, answers: Object.fromEntries(Object.entries(p.answers).filter(([id]) => STEP_BY_ID.has(id))) };
}

/**
 * Merges validated answers into the user's profile. `complete: true` marks onboarding finished
 * and is only accepted once every question has an answer.
 * Throws { status: 400, message } on bad input.
 */
export async function saveAnswers(sub, email, answers, complete) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw { status: 400, message: "Expected an answers object." };
  }
  for (const [id, value] of Object.entries(answers)) {
    const problem = validateAnswer(id, value);
    if (problem) throw { status: 400, message: problem };
  }

  const now = new Date().toISOString();
  const prev = (await store.get("profiles", sub)) ?? { answers: {}, completedAt: null, createdAt: now };
  // Drop answers to questions that were removed from onboarding.json.
  const kept = Object.fromEntries(Object.entries(prev.answers).filter(([id]) => STEP_BY_ID.has(id)));
  const next = { ...prev, email, answers: { ...kept, ...answers }, updatedAt: now };

  if (complete) {
    const missing = STEPS.filter((s) => next.answers[s.id] === undefined).map((s) => s.id);
    if (missing.length) throw { status: 400, message: `Unanswered: ${missing.join(", ")}` };
    next.completedAt ??= now;
  }

  await store.set("profiles", sub, next);
  return next;
}
