// Ties the app's saved state to the student's Google account instead of the device.
//
// The app keeps working from localStorage (fast, works offline), and this mirrors it to the account:
//   - At sign-in, hydrateAccount() loads the account's copy into this device (the account wins), and
//     uploads anything this device had that the account doesn't (e.g. from before this existed).
//   - Every save calls pushKey(), which writes that item to the account (debounced).
//   - Signing out clears the account's copy from the device, so the next person doesn't see it.
//   - Signing in with a different account on the same device starts clean.
// Guests have no account, so for them everything stays on the device as before.
// Personal API keys (OpenAI) are deliberately not synced: they stay on the device.

export const SYNCED_KEYS = [
  "tepobaby.aiAgent.v1",
  "tepobaby.aiAgent.fields",
  "tepobaby.resumeHeader",
  "tepobaby.feed.view",
  "tepobaby.connect.v1",
  "tepobaby.neetcode.v1",
  "tepobaby.neetcode.drafts.v1",
  "tepobaby.neetcode.lang",
  "tepobaby.technical.sub",
  "tepobaby.selectedJobId",
];
const OWNER_KEY = "tepobaby.account.owner";
const XHR = { "X-Requested-With": "XmlHttpRequest", "Content-Type": "application/json" };

let signedIn = false;
let signedOut = false; // after sign-out, until a guest session or the next sign-in
const timers = new Map<string, number>();

export const isSignedIn = () => signedIn;
/** False right after sign-out, so a screen that's still closing can't write the old account's data back. */
export const canSaveLocally = () => !signedOut;
/** Guests save on the device as usual. */
export const allowDeviceSaves = () => {
  signedOut = false;
};

const local = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // ignore
    }
  },
  remove: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  },
};

async function put(key: string, value: string | null) {
  const body = JSON.stringify({ value });
  // keepalive lets the save finish even if the page is closing (browsers allow it for small bodies).
  await fetch(`/api/me/data/${encodeURIComponent(key)}`, { method: "PUT", headers: XHR, body, keepalive: body.length < 60000 });
}

/** Loads the account's saved state into this device. Call once after sign-in, before the app renders. */
export async function hydrateAccount(user: { email: string }): Promise<void> {
  const owner = user.email.toLowerCase();
  // A different account used this device last: don't mix its data into this account.
  if (local.get(OWNER_KEY) && local.get(OWNER_KEY) !== owner) clearDeviceCopies();
  const res = await fetch("/api/me/data");
  if (!res.ok) throw new Error("Couldn't load your saved data.");
  const { values } = (await res.json()) as { values: Record<string, string> };
  for (const k of SYNCED_KEYS) {
    if (typeof values[k] === "string") local.set(k, values[k]);
    else if (local.get(k) !== null) await put(k, local.get(k)).catch(() => {}); // first time: move this device's copy up
  }
  local.set(OWNER_KEY, owner);
  signedIn = true;
  signedOut = false;
}

const firstPending = new Map<string, number>();

/**
 * Saves one item to the account, after a short pause so typing doesn't send every keystroke, but at
 * least every 3 seconds while something keeps changing (like the agent checking roles one by one).
 */
export function pushKey(key: string) {
  if (!signedIn || !SYNCED_KEYS.includes(key)) return;
  window.clearTimeout(timers.get(key));
  if (!firstPending.has(key)) firstPending.set(key, Date.now());
  const wait = Math.max(0, Math.min(800, 3000 - (Date.now() - firstPending.get(key)!)));
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key);
      firstPending.delete(key);
      put(key, local.get(key)).catch(() => {});
    }, wait),
  );
}

// Leaving the page (closing the tab, switching apps on a phone): send what's still waiting.
if (typeof window !== "undefined") {
  const flushOnLeave = () => {
    if (document.visibilityState === "hidden") flushPending();
  };
  document.addEventListener("visibilitychange", flushOnLeave);
  window.addEventListener("pagehide", () => flushPending());
}

/** Removes the account's copies from this device (on sign-out or when another account signs in). */
export function clearDeviceCopies() {
  for (const k of [...SYNCED_KEYS, OWNER_KEY, "tepobaby.experienceBank.v1"]) local.remove(k);
  try {
    indexedDB.deleteDatabase("tepobaby-files");
  } catch {
    // ignore
  }
  signedIn = false;
  signedOut = true;
}

/** Sends any pending saves right away (e.g. before signing out). */
export async function flushPending() {
  const keys = [...timers.keys()];
  for (const k of keys) window.clearTimeout(timers.get(k));
  timers.clear();
  firstPending.clear();
  await Promise.all(keys.map((k) => put(k, local.get(k)).catch(() => {})));
}
