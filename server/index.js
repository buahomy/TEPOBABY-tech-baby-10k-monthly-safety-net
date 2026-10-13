// Auth API for Tepobaby: Google sign-in restricted to verified .edu accounts.
//
// Flow (Google Identity Services, authorization-code model):
//   1. The browser is redirected to Google; Google redirects back to /api/auth/google/callback with a
//      one-time code (and the `state` we set, checked against a cookie to block forged callbacks).
//   2. This server exchanges the code with Google using the client secret and receives an ID token.
//   3. The ID token is verified (signature, audience, issuer, expiry) and the email must be
//      verified and end in .edu. The browser never decides who is allowed in.
//   4. We issue our own HMAC-signed, httpOnly session cookie. Google tokens are discarded.

import crypto from "node:crypto";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { feedEvents, knownDomain, queryPostings, runDailyUpdate, startJobFeed, syncFromStore } from "./jobs/index.js";
import { onVercel } from "./store.js";
import { getLogo } from "./jobs/logos.js";
import fs from "node:fs";
import { getProfile, saveAnswers } from "./profileStore.js";
import { importSaved, listSaved, removeSaved, upsertSaved } from "./savedJobsStore.js";
import { ginnyRoutes } from "./ginny/routes.js";
import { companyOptions, createSession, realtimeEnabled } from "./interview/realtime.js";
import { customExpected, getProblem, problemList, warmCache } from "./neetcode/index.js";
import { schoolForDomain } from "./connect/schools.js";

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
  if (process.env.VERCEL) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}
if (SESSION_SECRET.length < 32) {
  console.error("[auth] SESSION_SECRET must be at least 32 characters (try: openssl rand -base64 48).");
  if (process.env.VERCEL) throw new Error("SESSION_SECRET is too short");
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
app.use("/api/saved/import", express.json({ limit: "512kb" })); // up to 500 saved jobs
const globalJson = express.json({ limit: "8kb" });
app.use("/api/neetcode/expected", express.json({ limit: "64kb" })); // custom test inputs
// Skip the global parser for Ginny (raw PDF uploads) and for bodies a route-specific parser already read.
app.use((req, res, next) => (req.path.startsWith("/api/ginny/") || req._body ? next() : globalJson(req, res, next)));
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

// Google sends the browser here after the student picks an account.
app.get("/api/auth/google/callback", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const expectedState = cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: "/api/auth" });

  const fail = (code) => res.redirect(303, `/?auth_error=${encodeURIComponent(code)}`);

  if (req.query.error) {
    console.log(`[auth] sign-in cancelled at Google: ${req.query.error}`);
    return fail("cancelled");
  }
  if (!expectedState || !safeEqual(expectedState, req.query.state ?? "")) {
    console.error("[auth] sign-in rejected: state cookie missing or mismatched");
    return fail("state");
  }

  try {
    const user = await userFromCode(req.query.code, REDIRECT_URI);
    res.cookie(SESSION_COOKIE, signSession(user), sessionCookieOptions);
    console.log(`[auth] signed in @${user.email.split("@")[1]}`);
    res.redirect(303, "/");
  } catch (err) {
    console.error(`[auth] sign-in rejected: ${err instanceof AuthError ? err.code : err?.message}`);
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

// ---- Onboarding profile (signed-in users only, each user can only touch their own) ----

function requireUser(req, res, next) {
  const session = readSession(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ error: "Sign in first." });
  req.session = session;
  next();
}

app.get("/api/profile", requireUser, async (req, res) => {
  const profile = await getProfile(req.session.sub);
  res.json({ profile: profile && { answers: profile.answers, completedAt: profile.completedAt } });
});

app.put("/api/profile", requireXhr, requireUser, async (req, res) => {
  try {
    const profile = await saveAnswers(
      req.session.sub,
      req.session.email,
      req.body?.answers,
      req.body?.complete === true,
    );
    res.json({ profile: { answers: profile.answers, completedAt: profile.completedAt } });
  } catch (err) {
    if (err?.status === 400) return res.status(400).json({ error: err.message });
    console.error("[profile] save failed:", err?.message);
    res.status(500).json({ error: "Couldn't save your answers. Please try again." });
  }
});

