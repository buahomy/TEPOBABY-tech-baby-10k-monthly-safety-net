# TEPOBABY-tech-baby-10k-monthly-safety-net
If you're not a nepo baby or your dad does not have hundreds of connections in line for you. Try Tepobaby: a comprehensive interview guide practice in the tech industry to get your foot into the door. This app is designed from all my personal experiences that lack of exposure to the industry and things I wish I knew earlier as a college student. 

This is only for high school and college students who need to lock in and get the job prospect off their chest in this insane market. It is not guaranteed that you would secure an offer with the use of this app, but you can interviewmaxx in every process required to get yourself where you want to be with TEPOBABY.


### Gemini Usage
By default, any responses you ask are tied to the central-usage Gemini API key that is on free tier of mine. If you run out of quota to use Gemini Chatbox for your personalized job searches. Please follow these instructions to use Gemini on your own account:
1. Go to
2. Copy API key
3. Paste it onto

Safety Assurance: Your API key is stored locally in your browser and is only sent directly to Google. I have no access to it. 


### Sign in with your .edu Google account
Tap **Get Started with .edu Email** and sign in with your school Google account.

Safety Assurance: You sign in on Google's own page, so I never see or store your password. Only verified school emails ending in .edu are let in, and this check happens on the server, so no one can skip it. After Google confirms who you are, the app only keeps your name, email and profile picture, and throws away the access Google gave it. You stay signed in for 7 days with a secure, locked login that other websites can't read or change, and you can sign out at any time.


## For developers

### Run it locally
Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill it in, see "Google sign-in setup" below
npm run dev                  # starts the web app and the auth server together
```

Open http://localhost:5173. Use `localhost`, not `127.0.0.1`, because Google only allows the origins you register.

| Command | What it does |
| --- | --- |
| `npm run dev` | Web app (Vite, port 5173) and auth server (port 8787) together |
| `npm run dev:web` | Web app only |
| `npm run dev:api` | Auth server only, reads `.env.local` |
| `npm run build` | Type-check and build the web app into `dist/` |
| `npm run start:api` | Auth server in production mode |

### Google sign-in setup
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), go to **APIs & Services → Credentials** and create an **OAuth client ID** of type **Web application**. If asked, set up the OAuth consent screen first (app name, support email, scopes `openid`, `email`, `profile`).
2. Add these to the client:
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/api/auth/google/callback`
3. Fill in `.env.local`:

| Variable | Used by | Value |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Browser | Your OAuth client ID |
| `GOOGLE_CLIENT_ID` | Server | The same client ID |
| `GOOGLE_CLIENT_SECRET` | Server | Your OAuth client secret. Never put this in a `VITE_` variable. |
| `SESSION_SECRET` | Server | Random string of 32+ characters: `openssl rand -base64 48` |
| `APP_ORIGIN` | Server | Public URL of the app, no trailing slash. `http://localhost:5173` locally. |

`.env.local` is git-ignored. Never commit real values.

### How it works
- **Google Identity Services** (authorization code flow, redirect mode) sends the page to Google's account picker. Google sends the browser back to `/api/auth/google/callback` with a one-time code. A random `state` value, checked against a cookie, rejects forged sign-ins.
- **A small Node.js/Express server** ([server/index.js](server/index.js)) exchanges the code with Google and verifies the ID token with the official `google-auth-library`. It checks the signature, that the token was issued for this app, the issuer, and the expiry.
- The server only accepts accounts whose email is **verified and ends in `.edu`**.
- It then sets its own **signed, httpOnly session cookie** (7 days, `SameSite=Lax`, `Secure` in production). Google tokens are discarded.
- Requests that change data need an `X-Requested-With` header, which blocks cross-site requests (CSRF).
- Sign-in uses a full-page redirect instead of a popup, so it also works in in-editor browsers, with strict popup blockers, and in the iPhone Home Screen app.
- The service worker never caches `/api`, so sign-in status is never stale.

API routes (the Vite dev server forwards `/api` to the auth server):

| Route | Purpose |
| --- | --- |
| `GET /api/auth/google/callback` | Google redirects here after sign-in: exchange the code and start a session |
| `GET /api/auth/me` | Current user, or `401` if signed out |
| `GET` / `PUT /api/profile` | Read / save the signed-in student's onboarding answers |
| `POST /api/auth/logout` | Sign out |

### Onboarding questions
Before reaching home, students answer 4 sections, one page each: Year of Study, Internship Eligibility & Availability, Work Authorization & Sponsorship, and Demographic & Identity Information (optional).

- The questions and answer options live in [src/data/onboarding.json](src/data/onboarding.json). Both the app and the server read this file, so edit questions there.
- Signed-in students: each section is saved with `PUT /api/profile` when they tap Continue, so they can leave and continue where they stopped. `GET /api/profile` returns the signed-in student's own answers only.
- Guests ("I'll just browse around"): answers are saved in the browser (`localStorage`, key `tepobaby.guestProfile`) on that device only. If a guest later signs in with .edu, their answers are copied into the account (answers already on the account win) and removed from the device.
- The server rejects any answer that isn't one of the listed options.
- Answers are saved as short codes for recommendations, e.g. `workAuthStatus: "f1_opt"`, `firstGen: "yes"`, `graduation: { month: 5, year: 2028 }`. Types are in [src/utils/profile.ts](src/utils/profile.ts).
- For local development, profiles are stored in `server/data/profiles.json` (git-ignored, owner-only file permissions). Move this to a real database before launch. Identity answers are sensitive: never send them to employers or third parties.

### Deploying
1. Add your real domain to both lists in Google Cloud, e.g. `https://yourdomain.com` and `https://yourdomain.com/api/auth/google/callback`.
2. Set the same variables on your host, with `APP_ORIGIN=https://yourdomain.com`.
3. Serve the site over **HTTPS**. Secure cookies and the offline service worker only work on HTTPS.
4. Run the auth server with `npm run start:api` and route `/api` on the same domain to it, so the session cookie stays first-party.
5. Before going public, publish the OAuth consent screen in Google Cloud. In "Testing" mode, only listed test users can sign in.

### Troubleshooting
| Problem | Fix |
| --- | --- |
| `redirect_uri_mismatch` or `origin_mismatch` | The URL in your browser must exactly match what's registered in Google Cloud. Use `localhost`, not `127.0.0.1`. |
| "Google sign-in isn't configured" | `VITE_GOOGLE_CLIENT_ID` is empty. Fill it in and restart `npm run dev`. |
| Auth server exits with "Missing ..." | A server variable in `.env.local` is empty, or `SESSION_SECRET` is shorter than 32 characters. |
| "Use your school Google account ending in .edu." | Working as intended: only verified `.edu` emails can sign in. |
| Back on the welcome screen with "Sign-in expired…" | The sign-in took over 10 minutes or cookies are blocked for `localhost`. Try again. |
