# TEPOBABY-tech-baby-10k-monthly-safety-net
If you're not a nepo baby or your dad does not have hundreds of connections in line for you. Try Tepobaby: a comprehensive interview guide practice in the tech industry to get your foot into the door. This app is designed from all my personal experiences that lack of exposure to the industry and things I wish I knew earlier as a college student. 

This is only for high school and college students who need to lock in and get the job prospect off their chest in this insane market. It is not guaranteed that you would secure an offer with the use of this app, but you can interviewmaxx in every process required to get yourself where you want to be with TEPOBABY.


### Gemini Usage
By default, any responses you ask are tied to the central-usage Gemini API key that is on free tier of mine. If you run out of quota to use Gemini Chatbox for your personalized job searches. Please follow these instructions to use Gemini on your own account:
1. Go to
2. Copy API key
3. Paste it onto

Safety Assurance: Your API key is stored locally in your browser and is only sent directly to Google. I have no access to it. 


### Google sign-in (.edu only)
"Get Started with .edu Email" uses Google Identity Services (authorization-code flow). The browser only gets a one-time code; `server/index.js` exchanges it with Google, verifies the ID token (signature, audience, issuer, expiry), and only lets in **verified emails ending in `.edu`**. It then sets a signed, httpOnly session cookie. Google tokens are never stored.

Setup:
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type **Web application**.
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/api/auth/google/callback`
2. Copy `.env.example` to `.env.local` and fill in the client ID (twice), client secret, and a `SESSION_SECRET` (`openssl rand -base64 48`).
3. `npm run dev` starts the web app and the auth server together. Open http://localhost:5173 (use `localhost`, not `127.0.0.1`, to match Google's allowed origin).

For production, add your real domain to both lists in Google Cloud, set `APP_ORIGIN` to it, serve over HTTPS, and run the server with `npm run start:api` behind the same domain under `/api`.