// ---- Saved / applied jobs (signed-in users only, each user only sees their own) ----

function sendStoreError(res, err, what) {
  if (err?.status === 400) return res.status(400).json({ error: err.message });
  console.error(`[saved] ${what} failed:`, err?.message);
  res.status(500).json({ error: "Couldn't update your saved jobs. Please try again." });
}

app.get("/api/saved", requireUser, async (req, res) => {
  res.json({ jobs: await listSaved(req.session.sub) });
});

app.put("/api/saved", requireXhr, requireUser, async (req, res) => {
  try {
    res.json({ job: await upsertSaved(req.session.sub, req.body?.job) });
  } catch (err) {
    sendStoreError(res, err, "save");
  }
});

app.delete("/api/saved/:id", requireXhr, requireUser, async (req, res) => {
  try {
    await removeSaved(req.session.sub, String(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    sendStoreError(res, err, "remove");
  }
});

// Guest → account: jobs saved on the device before signing in.
app.post("/api/saved/import", requireXhr, requireUser, async (req, res) => {
  try {
    res.json({ jobs: await importSaved(req.session.sub, req.body?.jobs) });
  } catch (err) {
    sendStoreError(res, err, "import");
  }
});

// ---- Ginny: ATS match analysis + Ask Gemini (see server/ginny) ----
ginnyRoutes(app, {
  readSession: (req) => readSession(parseCookies(req.headers.cookie)[SESSION_COOKIE]),
  requireXhr,
  requireUser,
});

// ---- Interview: behavioral voice practice (OpenAI Realtime API) ----
// The browser gets a short-lived client secret; our OPENAI_API_KEY never leaves the server.

const interviewHits = new Map();
app.get("/api/interview/status", (_req, res) => {
  res.json({ enabled: realtimeEnabled(), companies: companyOptions() });
});

app.post("/api/interview/session", requireXhr, express.json({ limit: "4kb" }), async (req, res) => {
  if (!realtimeEnabled()) return res.status(503).json({ error: "Voice practice isn't set up yet (missing OPENAI_API_KEY)." });
  const session = readSession(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
  const key = session?.sub || `ip:${req.ip}`;
  const now = Date.now();
  const recent = (interviewHits.get(key) || []).filter((t) => now - t < 3600e3);
  if (recent.length >= 10) return res.status(429).json({ error: "You've started a lot of practice sessions. Try again in a bit." });
  interviewHits.set(key, [...recent, now]);

  const company = ["generic", "google", "amazon", "meta"].includes(req.body?.company) ? req.body.company : "generic";
  const level = typeof req.body?.level === "string" ? req.body.level.slice(0, 30) : "";
  const target = typeof req.body?.target === "string" ? req.body.target.slice(0, 120) : "";
  try {
    res.json(await createSession({ company, level, target }));
  } catch (err) {
    console.error("[interview] session failed:", err.message);
    res.status(err.status === 401 ? 503 : 502).json({ error: "Couldn't start a voice session. Please try again." });
  }
});

// ---- Connect: the signed-in student's school, from their .edu email domain ----

app.get("/api/connect/school", requireUser, async (req, res) => {
  const domain = String(req.session.email || "").split("@")[1] || "";
  res.json({ domain, school: await schoolForDomain(domain) });
});

// ---- Technical: NeetCode 150 (public: guests can practice too) ----
// Problems and tests come from here; students' code runs in their own browser.

app.get("/api/neetcode", (_req, res) => res.json(problemList()));

app.get("/api/neetcode/problem/:slug", async (req, res) => {
  try {
    const p = await getProblem(req.params.slug);
    if (!p) return res.status(404).json({ error: "Unknown problem." });
    res.json(p);
  } catch (err) {
    console.error("[neetcode] problem failed:", req.params.slug, err.message);
    res.status(502).json({ error: "Couldn't load this problem from LeetCode. Try again in a minute." });
  }
});

const expectedHits = new Map();
app.post("/api/neetcode/expected", requireXhr, async (req, res) => {
  const key = req.ip;
  const now = Date.now();
  const recent = (expectedHits.get(key) || []).filter((t) => now - t < 60e3);
  if (recent.length >= 40) return res.status(429).json({ error: "Too many custom runs. Wait a minute and try again." });
  expectedHits.set(key, [...recent, now]);
  const { slug, input } = req.body || {};
  if (typeof slug !== "string" || typeof input !== "string") return res.status(400).json({ error: "Missing slug or input." });
  try {
    res.json({ expected: await customExpected(slug, input) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- Job postings (public: guests see them too) ----

const LEVELS = new Set(["underclassmen", "internship", "entry", "rotational"]);

app.get("/api/postings", async (req, res) => {
  await syncFromStore();
  const level = String(req.query.level || "internship");
  if (!LEVELS.has(level)) return res.status(400).json({ error: "Unknown level." });
  // "open": every program still listed (they're kept 60 days).
  const maxHours = { week: 168, open: 60 * 24 }[req.query.window] || 72;
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  res.set("Cache-Control", "public, max-age=60");
  res.json(queryPostings({ level, maxHours, visaFriendly: req.query.visa === "1", limit, offset }));
});

// Launchpad logos: companies in "Company tiers" (src/data/tiers.json) and the programs &
// organizations suggested on Profile (src/data/communities.json). Organizations use their own
// website's icon (or an explicit `logo`) before the favicon services.
const readData = (file) => JSON.parse(fs.readFileSync(new URL(`../src/data/${file}`, import.meta.url), "utf8"));
const LAUNCHPAD = new Map([
  ...readData("tiers.json").tiers.flatMap((t) => t.companies.map((c) => [c.domain, {}])),
  ...readData("communities.json").orgs.map((o) => [o.domain, { site: o.url, logo: o.logo }]),
]);

// Company logo, fetched once and cached (see server/jobs/logos.js). Only domains that appear in
// current postings or a launchpad are served, so this can't be used as an open proxy.
app.get("/api/logo/:domain", async (req, res) => {
  const domain = String(req.params.domain).toLowerCase();
  await syncFromStore();
  if (!knownDomain(domain) && !LAUNCHPAD.has(domain)) return res.status(404).end();
  try {
    const logo = await getLogo(domain, LAUNCHPAD.get(domain));
    if (!logo) {
      res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
      return res.status(404).end();
    }
    res.set({
      "Content-Type": logo.type,
      // s-maxage lets Vercel's CDN serve repeat requests without running the function.
      "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    });
    res.send(logo.body);
  } catch {
    res.status(502).end();
  }
});

// Server-Sent Events: pushes a message to open apps whenever the postings change.
app.get("/api/postings/stream", (_req, res) => {
  // Serverless functions can't hold connections open for hours. 204 tells EventSource to stop
  // reconnecting; the app re-checks postings when the student comes back to it instead.
  if (onVercel) return res.status(204).end();
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // don't let proxies buffer the stream
  });
  res.flushHeaders();
  res.write("retry: 10000\n\n");

  const send = (data) => res.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
  feedEvents.on("update", send);
  // res "close" = the client went away (req "close" fires as soon as the request is read).
  res.on("close", () => {
    clearInterval(heartbeat);
    feedEvents.off("update", send);
  });
});

// ---- Vercel Cron: the daily 7 AM job update (see vercel.json) ----
// Vercel calls this with "Authorization: Bearer $CRON_SECRET".

app.get("/api/cron/jobs", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get("Authorization") !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const started = Date.now();
  await runDailyUpdate();
  // Re-fetch launchpad logos that have expired (each is cached for a month).
  await Promise.allSettled([...LAUNCHPAD].map(([d, opts]) => getLogo(d, opts)));
  res.json({ ok: true, seconds: Math.round((Date.now() - started) / 1000) });
});

export default app;

// Running as a normal server (local development, or any host with a lasting process).
if (!onVercel) {
  startJobFeed();
  // Fetch any NeetCode problems not cached yet (one request at a time).
  warmCache().catch((err) => console.warn("[neetcode] warm-up failed:", err.message));
  // Warm the logo cache so launchpads load instantly.
  Promise.allSettled([...LAUNCHPAD].map(([d, opts]) => getLogo(d, opts)));

  app.listen(Number(PORT), "127.0.0.1", () => {
    console.log(`[auth] listening on http://127.0.0.1:${PORT} (redirect URI ${REDIRECT_URI})`);
  });
}
