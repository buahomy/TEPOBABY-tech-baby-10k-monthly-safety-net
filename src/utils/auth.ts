// Google sign-in (Google Identity Services, authorization-code model).
// The browser only obtains a one-time code; the server (server/index.js) exchanges it, verifies the
// ID token and enforces the .edu rule, then sets an httpOnly session cookie.

export type User = { email: string; name: string; picture: string };

type CodeResponse = { code?: string; state?: string; error?: string; error_description?: string };
type CodeClient = { requestCode: () => void };
type GoogleOAuth2 = {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode: "popup" | "redirect";
    redirect_uri?: string;
    state?: string;
    select_account?: boolean;
    callback?: (resp: CodeResponse) => void;
    error_callback?: (err: { type: string }) => void;
  }) => CodeClient;
};

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
  interface Navigator {
    standalone?: boolean;
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

/** Loads the Google Identity Services script. Call early so the click handler can open the popup synchronously. */
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

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

/**
 * Starts Google sign-in. Must be called directly from a click/tap handler.
 * Resolves with the user (popup flow) or "redirecting" (Home Screen app, page navigates away).
 */
export function signInWithGoogle(): Promise<User | "redirecting"> {
  if (!CLIENT_ID) return Promise.reject(new Error("Google sign-in isn't configured (VITE_GOOGLE_CLIENT_ID)."));
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) return Promise.reject(new Error("Google sign-in is still loading. Try again in a second."));

  const state = randomState();

  // Popups are unreliable inside an iOS Home Screen app, so use a full-page redirect there.
  if (isStandalone()) {
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
    return Promise.resolve("redirecting");
  }

  return new Promise((resolve, reject) => {
    oauth2
      .initCodeClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        ux_mode: "popup",
        state,
        select_account: true,
        callback: async (resp) => {
          if (resp.error || !resp.code) return reject(new Error(AUTH_ERRORS.cancelled));
          if (resp.state !== state) return reject(new Error(AUTH_ERRORS.state));
          try {
            const res = await fetch("/api/auth/google", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json", "X-Requested-With": "XmlHttpRequest" },
              body: JSON.stringify({ code: resp.code }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return reject(new Error(data.error || AUTH_ERRORS.failed));
            resolve(data.user as User);
          } catch {
            reject(new Error(AUTH_ERRORS.failed));
          }
        },
        error_callback: (err) =>
          reject(
            new Error(err.type === "popup_failed_to_open" ? "Allow pop-ups to sign in with Google." : AUTH_ERRORS.cancelled),
          ),
      })
      .requestCode();
  });
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
