// Google sign-in (Google Identity Services, authorization-code model, redirect mode).
// The browser never sees tokens: Google redirects back to the server with a one-time code, and the
// server (server/index.js) exchanges it, verifies the ID token, enforces the .edu rule, and sets an
// httpOnly session cookie.

export type User = { email: string; name: string; picture: string };

type CodeClient = { requestCode: () => void };
type GoogleOAuth2 = {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode: "redirect";
    redirect_uri?: string;
    state?: string;
    select_account?: boolean;
  }) => CodeClient;
};

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = "openid email profile";
const STATE_COOKIE = "tepobaby_oauth_state";

export const AUTH_ERRORS: Record<string, string> = {
  not_edu: "Use your school Google account ending in .edu.",
  unverified: "Your Google account email isn't verified.",
  cancelled: "Sign-in was cancelled.",
  state: "Sign-in expired or was tampered with. Please try again.",
  failed: "Google sign-in failed. Please try again.",
};

let gisLoad: Promise<void> | null = null;

/** Loads the Google Identity Services script early so the sign-in button responds instantly. */
export function prepareGoogleSignIn(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoad = null;
      reject(new Error("Couldn't load Google sign-in. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return gisLoad;
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Starts Google sign-in by sending the whole page to Google's account picker. Google then sends the
 * browser back to /api/auth/google/callback, the server signs the student in, and the app reloads
 * straight into onboarding. A full-page redirect works everywhere, including in-editor browsers,
 * strict popup blockers and the iOS Home Screen app, where a popup can't report back to the page.
 */
export function signInWithGoogle(): void {
  if (!CLIENT_ID) throw new Error("Google sign-in isn't configured (VITE_GOOGLE_CLIENT_ID).");
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google sign-in is still loading. Try again in a second.");

  // CSRF protection: the server only accepts the callback if `state` matches this cookie.
  const state = randomState();
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${STATE_COOKIE}=${state}; Path=/api/auth; Max-Age=600; SameSite=Lax${secure}`;

  oauth2
    .initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ux_mode: "redirect",
      redirect_uri: `${location.origin}/api/auth/google/callback`,
      state,
      select_account: true,
    })
    .requestCode();
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) return null;
    return ((await res.json()).user as User) ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-Requested-With": "XmlHttpRequest" },
  }).catch(() => {});
}
