# TEPOBABY-tech-baby-10k-monthly-safety-net
If you're not a nepo baby or your dad does not have hundreds of connections in line for you. Try Tepobaby: a comprehensive interview guide practice in the tech industry designed specifically for U.S. college students to get your foot into the door. This app is designed from all my personal experiences, failures, lack of exposure to the industry and things I wish I knew earlier as a college student. 

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
2. **What role are you looking for?**: the types of positions you want (select all that apply) and your target start term
3. **Work Authorization & Sponsorship**: work authorization, sponsorship needs and visa status
4. **Demographic & Identity Information**: optional, with "Prefer not to say" on every question

Your answers are used to recommend postings, resources, organizations, clubs and opportunities that fit you. You can review and change them anytime from your home page.

Safety Assurance: Your answers are saved to your own account, and no other student can see them. Identity answers are optional, only used to recommend things for you, and never shared with employers. If you browse as a guest, your answers stay on your device until you sign in.


### Your home page
After the questions, you land on **Home**. The bar at the bottom has **Home**, **Interview**, a big **+** for uploading an image, **Connect** and **Profile**.

- **Job postings** (live): switch between **Underclassmen Programs**, **Internship** and **Entry-level**, and between **Last 48–72h** and **This week**. Tepobaby opens on the level that fits your answers, and if you need visa sponsorship you can hide roles that say they don't sponsor.
- **Company tiers**: big tech and quant companies ranked by interview difficulty, as a launchpad of logos. Tap a logo to open that company's careers page (see below).
- **Contractor & startup roles**: job boards for startup and contract work. These roles rarely show up on the big job lists, because small teams often post only on their own sites and a few niche boards, and the roles are very specific. Going straight to these sites is the best way to find them.
- **Save jobs with ♥**: tap the heart on any job posting to save it. Saved jobs appear under **My jobs** on your Profile, with **Saved** and **Applied** tabs; tap **Mark applied** to track where you've applied. Each saved job keeps its details, so it stays there after the posting leaves the 7-day feed. When signed in, saved jobs are stored on your account; as a guest, they stay on your device and move to your account when you sign in.
- **Profile**: your saved and applied jobs, all your answers, programs and organizations picked for you, a button to review your answers, and sign out.

Interview, Connect and image uploads are coming soon.

### Company tiers
I rank big tech and quant companies by how hard their interviews are for **college internships and new grad roles**. There are 4 tiers, hardest at the top, based on what students report on Glassdoor, LeetCode Discuss, Reddit and other reliable sources:

| Tier | What to expect | Companies |
| --- | --- | --- |
| **System Design** | Design or practical engineering rounds even for interns and new grads, on top of hard coding | Stripe, Databricks, OpenAI, Anthropic, Palantir, Netflix, Snowflake, Uber, Citadel, Citadel Securities |
| **Hard LC + DP & Advanced Graphs** | Hard LeetCode, dynamic programming, advanced graphs; quant firms add math and probability | Google, Meta, Airbnb, TikTok, Tesla, Bloomberg, Jane Street, Hudson River Trading, Jump Trading, Two Sigma, D. E. Shaw, Optiver, IMC, Five Rings, Tower Research, SIG, XTX Markets, Akuna Capital |
| **Medium LC** | Arrays, strings, trees, BFS/DFS, hashing, heaps | Amazon, Microsoft, Apple, NVIDIA, LinkedIn, Salesforce, Adobe, Oracle, Coinbase, Robinhood, DoorDash, Pinterest, Snap, Spotify, Lyft, DRW, Millennium, Point72, Old Mission, Virtu |
| **Easy LC** | Fundamentals, OA-style problems, SQL, behavioral-heavy | Capital One, IBM, Intel, AMD, Cisco, Qualcomm, JPMorgan Chase, Goldman Sachs, Morgan Stanley, Visa |

