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
Tap **Get Started with .edu Email** and sign in with your school Google account. You'll come right back to the app and start a few quick questions.

Safety Assurance: You sign in on Google's own page, so I never see or store your password. Only verified school emails ending in .edu are let in, and this check happens on the server, so no one can skip it. After Google confirms who you are, the app only keeps your name, email and profile picture, and throws away the access Google gave it. You stay signed in for 7 days with a secure, locked login that other websites can't read or change, and you can sign out at any time.


### Just browsing?
Tap **I'll just browse around** to use Tepobaby without signing in. You'll answer the same questions, and your answers are saved on your device only. If you sign in with your .edu email later, your answers come with you, so you can pick up where you left off.


### Getting to know you
Before your home page, Tepobaby asks 4 short sections, one page each:
1. **Year of Study**: your class standing and graduation date
2. **Internship Eligibility & Availability**: full-time availability and returning to school
3. **Work Authorization & Sponsorship**: work authorization, sponsorship needs and visa status
4. **Demographic & Identity Information**: optional, with "Prefer not to say" on every question

Your answers are used to recommend postings, resources, organizations, clubs and opportunities that fit you. You can review and change them anytime from your home page.

Safety Assurance: Your answers are saved to your own account, and no other student can see them. Identity answers are optional, only used to recommend things for you, and never shared with employers. If you browse as a guest, your answers stay on your device until you sign in.


### Environment variables
| Variable | Used by | Value |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Browser | Your OAuth client ID |
| `GOOGLE_CLIENT_ID` | Server | The same client ID |
| `GOOGLE_CLIENT_SECRET` | Server | Your OAuth client secret. Never put this in a `VITE_` variable. |
| `SESSION_SECRET` | Server | Random string of 32+ characters: `openssl rand -base64 48` |
| `APP_ORIGIN` | Server | Public URL of the app, no trailing slash. `http://localhost:5173` locally. |

`.env.local` is git-ignored. Never commit real values.

### How it works
- **Google Identity Services** (authorization code flow, redirect mode) sends the page to Google's account picker, and Google sends the browser back with a one-time code. A random `state` value is checked so forged sign-ins are rejected.
- **A small Node.js/Express server** ([server/index.js](server/index.js)) exchanges the code with Google and verifies the ID token with the official `google-auth-library`. It checks the signature, that the token was issued for this app, the issuer, and the expiry.
- The server only accepts accounts whose email is **verified and ends in `.edu`**.
- It then sets its own **signed, httpOnly session cookie** (7 days, `SameSite=Lax`, `Secure` in production). Google tokens are discarded.
- Requests that change data need an `X-Requested-With` header, which blocks cross-site requests (CSRF).
- Sign-in uses a full-page redirect instead of a popup, so it works in every browser, including the iPhone Home Screen app.
- The service worker never caches `/api`, so sign-in status is never stale.
- Onboarding questions live in [src/data/onboarding.json](src/data/onboarding.json). The server only accepts the listed answers, and saves each student's answers under their own account.

API routes (the Vite dev server forwards `/api` to the auth server):

| Route | Purpose |
| --- | --- |
| `GET /api/auth/google/callback` | Google sends the browser here after sign-in; starts the session |
| `GET /api/auth/me` | Current user, or `401` if signed out |
| `POST /api/auth/logout` | Sign out |
| `GET` / `PUT /api/profile` | Read / save the signed-in student's own answers |
