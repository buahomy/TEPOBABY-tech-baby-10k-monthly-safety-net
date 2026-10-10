// Auth API for Tepobaby: Google sign-in restricted to verified .edu accounts.
//
// Flow (Google Identity Services, authorization-code model):
//   1. Browser gets a one-time code from Google (popup, or full redirect in the iOS Home Screen app).
//   2. This server exchanges the code with Google using the client secret and receives an ID token.
//   3. The ID token is verified (signature, audience, issuer, expiry) and the email must be
//      verified and end in .edu. The browser never decides who is allowed in.
//   4. We issue our own HMAC-signed, httpOnly session cookie. Google tokens are discarded.

import crypto from "node:crypto";
import express from "express";
import { OAuth2Client } from "google-auth-library";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SESSION_SECRET,
  APP_ORIGIN = "http://localhost:5173",
  PORT = "8787",
  NODE_ENV,
} = process.env;

const missing = Object.entries({ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`[auth] Missing ${missing.join(", ")}. Copy .env.example to .env.local and fill it in.`);
  process.exit(1);
}
if (SESSION_SECRET.length < 32) {
  console.error("[auth] SESSION_SECRET must be at least 32 characters (try: openssl rand -base64 48).");
  process.exit(1);
}

const isProd = NODE_ENV === "production";
// __Host- prefix: browser only accepts it over HTTPS, on path /, with no Domain — can't be set by subdomains.
const SESSION_COOKIE = isProd ? "__Host-tepobaby_session" : "tepobaby_session";
const STATE_COOKIE = "tepobaby_oauth_state"; // written by the browser right before the redirect flow
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REDIRECT_URI = `${APP_ORIGIN}/api/auth/google/callback`;

const google = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ---- Session cookie (stateless, HMAC-SHA256 signed) ----

function hmac(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function signSession(user) {
  const body = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

function readSession(token) {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac || !safeEqual(mac, hmac(body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof data.exp === "number" && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const sessionCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax", // lax so the cookie survives the top-level redirect back from Google
  path: "/",
  maxAge: SESSION_TTL_MS,
};

function publicUser(s) {
  return { email: s.email, name: s.name, picture: s.picture };
}

// ---- Google code exchange + .edu policy ----

async function userFromCode(code, redirectUri) {
  if (typeof code !== "string" || code.length > 2048) throw new AuthError("bad_request", "Invalid sign-in code.");

  const { tokens } = await google.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.id_token) throw new AuthError("failed", "Google did not return an ID token.");

  // Verifies signature against Google's keys, aud === our client ID, iss === accounts.google.com, exp.
  const ticket = await google.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();

  if (!p?.email || p.email_verified !== true) {
    throw new AuthError("unverified", "Your Google account email isn't verified.");
  }
  const email = p.email.toLowerCase();
  if (!email.endsWith(".edu")) {
    throw new AuthError("not_edu", "Use your school Google account ending in .edu.");
  }

  return { sub: p.sub, email, name: p.name ?? "", picture: p.picture ?? "", hd: p.hd ?? null };
}

// ---- App ----

const app = express();
app.disable("x-powered-by");
if (isProd) app.set("trust proxy", 1);
app.use(express.json({ limit: "4kb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// CSRF guard for state-changing JSON calls: a custom header can't be sent cross-site without CORS,
// and this server sends no CORS headers.
function requireXhr(req, res, next) {
  if (req.get("X-Requested-With") !== "XmlHttpRequest") return res.status(403).json({ error: "Forbidden" });
  next();
}

// Popup flow: the browser posts the code it received via postMessage.
app.post("/api/auth/google", requireXhr, async (req, res) => {
  try {
    const user = await userFromCode(req.body?.code, "postmessage");
    res.cookie(SESSION_COOKIE, signSession(user), sessionCookieOptions);
    res.json({ user: publicUser(user) });
  } catch (err) {
    const known = err instanceof AuthError;
    if (!known) console.error("[auth] code exchange failed:", err?.message);
    res.status(known && err.code !== "failed" ? 403 : 401).json({
      error: known ? err.message : "Google sign-in failed. Please try again.",
      code: known ? err.code : "failed",
    });
  }
});

// Redirect flow (iOS Home Screen app, where popups don't work).
app.get("/api/auth/google/callback", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const expectedState = cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: "/api/auth" });

  const fail = (code) => res.redirect(303, `/?auth_error=${encodeURIComponent(code)}`);

  if (req.query.error) return fail("cancelled");
  if (!expectedState || !safeEqual(expectedState, req.query.state ?? "")) return fail("state");

  try {
    const user = await userFromCode(req.query.code, REDIRECT_URI);
    res.cookie(SESSION_COOKIE, signSession(user), sessionCookieOptions);
    res.redirect(303, "/");
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("[auth] redirect exchange failed:", err?.message);
    fail(err instanceof AuthError ? err.code : "failed");
  }
});

app.get("/api/auth/me", (req, res) => {
  const session = readSession(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ user: null });
  res.json({ user: publicUser(session) });
});

app.post("/api/auth/logout", requireXhr, (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

app.listen(Number(PORT), "127.0.0.1", () => {
  console.log(`[auth] listening on http://127.0.0.1:${PORT} (redirect URI ${REDIRECT_URI})`);
});