**It works like a launchpad.** Like a Chrome launchpad extension, every company shows as its logo, and tapping it opens that company's careers page in a new tab. For example:
- Microsoft → [apply.careers.microsoft.com](https://apply.careers.microsoft.com/careers?start=0&pid=1970393557007337&sort_by=timestamp)
- Google → [google.com/about/careers](https://www.google.com/about/careers/applications/jobs/results)
- Amazon → [AWS early career](https://www.amazon.jobs/content/en/teams/amazon-web-services/early-career)

Wherever a company has one, the link goes to its student or early-career page. Logos are fetched and cached by the server.

**Why check careers sites yourself.** The job feed updates once a morning, and the community lists only add a role after someone finds it. New roles often go live on a company's own site first, and some never reach the lists at all. Checking the companies you care about every day, straight from these shortcuts, gets your application in early, while fewer people have applied.

The tiers, careers links and logo websites all live in [src/data/tiers.json](src/data/tiers.json), so they're easy to update.


### Programs & organizations for you
On your **Profile**, inside **Demographic & Identity Information**, Tepobaby suggests organizations, clubs, non-profits and programs you can join, based on your answers. For example, first-gen students see programs like America Needs You and Braven, and Black students see ColorStack, NSBE and Code2040. Like the company tiers, each one shows as its logo, and tapping it opens the site so you can join. **Show all programs** lists every one, so students who chose "Prefer not to say" can browse too.

**Why join:** these organizations open the door to elite connections in the industry. Members get exclusive company partners, recruiter events and referrals that fast-track them to interviews, and often to offers.

| Who it's for | Programs |
| --- | --- |
| Because you're first-gen | [SEO Career](https://career.seo-usa.org/), [America Needs You](https://americaneedsyou.org/), [Braven](https://braven.org/), [QuestBridge](https://www.questbridge.org/), [CodePath](https://www.codepath.org/) |
| For Black students | [ColorStack](https://www.colorstack.org/), [Code2040](https://www.code2040.org/), [NSBE](https://nsbe.org/), [/dev/color](https://devcolor.org/), [MLT](https://mlt.org/), [SEO Career](https://career.seo-usa.org/) |
| For Hispanic & Latino students | [ColorStack](https://www.colorstack.org/), [Code2040](https://www.code2040.org/), [MLT](https://mlt.org/), [SEO Career](https://career.seo-usa.org/), [SHPE](https://shpe.org/), [HACE](https://haceonline.org/), [Hispanic Scholarship Fund](https://www.hsf.net/), [SACNAS](https://www.sacnas.org/) |
| For Asian students | [SASE](https://www.saseconnect.org/), [Ascend](https://ascendleadership.org/) |
| For multiracial students | [Code2040](https://www.code2040.org/), [MLT](https://mlt.org/), [SEO Career](https://career.seo-usa.org/), [SACNAS](https://www.sacnas.org/), [AISES](https://aises.org/) |
| For women & non-binary students | [Break Through Tech](https://www.breakthroughtech.org/), [Rewriting the Code](https://rewritingthecode.org/), [SWE](https://swe.org/), [AnitaB.org](https://anitab.org/), [WiCyS](https://www.wicys.org/), [Girls Who Code](https://girlswhocode.com/) |
| For LGBTQ+ students | [oSTEM](https://ostem.org/), [Out in Tech](https://outintech.com/), [Lesbians Who Tech](https://lesbianswhotech.org/) |
| Open to everyone | [CodePath](https://www.codepath.org/), [MLH Fellowship](https://fellowship.mlh.com/), [Tapia Conference](https://tapiaconference.cmd-it.org/) |

The list lives in [src/data/communities.json](src/data/communities.json), so adding a program is one entry. Your answers are only used inside the app to choose what to show; nothing extra is sent anywhere.


### Where job postings come from
Postings update **once a day, every morning at 7:00 AM Eastern Time (ET)**, so 30–31 times a month. The time follows daylight saving, and if the server was off at 7:00 AM it catches up as soon as it starts. Each morning the server checks every source in parallel in the background, keeps only roles posted in the last 7 days, removes duplicates, and pushes the new postings to the app as soon as each source finishes.

| Source | What it adds |
| --- | --- |
| [SimplifyJobs Summer 2027 Internships](https://github.com/SimplifyJobs/Summer2027-Internships) + [New Grad Positions](https://github.com/SimplifyJobs/New-Grad-Positions) | Most internships and new grad roles, with exact posting times |
| [speedyapply 2027 SWE College Jobs](https://github.com/speedyapply/2027-SWE-College-Jobs) | More SWE internships and new grad roles (age in days only) |
| [Pitt CSC](https://github.com/pittcsc/Summer2027-Internships), [vanshb03](https://github.com/vanshb03/Summer2027-Internships) | Extra community-curated internships |
| Company job boards: [Greenhouse](https://developers.greenhouse.io/job-board.html), [Lever](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api) | Early-career roles straight from about 80 companies (Stripe, Figma, OpenAI, Ramp, Palantir…). Add more in [server/jobs/companies.json](server/jobs/companies.json) |
| [Hacker News "Who is hiring?"](https://github.com/HackerNews/API) | Startup posts that mention internships, new grad or junior roles |
| [Google Jobs via SerpApi](https://serpapi.com/google-jobs-api) | Roles indexed from LinkedIn, Indeed, Glassdoor and company sites. Runs when `SERPAPI_KEY` is set (see below) |

**Google Jobs (SerpApi)**: each morning Tepobaby runs 4 searches ("software engineer intern", "software engineer new grad", "entry level software engineer", "data science intern"), about 120–124 searches a month. That fits [SerpApi's free plan](https://serpapi.com/pricing) of 250 searches a month. Each result links to the best place to apply: the company's own site first, then its hiring platform (like Greenhouse or Workday), then LinkedIn, Indeed or Glassdoor. To turn it on, create a free account at [serpapi.com](https://serpapi.com), copy your API key into `.env.local` as `SERPAPI_KEY=...`, and restart the server. Keep the key out of git and out of any `VITE_` variable.

The Simplify.jobs site doesn't need its own scraper, because the SimplifyJobs GitHub lists above already carry its data.

LinkedIn, Indeed, Glassdoor, Wellfound, Y Combinator's Work at a Startup, RippleMatch, WayUp, Untapped and CodePath are not scraped directly, because their terms don't allow it or they need a login. Google Jobs through SerpApi covers much of LinkedIn, Indeed and Glassdoor legitimately.

**On your Home page**
- Each level tab shows how many postings it has, and **Last 48–72h** / **This week** filter by real posting times.
- Newest first, with a **Live** badge and when the last morning update ran. New postings appear on their own, and **Show more** loads the next batch.
- Each posting shows the company's logo: the site's icon via [Google's favicon service](https://www.google.com/s2/favicons) (with [DuckDuckGo's](https://icons.duckduckgo.com) as a backup), fetched and cached by our server, so your browser never contacts them. The company's website comes from the job list, the apply link, or a name lookup that has to match the company exactly. If there's no confident match, you see the company's first letter instead of a wrong logo.
- Each posting's level comes from the list it was found in and its title (like "intern" or "new grad"). Senior roles are left out.

**Good to know**
- **Visa sponsorship is often unknown.** Many sources don't say whether a role sponsors. If you need sponsorship, the toggle hides roles that say they don't, and **Sponsors visa** only shows when a source confirms it.
- **Underclassmen Programs is often empty.** Programs for freshmen and sophomores (like Microsoft Explore) are rare and mostly open August–October. When none are new, Tepobaby suggests the Internship tab, since many internships accept every class year.
- **Each link opens the original application** on the company's site or job board.


### Design decisions & pain points
How I built the job postings feed and the rest of the app (with Claude Code), what was hard, and what I chose.

**Job postings workflow**
1. Most postings come from the community GitHub repos listed above. Instead of scraping their README tables, I read each repo's structured `listings.json`, which has exact posting timestamps, sponsorship info and whether the role is still open. speedyapply has no JSON, so I parse its Markdown table (it only gives age in days).
2. I add early-career roles straight from about 80 companies through the public Greenhouse, Lever and Ashby job-board APIs.
3. I add startup roles from Hacker News "Who is hiring?" through the official Firebase API.
4. I add Google Jobs results through SerpApi.
5. Every source runs in parallel. I keep the last 7 days, label each role Underclassmen / Internship / Entry-level, drop senior roles, remove duplicates across sources, and push new postings to the app.

**Pain points → decisions**
- **GitHub README tables are messy.** They mix HTML and Markdown, use "↳" rows for repeated companies, use emoji for sponsorship, and have no exact dates. → I read the JSON data behind the tables when it exists, and parse Markdown only as a fallback.
- **Not every repo is alive.** The cvrve repos no longer exist, and Pitt CSC hasn't added a posting since August. → I keep the live ones and show where each posting came from.
- **The big lists are huge.** SimplifyJobs' file is about 13 MB. → The server asks GitHub "has this changed?" (ETag), so an unchanged file downloads 0 bytes.
- **There's no master list of company job boards.** Guessed board names often don't exist. → I tested 93 candidates and kept the 80 that respond, in `server/jobs/companies.json`.
- **Hacker News posts are free text.** → I keep posts that mention intern, new grad or junior roles, and read the "Company | Role | Location" first line that most posts follow.
- **Google Jobs is a different workflow.** It's search-based, so I have to choose keywords that match what I'm looking for, and SerpApi's free plan allows 250 searches a month. → 4 searches each morning (about 124 a month). Google also changed where it puts the posting age, so I read both places.
- **Google Jobs "company site" links were often reposting sites** like BeBee or ClearanceJobs rather than real company pages. → I re-rank apply links: official careers site first, then Greenhouse / Lever / Ashby / Workday pages, then major job boards (LinkedIn, Indeed, Glassdoor), with reposting sites last. Logos only come from a site that matches the company's name.
- **Some sites can't be scraped.** LinkedIn, Indeed, Glassdoor, Wellfound, YC Work at a Startup, RippleMatch, WayUp, Untapped and CodePath forbid it or need a login. → I skip them; Google Jobs through SerpApi covers much of LinkedIn, Indeed and Glassdoor legitimately.
- **"Real-time" vs. being polite.** I started by checking sources every few minutes. The lists only change a few times a day, so I moved to one update every morning at 7:00 AM ET (30–31 a month). It follows daylight saving and catches up if the server was off. When new postings land, the app updates instantly through a live connection (Server-Sent Events).
- **Live updates silently didn't arrive at first.** The server dropped each listener the moment it connected, because Node fires the request's "close" event early. → I listen for the response's "close" instead and tested it end to end.
- **Logos.** Apply links usually point to hiring platforms, not the company's site, and a name lookup matched "Meter" to the wrong company (metergroup.com). → I only accept a website when the name matches exactly and the website looks like the company's own. Otherwise I show the company's first letter, because a wrong logo is worse than none. Logos are cached on my server, so students' browsers never contact third parties, and only companies in current postings are served.
- **Sponsorship data is mostly missing.** Most sources don't say whether a role sponsors visas. → The toggle only hides roles that say they don't, and "Sponsors visa" shows only when a source confirms it.
- **Underclassmen programs are rare.** → The tab says so and points to Internship, instead of showing made-up programs.
- **Startup and contract roles rarely appear on job lists.** → A separate section links straight to the boards where they're posted.

- **Ranking interview difficulty is subjective.** → I base tiers on what students report (Glassdoor, LeetCode Discuss, Reddit) and fact-check borderline companies. That moved Tesla, Bloomberg and Akuna Capital up to Hard LC, because reports describe medium-hard to hard problems. NVIDIA, Point72 and DRW stayed in Medium LC, because reports describe mostly medium problems plus systems or data questions. Everything is in `src/data/tiers.json`, so it's easy to adjust.
- **Job lists lag behind company sites.** → The tier list doubles as a launchpad of careers-page shortcuts, so checking target companies daily is one tap each.

- **Saved jobs would disappear with the feed.** Postings only stay for 7 days. → Each saved job keeps its own copy of the details (company, title, link, logo), so your Saved and Applied lists last. Guests' saved jobs stay on the device and move into the account at sign-in, the same way answers do.

- **Matching programs without exposing identity data.** Race, gender, LGBTQ+ and first-gen answers are sensitive. → Matching happens inside the app from answers you already gave, and identity questions keep "Prefer not to say". **Show all programs** means nobody has to share anything to see the full list.
- **Program links go stale.** Organizations rebrand or shut down. → I checked every link before adding it. Basta's site no longer exists and Jopwell now redirects to a different company, so both were left out. Braven, SEO and the MLH Fellowship had moved, so I use their new addresses.
- **Putting each program in the right group.** Some are easy to mix up; for example, Break Through Tech is for women and non-binary students, not specifically first-gen. → Each program lists who it's for, and it appears once, in the first group that fits you.
- **Some logos are white or missing.** /dev/color's white logo disappeared on a white tile, and Hispanic Scholarship Fund's site has no usable icon. → A program can set a dark tile, and missing logos show the program's first letter.

**Rest of the app**
- **Google sign-in didn't come back from the popup** in some browsers (in-editor browsers, the iPhone Home Screen app). → Sign-in uses a full-page redirect.
- **A .edu check in the browser could be bypassed.** → The server verifies Google's ID token and only accepts verified emails ending in `.edu`.
- **Questions changed after students had already answered.** → Students only answer the new section, and old answers are cleaned up automatically.


### Environment variables
| Variable | Used by | Value |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Browser | Your OAuth client ID |
| `GOOGLE_CLIENT_ID` | Server | The same client ID |
| `GOOGLE_CLIENT_SECRET` | Server | Your OAuth client secret. Never put this in a `VITE_` variable. |
| `SESSION_SECRET` | Server | Random string of 32+ characters: `openssl rand -base64 48` |
| `APP_ORIGIN` | Server | Public URL of the app, no trailing slash. `http://localhost:5173` locally. |
| `SERPAPI_KEY` | Server | Optional. Your SerpApi key; adds Google Jobs results (4 searches each morning, about 124 a month). |
| `JOBS_FEED` | Server | Optional. Set to `off` to stop checking job sources. |
| `JOBS_DAILY_TIME` | Server | Optional. Daily update time in Eastern Time, `HH:MM` (default `07:00`). |

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
| `GET` / `PUT /api/saved`, `DELETE /api/saved/:id` | Read / save or update / remove the signed-in student's saved and applied jobs |
| `POST /api/saved/import` | Move jobs a guest saved on the device into their account after sign-in |
| `GET /api/postings?level=&window=&visa=` | Live job postings (public). `level`: `underclassmen`, `internship` or `entry`; `window`: `fresh` (72h) or `week` |
| `GET /api/postings/stream` | Live updates (Server-Sent Events): sends `update` when the morning update brings new postings |
| `GET /api/logo/:domain` | A logo, cached by the server (only for companies in current postings, the tier list, or suggested programs) |
