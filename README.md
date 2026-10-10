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


| Variable | Used by | Value |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Browser | Your OAuth client ID |
| `GOOGLE_CLIENT_ID` | Server | The same client ID |
| `GOOGLE_CLIENT_SECRET` | Server | Your OAuth client secret. Never put this in a `VITE_` variable. |
| `SESSION_SECRET` | Server | Random string of 32+ characters: `openssl rand -base64 48` |
| `APP_ORIGIN` | Server | Public URL of the app, no trailing slash. `http://localhost:5173` locally. |

`.env.local` is git-ignored. Never commit real values.

### How it works
- **Google Identity Services** (authorization code flow) opens Google's account picker and gives the browser a one-time code. A random `state` value is checked so forged sign-ins are rejected.
- **A small Node.js/Express server** ([server/index.js](server/index.js)) exchanges the code with Google and verifies the ID token with the official `google-auth-library`. It checks the signature, that the token was issued for this app, the issuer, and the expiry.
- The server only accepts accounts whose email is **verified and ends in `.edu`**.
- It then sets its own **signed, httpOnly session cookie** (7 days, `SameSite=Lax`, `Secure` in production). Google tokens are discarded.
- Requests that change data need an `X-Requested-With` header, which blocks cross-site requests (CSRF).
- In the iPhone Home Screen app, popups don't work, so sign-in switches to a full-page redirect.
- The service worker never caches `/api`, so sign-in status is never stale.

API routes (the Vite dev server forwards `/api` to the auth server):


