# TEPOBABY-tech-baby-10k-monthly-safety-net
If you're not a nepo baby or your dad does not have hundreds of connections in line for you. Try Tepobaby: a comprehensive interview guide practice in the tech industry designed specifically for U.S. college students to get your foot into the door. This app is designed from all my personal experiences, failures, lack of exposure to the industry and things I wish I knew earlier as a college student. 

This is only for U.S. college students who need to lock in and get the job prospect off their chest in this insane market. It is not guaranteed that you would secure an offer with the use of this app, but you can interviewmaxx in every process required to get yourself where you want to be with TEPOBABY.


### Gemini Usage
Ginny's Gemini features (Ask Gemini and tailored rewrites) currently run on the author's personal free API key. To unlock them in your own copy, grab your own API key from [Google AI Studio](https://aistudio.google.com/app/apikey), which is free. Then add it to `.env.local` as `GEMINI_API_KEY=...` and restart the server.


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
- **Track your applications**: in **My jobs → Applied**, tap a job's stage to update it: **Applied → OA → Phone → On-site → Final → Team match → Offer**, or **Ghosted** / **Not proceeding**. A pipeline summary shows how many jobs are at each stage, and each job shows when its stage last changed. Applied jobs stay until you remove them: the daily job update never touches this list, and changing a stage never reshuffles it (it's ordered by when you applied).
- **Profile**: your saved and applied jobs, all your answers, programs and organizations picked for you, a button to review your answers, and sign out.
- **＋ (Ginny)**: pick one saved job, then run an ATS match analysis or ask Gemini about it (see below).
- **Interview**: two tabs side by side, **Behavioral** (a live AI voice interviewer) and **Technical** (the NeetCode 150 as a Card Game and a concept Roadmap). Both are described below.
- **Connect**: pick a job, then find alumni from your school and technical recruiters at that company on LinkedIn, with ready-to-copy messages (see below).

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
On your **Profile**, inside **Demographic & Identity Information**, Tepobaby suggests organizations, clubs, non-profits and programs you can join, based on your answers. For example, first-gen and low-income students see programs like Career Pathways Initiative (founded by Ken Lang), America Needs You and Braven, and Black students see ColorStack, NSBE and Code2040. Every program is something **U.S. college students** can join: no high school or college-admissions programs. A few professional networks (/dev/color, NAAAP, Blacks In Technology, Out in Tech, Lesbians Who Tech, Latinas in Tech) are included too, because joining early builds the network you'll use when you start working. Like the company tiers, each one shows as its logo, and tapping it opens the site so you can join. **Show all programs** lists every one, so students who chose "Prefer not to say" can browse too.

**Why join:** these organizations open the door to elite connections in the industry. Members get exclusive company partners, recruiter events and referrals that fast-track them to interviews, and often to offers.

| Who it's for | Programs |
| --- | --- |
| Because you're first-gen | [SEO Career](https://career.seo-usa.org/), [America Needs You](https://americaneedsyou.org/), [Braven](https://braven.org/), [CodePath](https://www.codepath.org/), [Career Pathways Initiative](https://www.careerpathwaysinitiative.com/) |
| For Black students | [ColorStack](https://www.colorstack.org/), [Code2040](https://www.code2040.org/), [NSBE](https://nsbe.org/), [MLT](https://mlt.org/), [SEO Career](https://career.seo-usa.org/), [UNCF](https://uncf.org/), [Thurgood Marshall College Fund](https://tmcf.org/), [Black in AI](https://www.blackinai.org/), [/dev/color](https://devcolor.org/), [Blacks In Technology](https://blacksintechnology.org/) |
| For Hispanic & Latino students | [ColorStack](https://www.colorstack.org/), [Code2040](https://www.code2040.org/), [MLT](https://mlt.org/), [SEO Career](https://career.seo-usa.org/), [SHPE](https://shpe.org/), [HACE](https://haceonline.org/), [SACNAS](https://www.sacnas.org/), [Hispanic Heritage Foundation](https://hispanicheritage.org/), [LatinX in AI](https://www.latinxinai.org/), [Latinas in Tech](https://latinasintech.org/) |
| For Asian students | [SASE](https://www.saseconnect.org/), [Ascend](https://ascendleadership.org/), [APIA Scholars](https://apiascholars.org/), [NAAAP](https://www.naaap.org/) |
| For multiracial students | [Code2040](https://www.code2040.org/), [MLT](https://mlt.org/), [SEO Career](https://career.seo-usa.org/), [SACNAS](https://www.sacnas.org/), [AISES](https://aises.org/), [American Indian College Fund](https://collegefund.org/) |
| For women & non-binary students | [Break Through Tech](https://www.breakthroughtech.org/), [Rewriting the Code](https://rewritingthecode.org/), [SWE](https://swe.org/), [AnitaB.org](https://anitab.org/), [WiCyS](https://www.wicys.org/), [Girls Who Code](https://girlswhocode.com/), [Latinas in Tech](https://latinasintech.org/) |
| For LGBTQ+ students | [oSTEM](https://ostem.org/), [Point Foundation](https://pointfoundation.org/), [Out for Undergrad](https://www.outforundergrad.org/), [Queer in AI](https://www.queerinai.com/), [Out in Tech](https://outintech.com/), [Lesbians Who Tech](https://lesbianswhotech.org/) |
| Open to everyone | [CodePath](https://www.codepath.org/), [MLH Fellowship](https://fellowship.mlh.com/), [Tapia Conference](https://tapiaconference.cmd-it.org/), [Forage](https://www.theforage.com/), [ACM](https://www.acm.org/) |

Each logo comes from the organization's own website (its app icon or site icon), with Google's favicon service as a backup, and every program in the list has a real logo. The list lives in [src/data/communities.json](src/data/communities.json), so adding a program is one entry. Your answers are only used inside the app to choose what to show; nothing extra is sent anywhere.


### Ginny ✨ (the ＋ button)
Tap the big **＋** in the middle of the bottom bar. A sheet opens with two tabs side by side:

1. **Job**: pick **one** job from your saved (♥) jobs. Ginny uses it for everything.
2. **Ginny!**: AI tools for that job:
   - **ATS match analysis** (shown with the Voyage AI logo, the embeddings that power it): scores how well your resume fits the job.
   - **Ask Gemini** (shown with the Google Gemini logo): an interview FAQ chat about the job, so you can chancemaxx.

**ATS match analysis**

Upload your resume PDF once. Signed-in students' resumes are stored privately on their account; guests' stay on their device. After that, Ginny goes straight to the analysis. Every time you run an analysis, Ginny goes to the job posting's own website and fetches the full job description in real time, so you're matched against what the posting says right now. It reads Greenhouse, Lever, Ashby and Workday through their public APIs, and other career sites through their job data or page text. If it can't, it asks you to paste the description.

It then runs three stages:

| Stage | What it does | How |
| --- | --- | --- |
| 1 · Retrieval | Semantic similarity between your resume and the job | [Voyage AI](https://docs.voyageai.com/docs/embeddings) `voyage-4` embeddings: resume lines with `input_type="document"`, the job description and each requirement with `input_type="query"` |
| 1.1 · Hard skills | Exact technical string overlap (does "Kubernetes" or "C++" actually appear?) | BM25 over your resume lines, with a tech-skills dictionary and aliases (k8s → Kubernetes). Required qualifications count double |
| 2 · Reranking | Scores the top 10–20 retrieved resume lines against each job requirement | A local cross-encoder (ms-marco MiniLM, the model family [FlashRank](https://github.com/PrithivirajDamodaran/FlashRank) uses) on our server's CPU. No external API calls |

You get one of the four match tiers that Eightfold-style candidate-matching systems label you with:

| Tier | Score | Meaning |
| --- | --- | --- |
| 🎯 **Strong Match** | 75+ | Near-perfect alignment with the required skills, core tools and experience trajectory of the job. |
| **Good Match** | 55–74 | A solid, competitive profile. You meet the main standards but may be missing a couple of secondary keywords or proof for some tools. |
| **Average / Partial Match** | 30–54 | Some relevant experience, but significant gaps, like missing core languages, platforms or equivalent job titles. |
| **Weak Match** | under 30 | Very low alignment. The system struggles to find direct evidence that your background fits the position. |

The report also shows:
- skills you have, and skills missing from your resume (required ones are flagged);
- where your resume proves each requirement (the job line next to your bullet);
- requirements with little evidence;
- how the score was built.

The score blends hard skills (40%), semantic fit (35%) and evidence (25%). Eightfold's own formula isn't public, so these weights and cutoffs are Tepobaby's calibration.

**What to improve.** Every report ends with a practical checklist, most important first, each item labeled high / medium / low:
- **Missing required skills,** with about how many points each would add. Only add them if you've really used them; otherwise, a small project is the honest fix.
- **Nice-to-have skills** you could mention, using the posting's exact spelling.
- **Skills listed but never proven:** they're in your Skills list but never shown in a bullet.
- **Requirements with no clear evidence,** each with a fill-in template.
- **Bullets without numbers,** and weak openers like "Responsible for…".
- **Long bullets,** role words from the job title your resume never uses, and missing standard sections.
- **A projected score** if you add the required skills you actually have.

This checklist is computed on our server from the same evidence as the score, so it's instant and sends nothing anywhere.

**Tailor with Gemini (opt-in).** Tap **✨ Get tailored rewrites** and Gemini returns:
- 3–5 of your own bullets rewritten for this job, each shown next to the original with the requirement it targets;
- keywords to add, but only where they're true;
- a 1–2 weekend project idea for your biggest gap.

It never invents experience: unknown numbers become placeholders like [X%]. Because AI can still embellish, Tepobaby reminds you to keep only what's true. This is the only Ginny feature that sends resume text to Gemini (Experience, Projects, Skills and Education, with your name and contact info already removed), and it only runs when you tap the button.

**Your privacy (PII mitigation).** Voyage AI is a hosted API, and sending raw resumes would create GDPR/CCPA risk. So before anything leaves our server:
1. **Direct identifiers are redacted locally:** your name (the header line), email, phone, street address, and LinkedIn, GitHub and other links.
2. **Only the useful sections are kept:** Work Experience, Projects, Skills and Education. Summary, objective, references and other header info are dropped.
3. **Metadata is stored separately:** the original PDF stays in private, owner-only storage on our server (`server/data/resumes`; S3 + PostgreSQL in production). Only the sanitized, sectioned text is sent to Voyage AI. BM25 and reranking run locally.

**Voyage AI limits** (as published by Voyage for the free tier):

| Factor | Limit | What it means for Tepobaby |
| --- | --- | --- |
| Free tokens | 200M | About 400,000 resume or job documents for prototyping and early users, at $0 and no credit card. |
| Rate limits | 2,000 RPM / 8M TPM | Plenty for many students analyzing at once. |
| Context window | 32,000 tokens per input | A resume is about 500 tokens, so nothing gets cut off. |
| Vector size | 1,024 dimensions | High semantic resolution; supports Matryoshka (256 or 512) to save storage. |

Why Voyage:
- **Tuned for tech.** It's built for code, APIs and engineering terms, so it relates "Next.js" to "React", or "Forward Deployed Engineer" to "Solutions Architect".
- **One shared vector space.** `voyage-4-large`, `voyage-4` and `voyage-4-lite` share it, so resumes can be indexed once and searched with the faster lite model.

**Ask Gemini**

A chat about your selected job, so you know what to expect. It opens with suggested questions, filled in automatically from the job and your profile, so you don't retype anything:
- *"(role) at (company): how many interview rounds are there, and what are they?"*
- *"According to Glassdoor interviews at (company), what questions does (company) ask for (role)? List NeetCode 150 problems to practice."*
- *"Does (company) sponsor (your visa type) for (role)?"* U.S. citizens get a citizenship / clearance question instead.

Ask Gemini uses **Gemini 3.8 Flash** through Google's Interactions API. It tries Google Search first so company-specific answers come with sources. On the free tier, search can be over quota; then Gemini answers from what candidates have publicly reported and the answer says it has no live sources. If Gemini is overloaded, Tepobaby retries and falls back to Gemini 3.7 / 3.5 Flash. Chat only gets the role, company and non-identifying profile facts (class year, graduation date, visa status), never your resume, name or email.


### Interview: behavioral voice practice
In **Interview → Behavioral**, pick who interviews you: **Generic**, **Google**, **Amazon** or **Meta**. Then tap the big round button and answer out loud. **North West, a Senior Software Engineer** at that company, interviews you in real time, powered by the OpenAI Realtime API over WebRTC.

| Interviewer | Focus |
| --- | --- |
| Generic | Classic behavioral questions: teamwork, conflict, failure, ambiguity, ownership |
| Google | Scale & complexity: billions of requests, system trade-offs, edge cases, and "Googleyness" (collaboration, handling ambiguity). Listens for "I" vs. "we" |
| Amazon | Leadership Principles, evaluated like a Principal Engineer: Customer Obsession, Ownership, Bias for Action, Dive Deep, Deliver Results. Follows up when you don't show bias for action or quantifiable business metrics |
| Meta | Move fast & impact: rapid execution, personal engineering ownership, pragmatism over over-engineering |

The persona, company context, interview rigor and evaluation criteria are set with system instructions in the Realtime session. North West keeps turns to 1–3 sentences so you do most of the talking, asks one question at a time, and follows up naturally when a STAR part is missing. For example: *"Thanks for detailing those steps! Before we move on, what was the actual impact after you shipped that?"*

**Live STAR feedback.** Four boxes, **S · T · A · R**, update as you talk:
- 🟩 **green**: that part passed;
- 🟨 **yellow**: needs clarification (North West follows up);
- 🟥 **red**: needs revision, so redo that part.

North West grades each part by calling the `update_star_progress` tool (phase, status and a short note like "No quantifiable metric provided"). The note shows under the boxes. A second tool, `start_new_question`, resets the boxes and shows each new question on screen.

**Camera panel & AI agent badge.**
- **Layout:** the S · T · A · R boxes stand in a column on the left, with a camera panel to their right.
- **Camera:** when you tap the round button (it shows the OpenAI logo), Tepobaby asks for camera access and shows a mirrored self-view with a LIVE tag, like a real video interview.
- **Agent badge:** in the panel's top-left corner, an OpenAI badge shows "North West · speaking / listening". It wiggles, with a pulsing ring and sound bars, while North West talks, the way AI voice agents usually show they're speaking.
- **If you skip the camera:** you can say no to camera access and keep practicing audio-only.

**Privacy & cost.**
- **Audio & video:** your voice goes straight from your browser to OpenAI. Your camera is only shown to you on screen and is never sent anywhere. Tepobaby doesn't record or store either one.
- **Key safety:** the server mints a short-lived client secret for each session, so the OpenAI key never reaches the browser.
- **Limits:** sessions end automatically after 15 minutes, and each user can start up to 10 sessions an hour.
- **Credits:** the Realtime API has no free tier, so the OpenAI account needs credits; if it runs out, the app says so instead of failing silently.


### Interview: technical practice (NeetCode 150)
**Interview → Technical** is built entirely on the [NeetCode 150](https://neetcode.io/practice), with two sub-tabs side by side: **Card Game** and **Roadmap**.

**🃏 Card Game**
1. **Flip a card.** 150 face-down cards are numbered 1–150, and each hides a random NeetCode 150 question (shuffled per device). Tap one, or **Flip a random card**, and it flips over to reveal the question.
2. **Read the question.** A pop-up shows the full problem statement, scraped from LeetCode with its examples, images and constraints.
3. **Guess the concepts.** Pick every approach you think applies from the 18 concepts on the roadmap (Arrays & Hashing, Two Pointers, …, Bit Manipulation), then tap **Answer**.
   - Correct picks turn green, wrong ones red, and missed ones get a dashed green outline.
   - A one-line explanation says why each approach works (e.g. Trapping Rain Water: Two Pointers, or a monotonic Stack).
4. **Let's code.** This opens a NeetCode-style coding screen:
   - **Layout:** the question sits on the left; on the right are a code editor (Python 3 or JavaScript) and the test cases.
   - **Run** runs the example test cases, which you can edit, or add your own.
   - **Submit** also runs hidden tests and gives LeetCode-style verdicts:
     - **Accepted**, **Wrong Answer** (showing the failing input, your output and the expected output), **Runtime Error**, **Time Limit Exceeded**, and **Compile Error**.
     - Each result also shows `print` / `console.log` output and the runtime.
   - **💡 Hint: template** shows the skeleton code of the right concept as read-only text. It shows the pattern, not this problem's solution, and nothing is typed into your editor.
   - Your code is saved as a draft for each problem and language; **Reset** brings back the starter code.
   - **On a phone**, the question, code and tests become three tabs.
5. Accepted cards turn green with a ✓, and the counters track solved cards, flipped cards and concepts you nailed.

**🗺️ Roadmap**
- **The diagram:** NeetCode's roadmap, with the same 18 concepts and dashed prerequisite lines, from Arrays & Hashing down to Math & Geometry. Each concept shows a progress bar of the problems you've solved in it.
- **Opening a concept:** hover (or tap on a phone) to open its card:
  - **Skeleton code** of the pattern (e.g. binary search, monotonic stack, Dijkstra).
  - **Works on:** the input types it handles (sorted array, linked list, adjacency list, 2-D grid, two strings, …).
  - **What it does**, in plain words.
  - **Live walkthrough:** the algorithm runs on a small example. The data moves step by step, with arrays and their `l` / `m` / `r` pointers, hash maps, stacks, linked-list arrows, trees, trie and decision trees, graphs, DP tables, intervals and bits, while the matching line of code lights up. You can play or pause, step back and forward, or change the speed.
  - **Runtime**: time and space complexity, and why.

**Where the code runs.** Your code runs **in your own browser**, never on Tepobaby's server:
- **JavaScript** runs in a sandboxed Web Worker. Like LeetCode's runtime, it has `ListNode`, `TreeNode` and `MinPriorityQueue` built in.
- **Python 3** runs with [Pyodide](https://pyodide.org) (CPython compiled to WebAssembly). It loads from jsDelivr the first time you pick Python (about 10 MB, cached afterwards), with `typing`, `collections`, `heapq` and the other usual LeetCode imports ready.
- **Infinite loops** hit a time limit (3 s per case for JavaScript, 8 s for Python), and the worker is restarted.

**Where the tests come from.**
- **Problems and examples:** the server fetches each problem's statement, example inputs, function signature and starter code from LeetCode's public GraphQL endpoint. It caches them in `server/data/neetcode.json` and refreshes them weekly, one request at a time.
- **Expected answers:** I wrote a reference solution for all 150 problems ([server/neetcode/reference.js](server/neetcode/reference.js)). `npm run check:neetcode` verifies every one against the 357 example outputs on the problem pages.
- **Hidden tests:** Submit also runs 3–5 hidden tests per problem (edge cases like empty input, a single item, duplicates, negatives, plus some bigger inputs), all within each problem's constraints.
- **Custom test cases:** when you add or edit a case, the server computes its expected answer with the reference solution, in a worker thread with a 3-second limit.
- **Problems with more than one right answer** are judged fairly: any order where the problem allows it (3Sum, Group Anagrams, Subsets, Permutations, …), any valid topological order for Course Schedule II and Alien Dictionary, any longest palindrome, and a 1e-5 tolerance for decimals.

**Progress** (the card shuffle, flipped and solved cards, and code drafts) is saved on this device.


### Connect: alumni & recruiters on LinkedIn
Pick one of your saved (♥) jobs, or type any company, to get two sections.

**1. Find alumni from your school at (company)**
- **LinkedIn button:** opens the company's LinkedIn **People** tab, filtered by your school. For a role at Google, Whitman College students get `https://www.linkedin.com/company/google/people/?keywords=Whitman%20College`.
  - **Your school:** looked up from your `.edu` email domain (`whitman.edu` → Whitman College) in the open [university-domains list](https://github.com/Hipo/university-domains-list).
  - **Editing:** you can edit it, and guests type it in.
- **Message to send** with a **Copy** button, filled in from your profile: your name, school, class year (from your graduation date) and the company. It's kept under LinkedIn's 300-character connection-note limit, and a counter shows the length:
  > Hi! My name is Alex Rivera, and I also go to Whitman College (Class of 2027). I'd love a quick 30-min chat about breaking into the tech industry and to ask about your work at Google. Could you share your availability and the best email to schedule a time? Thank you!
- **Informational interview questions**: eight starter questions (a typical day, the team, how they got there, what the company looks for in interns and new grads, …), with **Copy questions**.
- **The referral question**, shown as a quote to end every chat with. It sets up a referral later without asking for one outright:
  > “Would it be okay if I reached out to you again if I find any interesting roles that I think fit my experience?”

**2. Connect with recruiters at (company)**
- **LinkedIn button:** the same People tab, filtered by `technical recruiter` (e.g. `https://www.linkedin.com/company/google/people/?keywords=technical%20recruiter`).
- **Message:** a short copyable note to the recruiter that names the role you picked.

**About company pages.** A company's LinkedIn page name is set by the company and doesn't always match its name. For example, Jane Street's is `jane-street-global-trading`. So:
- **Known pages:** Tepobaby knows the page names for the companies it tracks (the tier list and the job boards).
- **Other companies:** it makes a best guess from the name, shows the page name with an **Edit** button, and links to a plain LinkedIn people search as a fallback.
- **Edits are saved:** fixes and your name/school edits are remembered on your device.

Tepobaby only builds links; it never signs in to LinkedIn or sees your LinkedIn account.


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
How I built Tepobaby (with Claude Code): each decision, why I made it, and the pain point behind it.

**Job postings workflow**
1. Most postings come from the community GitHub repos listed above. I read each repo's structured `listings.json` (exact posting times, sponsorship, whether the role is open). speedyapply has no JSON, so I parse its Markdown table.
2. I add early-career roles straight from about 80 companies through the public Greenhouse, Lever and Ashby job-board APIs.
3. I add startup roles from Hacker News "Who is hiring?" through its official API.
4. I add Google Jobs results through SerpApi.
5. Every morning all sources run in parallel. I keep the last 7 days, label each role Underclassmen / Internship / Entry-level, drop senior roles, remove duplicates, and push new postings to the app.

#### Job postings feed
- **Read each repo's `listings.json` instead of scraping its README table.**
  - *Why:* it has exact timestamps for the 48–72h filter, sponsorship info, and an "active" flag.
  - *Pain point:* the README tables mix HTML and Markdown, use "↳" rows for repeated companies and emoji for sponsorship, and have no exact dates.
- **Keep only repos that are alive, and show each posting's source.**
  - *Why:* students should see where a role came from.
  - *Pain point:* the cvrve repos no longer exist, and Pitt CSC hasn't added a posting since August.
- **Ask GitHub "has this changed?" (ETag) before downloading.**
  - *Why:* an unchanged list costs 0 bytes instead of about 13 MB.
  - *Pain point:* the big lists are huge.
- **A verified list of company job boards** (`server/jobs/companies.json`).
  - *Why:* the Greenhouse, Lever and Ashby APIs are public and structured, so no HTML scraping.
  - *Pain point:* there's no master list, and guessed board names often don't exist. I tested 93 and kept the 80 that respond.
- **Keyword-filter Hacker News posts.**
  - *Why:* "Who is hiring?" has real startup roles.
  - *Pain point:* posts are free text. I keep ones that mention intern, new grad or junior roles, and read the "Company | Role | Location" first line most posts use.
- **Google Jobs through SerpApi, 4 searches each morning.**
  - *Why:* it's the legitimate way to reach roles indexed from LinkedIn, Indeed and Glassdoor, and 4 a day (about 124 a month) fits the free 250.
  - *Pain point:* it's a different, search-based workflow, so I have to pick keywords that match what I'm looking for. Google also moved the posting age to a different field.
- **Re-rank Google Jobs apply links:** official careers site → Greenhouse / Lever / Ashby / Workday → LinkedIn / Indeed / Glassdoor → reposting sites last.
  - *Why:* students should apply where the company actually reviews applications.
  - *Pain point:* the "company site" link was often a reposting site like BeBee or ClearanceJobs.
- **Don't scrape sites that forbid it or need a login** (LinkedIn, Indeed, Glassdoor, Wellfound, YC Work at a Startup, RippleMatch, WayUp, Untapped, CodePath).
  - *Why:* scraping them breaks their terms; SerpApi covers much of the same listings legitimately.
  - *Pain point:* some of the best boards are closed to scraping.
- **Update once every morning at 7:00 AM ET** (30–31 times a month), with instant push to the app (Server-Sent Events).
  - *Why:* the lists only change a few times a day, so checking every few minutes was impolite and wasteful. It follows daylight saving and catches up if the server was off.
  - *Pain point:* balancing "real-time" with being polite to the sources.
- **Listen for the response's "close" event for live updates.**
  - *Why:* Node fires the request's "close" event as soon as the request is read.
  - *Pain point:* live updates silently never arrived at first.
- **Only show sponsorship when a source states it.**
  - *Why:* a wrong "sponsors visa" tag could mislead international students. The toggle only hides roles that say they don't.
  - *Pain point:* most sources don't say.
- **Explain empty Underclassmen results instead of filling them.**
  - *Why:* made-up programs would waste students' time.
  - *Pain point:* freshman and sophomore programs are rare and seldom appear within 7 days.
- **A separate section for startup and contract job boards.**
  - *Why:* small teams post on their own sites and niche boards.
  - *Pain point:* these roles rarely show up on the big lists.

#### Logos
- **Proxy and cache every logo on my server**, and serve only domains that are in Tepobaby's data.
  - *Why:* students' browsers never contact third parties, and the logo route can't be used as an open proxy.
  - *Pain point:* privacy, plus abuse risk.
- **Find each company's website before fetching its logo** (job list link → apply link on the company's own site → known list → exact-name lookup that must match the website).
  - *Why:* apply links usually point to hiring platforms.
  - *Pain point:* a name lookup matched "Meter" to metergroup.com, and a wrong logo is worse than a letter.
- **Organizations use their own website's icon first** (apple-touch-icon or largest site icon), then Google's and DuckDuckGo's favicon services.
  - *Why:* the site's own icon is the real logo.
  - *Pain point:* favicon services returned tiny, generic or missing icons. A few needed an image from the organization's site (ACM), the icon from its browser tab (NAAAP), a cropped bundled copy (Tapia), or a dark tile for a white logo (/dev/color).

#### Company tiers
- **Rank companies by reported intern / new grad interview difficulty and fact-check borderline ones.**
  - *Why:* students prep differently for system design vs. easy LeetCode.
  - *Pain point:* it's subjective. Checking reports moved Tesla, Bloomberg and Akuna Capital up to Hard LC, while NVIDIA, Point72 and DRW stayed in Medium LC. Everything is in `src/data/tiers.json`.
- **Make the tier list a launchpad of careers-page shortcuts.**
  - *Why:* roles often go live on company sites before any list picks them up.
  - *Pain point:* job lists lag behind company sites.

#### Saved jobs
- **Each saved job keeps its own copy of the details.**
  - *Why:* Saved and Applied lists should outlast the feed.
  - *Pain point:* postings only stay for 7 days.
- **Guests' saved jobs and answers stay on the device and move into the account at sign-in.**
  - *Why:* students shouldn't lose progress when they decide to sign in.
  - *Pain point:* guests have no account to save to.

- **Hiring stages for applied jobs** (Applied, OA, Phone, On-site, Final, Team match, Offer, Ghosted, Not proceeding), set with a tap-to-open toggle.
  - *Why:* "applied" alone doesn't tell students where they stand, and a pipeline view shows what needs follow-up.
  - *Pain point:* students track this in spreadsheets today. The server only accepts these 9 stages, and records when the stage last changed.
- **The Applied list never refreshes or reshuffles.**
  - *Why:* applications take weeks, and a list that jumps around is hard to track.
  - *Pain point:* saving used to move the job to the top, so changing a stage would have reshuffled the list. Updates now replace the job in place, and Applied is ordered by when you applied. The daily job update never touches saved or applied jobs.

#### Programs & organizations
- **Match programs inside the app, and keep "Show all programs".**
  - *Why:* nobody has to share identity data to see the full list.
  - *Pain point:* race, gender, LGBTQ+ and first-gen answers are sensitive.
- **Only programs U.S. college students can join**, plus professional networks students can join early.
  - *Why:* Tepobaby is for U.S. college students, and early networking pays off at recruiting time.
  - *Pain point:* the first list mixed in high school and admissions programs (Posse, QuestBridge and others), which I removed.
- **Check every link before adding a program.**
  - *Why:* a dead link wastes a student's time.
  - *Pain point:*
    - Basta's and Rising First's sites are gone, Jopwell redirects elsewhere, and others had moved.
    - Several organizations share the name "Career Pathways Initiative"; I added the one founded by Ken Lang.
- **Programs can require more than one group** (Latinas in Tech: Latina *and* a woman).
  - *Why:* students should only see programs they can join.
  - *Pain point:* a Hispanic man was shown Latinas in Tech, and an LGBTQ+ man Lesbians Who Tech.
- **Keep the list to organizations students join.**
  - *Why:* Google's own programs only showed Google's logo, and Hispanic Scholarship Fund is mainly a scholarship.
  - *Pain point:* a launchpad full of company programs and scholarships blurs its purpose.

#### Ginny: ATS match analysis
- **Fetch the job description in real time from the posting's own website on every analysis.**
  - *Why:* roles get edited or closed, so the resume should be compared against what the posting says right now.
  - *Pain point:* saved jobs don't include a description. Each site is different, so I use the Greenhouse, Lever, Ashby and Workday APIs, schema.org JobPosting data or page text, and let students paste it when none work.
- **Read requirements and skills only from qualifications and responsibilities sections.**
  - *Why:* that's what the job actually asks for.
  - *Pain point:* "Solomon Graf experience as a 2026 intern" and "Semgrep, the leader in code security…" were read as requirements, and "we support Ruby, PHP" counted as required skills.
- **Stage 1: Voyage AI `voyage-4` embeddings** (`input_type="document"` for resume lines, `"query"` for the job).
  - *Why:* it's tuned for code and engineering terms ("Next.js" ↔ "React"), its 200M free tokens need no card, and the voyage-4 models share one vector space.
  - *Pain point:* it's a hosted API, so resumes need PII protection, and it needs a key. Without one, analysis still runs with stages 1.1 and 2, re-weighted.
- **Stage 1.1: BM25 with a tech-skills dictionary.**
  - *Why:* recruiters' ATS filters look for exact strings like "Kubernetes" or "C++".
  - *Pain point:* false positives from "go to", "the rest of", "node the tree", and "C" inside "Objective-C". Short names now only count in their usual capitalization, and hyphens count as part of a word.
- **Stage 2: a local cross-encoder** (ms-marco MiniLM, FlashRank's model family) via ONNX Runtime.
  - *Why:* reranking runs on my own CPU with no external API, so no extra data leaves the server.
  - *Pain point:*
    - FlashRank is a Python library and my server is Node.
    - It runs about 10–27 ms per resume line on my Intel Mac, not under 20 ms per batch.
    - Its raw scores needed calibration (relevant ≈ −4…+2, unrelated ≈ −10).
- **Redact PII locally, keep only Experience / Projects / Skills / Education, and store the PDF separately.**
  - *Why:* sending raw resumes to a hosted API creates GDPR/CCPA risk.
  - *Pain point:* resumes are full of personal info. Signed-in PDFs stay in private storage, and guests' never leave their device except in memory for one request.
- **A "what to improve" checklist computed on the server**, prioritized and with point estimates.
  - *Why:* a score alone doesn't tell a student what to do next. The checklist uses the same evidence as the score, so it's instant, free and private.
  - *Pain point:* students need practical next steps (which keywords, which bullets, what numbers), not generic advice.
- **Gemini bullet rewrites only when the student opts in.**
  - *Why:* rewriting needs the resume text, and students should decide whether it goes to Google. The button says exactly what gets sent.
  - *Pain point:* in testing, a rewrite added a claim the original didn't make ("improving database throughput"). Rewrites are shown next to the originals, with unknown numbers as [placeholders] and a reminder to keep only what's true.
- **Eightfold's 4 tier names with my own weights and cutoffs.**
  - *Why:* students know those labels from real portals.
  - *Pain point:* Eightfold's formula isn't public, so the report says it's my calibration. Test jobs scored Strong 80, Weak 22 and Weak 2.

#### Ginny: Ask Gemini
- **Show each tool with the logo of the AI behind it** (Voyage AI on ATS match analysis, Google Gemini on Ask Gemini), bundled in `public/logos/`.
  - *Why:* students can see at a glance which AI does what.
  - *Pain point:* Voyage's site favicon now shows MongoDB's leaf (MongoDB acquired Voyage AI), so I used Voyage's own "V" icon, and Gemini's official sparkle from Google.
- **Gemini 3.8 Flash through the Interactions API** (`POST /v1beta/interactions`).
  - *Why:* it's the current free Flash model, and Google now serves new models through this API.
  - *Pain point:* Gemini 1.5 Flash was retired in 2025, Gemini 2.5 Flash came back "no longer available to new users", and newer models returned 404 on the old `generateContent` endpoint.
- **Try Google Search grounding, fall back to an answer without it.**
  - *Why:* sources make company-specific answers trustworthy, and Gemini can't log in to Glassdoor.
  - *Pain point:* on this free key, every model returned "quota exceeded" with search turned on. Answers without search say they have no live sources.
- **Retry overloaded models, then fall back to Gemini 3.7 / 3.5 Flash.**
  - *Why:* students shouldn't see a failure because of a temporary demand spike.
  - *Pain point:* Gemini 3.8 Flash often replied "currently experiencing high demand" (503).
- **Render chat answers with a small, safe Markdown formatter** (bold, bullets, headings as React elements, no raw HTML).
  - *Why:* Gemini answers in Markdown, and showing raw `**` and `*` was hard to read.
  - *Pain point:* readability, without opening an HTML-injection hole.
- **Suggested questions auto-filled from the selected job and profile.**
  - *Why:* students shouldn't retype role, company and visa type.
  - *Pain point:* typing the same details again and again.
- **Send Gemini only role, company and non-identifying profile facts.**
  - *Why:* it doesn't need the resume, name or email to answer.
  - *Pain point:* privacy.

#### Interview: behavioral voice practice
- **OpenAI Realtime API over WebRTC, with a short-lived client secret from the server.**
  - *Why:* WebRTC gives low-latency, two-way voice straight from the browser, with echo cancellation. The server keeps `OPENAI_API_KEY` and only hands out a per-session secret, with the instructions, voice, turn detection and tools baked in.
  - *Pain point:* a voice agent needs real-time audio, but the API key must never reach the browser. The GA Realtime API also changed from beta (`/v1/realtime/client_secrets` and `/v1/realtime/calls`, model `gpt-realtime-2.1`).
- **Company personas as system instructions** (Generic, Google, Amazon, Meta), with "North West, Senior Software Engineer at (company)".
  - *Why:* each company grades behavioral answers differently: Google on scale and "I" vs. "we", Amazon on Leadership Principles and metrics, Meta on speed and ownership.
  - *Pain point:* generic mock interviews don't prepare students for company-specific bars.
- **STAR feedback through function calling** (`update_star_progress`), shown as four S / T / A / R boxes.
  - *Why:* the model judges each STAR part as you speak, and the app turns that into instant green / yellow / red feedback without waiting for the end.
  - *Pain point:* students often skip the Result or give no numbers, and only find out after the interview.
- **An extra `start_new_question` tool.**
  - *Why:* the boxes need to reset for each question, and showing the question helps students stay on track.
  - *Pain point:* without it, the boxes from the last answer would bleed into the next one.
- **Explain OpenAI credit problems in plain words.**
  - *Why:* "connection failed" doesn't tell anyone what to fix.
  - *Pain point:* the Realtime API has no free tier. At first, creating the session worked (that step is free), but the WebRTC connection returned 429 `insufficient_quota` because the account had no credits. After credits were added, a live session worked end to end: North West greeted the candidate, asked a question, called `start_new_question` so it showed on screen, and live captions and the speaking indicator updated. STAR box colors still need checking with a real spoken answer; a headless test browser's fake microphone only plays a beep.
- **A camera self-view next to the STAR boxes, kept on the device.**
  - *Why:* practicing on camera feels like a real video interview (eye contact, posture), and the camera never leaves the browser.
  - *Pain point:* privacy, plus a timing bug. The camera and the voice session start in parallel, so if the session ended while the camera was still turning on, the camera came on afterwards and stayed on. It now checks it's still wanted before turning on, and every way of ending a session turns it off.
- **An OpenAI badge that wiggles while the agent talks**, and the OpenAI logo on the start button.
  - *Why:* students can see at a glance when the interviewer is speaking versus listening, like familiar AI voice agents.
  - *Pain point:* OpenAI's favicon is a black mark on a solid white square, which looked wrong on the purple button. I turned it into transparent white and black versions (`public/logos/openai-white.png` and `openai.png`).
- **The interviewer is named North West.**
  - *Why:* a consistent, friendly name makes the practice feel like talking to a real interviewer.
  - *Pain point:* none; the name is set in the system instructions and the on-screen labels.

- **Short turns, semantic turn detection, and a 15-minute cap.**
  - *Why:* students should do most of the talking, North West shouldn't cut them off mid-thought, and voice sessions cost money.
  - *Pain point:* voice agents tend to ramble and interrupt, and an open session can run up API usage.

#### Interview: technical practice (NeetCode 150)
- **Fetch problem statements from LeetCode's public GraphQL endpoint and cache them on the server**, the same way the job feed works.
  - *Why:* students get the real statements, examples and starter code, and LeetCode is asked once a week at most (one request at a time), not on every card flip.
  - *Pain point:* 7 of the 150 are LeetCode Premium (Encode and Decode Strings, Walls and Gates, Graph Valid Tree, Number of Connected Components, Alien Dictionary, Meeting Rooms I & II). For those the API returns test inputs and signatures but no statement, so I wrote my own statements and starter code (`server/neetcode/premium.js`).
- **Run students' code in the browser, not on the server.**
  - *Why:* running untrusted code on our server is a security risk and costs money. In the browser it's sandboxed in a Web Worker, free, and works for guests.
  - *Pain point:* LeetCode is mostly Python, and browsers don't run Python. Pyodide fixes that but weighs about 10 MB, so it loads only when Python is picked, from a CDN, and is cached afterwards. A harness written in both Python and JavaScript builds `ListNode` / `TreeNode` inputs and turns answers back into plain JSON.
- **Write a reference solution for every problem, and check them against LeetCode's own examples.**
  - *Why:* LeetCode's API gives example inputs but not the answers, and Submit needs hidden tests whose answers nobody types in by hand.
  - *Pain point:* a wrong reference would wrongly fail students. `npm run check:neetcode` reads the example outputs on every problem page (357 of them, including my Premium write-ups) and checks each reference against them; all pass.
- **Special judges for the tricky problems.**
  - *Why:* several problems don't have one exact right answer, or need special setup:
    - any-order lists, plus topological orders (Course Schedule II, Alien Dictionary) and Longest Palindromic Substring ("bab" or "aba");
    - in-place `void` problems (Rotate Image, Reorder List);
    - a cycle built from `pos` (Linked List Cycle) and node arguments (LCA of a BST);
    - deep copies (Copy List with Random Pointer, Clone Graph), checked so they don't reuse the original nodes;
    - round trips (Serialize/Deserialize, Encode/Decode);
    - the 9 design classes (LRU Cache, Min Stack, Twitter, …).
  - *Pain point:* a plain equality check would mark correct answers wrong. I tested both harnesses with LeetCode-style solutions in Python and JavaScript for each special case.
- **Hidden tests sized for a browser.**
  - *Why:* Pyodide's Python has a smaller recursion limit than LeetCode's, so a deep recursive DFS on a huge grid could crash even though it's correct.
  - *Pain point:* I kept hidden tests to edge cases plus moderately sized inputs (e.g. 20×20 grids, lists of up to 1,000), removed tests whose answers could overflow, and checked every test against the problem's constraints. For example, Reverse Bits now requires even numbers, and K Closest Points had a tie.
- **A "Hint: template" that shows the concept's skeleton but doesn't write the code.**
  - *Why:* students should learn to adapt the pattern themselves, not paste it.
- **Concept walkthroughs that run the real algorithm.**
  - *Why:* each animation comes from actually running the concept's skeleton on a small example and recording every step, so the picture, the highlighted line and the numbers always agree.
  - *Pain point:* 18 different shapes of data (arrays with pointers, linked-list arrows, trees, tries, decision trees, graphs, DP tables, intervals, bits) needed their own renderers, and the Roadmap had to fit NeetCode's wide diagram on a phone screen.
- **Lazy-load the Technical tab.**
  - *Why:* the code editor and walkthroughs added about 620 KB, which would have nearly quadrupled the app's first download (229 KB). The rest of the app stays the same size; the Technical tab downloads when it's opened.
- **Keep the disk free during browser tests.**
  - *Pain point:* the Mac's disk filled up while I was testing (headless Chrome caches, plus Pyodide). I now run tests with caching off and delete the browser profile afterwards.

#### Connect
- **Link to LinkedIn's People tab with a `keywords` filter instead of scraping LinkedIn.**
  - *Why:* LinkedIn's terms don't allow scraping, and students need to be signed in to their own LinkedIn to message people anyway. A link that opens the filtered People tab gets them there in one tap.
  - *Pain point:* the link only works with the company's LinkedIn page name, which often differs from the company name (Jane Street → `jane-street-global-trading`, Gusto → `zenpayroll`, Tesla → `tesla-motors`). I listed the page names for the companies Tepobaby tracks, guess the rest from the name, and let students fix a wrong page or fall back to LinkedIn search.
- **Look up the school name from the `.edu` domain on the server.**
  - *Why:* LinkedIn filters by the school's name ("Whitman College"), but sign-in only gives an email (`@whitman.edu`).
  - *Pain point:* there's no official domain-to-school list. The open Hipo university-domains list covers U.S. schools well; the server keeps just the U.S. ones (about 100 KB), refreshes monthly, and handles subdomains (`cs.stanford.edu`). Campus suffixes are trimmed ("University of Michigan - Ann Arbor" → "University of Michigan"), since that's how most LinkedIn profiles list it. If a school isn't found, the student can type it.
- **Keep messages under 300 characters.**
  - *Why:* LinkedIn caps connection-request notes at 300 characters (fewer on free accounts), and a cut-off message looks careless.
  - *Pain point:* the first draft of the outreach message ran about 310 characters with a typical name. I tightened the wording, and a live counter warns when a long name or school pushes it over.
- **End with the referral question, styled as a quote.**
  - *Why:* asking a stranger for a referral up front rarely works. Asking to reach out again about roles that fit is a softer way to set up a referral later, and the quote styling makes it stand out as the one line to remember.

#### Platform & tooling
- **Pin `@huggingface/transformers` 3.8.1** (ONNX Runtime 1.21), and add a `Promise.try` polyfill for `unpdf`.
  - *Why:* my Intel Mac runs Node 20.
  - *Pain point:* the newest ONNX Runtime dropped Intel Macs, and the PDF library needed Node 22.
- **Reinstall packages cleanly after the disk filled up.**
  - *Why:* the half-finished install left broken packages.
  - *Pain point:* the AI libraries are large, and the disk ran out of space mid-install.
- **React effects never return values.**
  - *Why:* newer Chrome returns a Promise from `scrollIntoView()`, and React treats any return as a cleanup function.
  - *Pain point:* the chat screen crashed on open.
- **Rate limits** (30 analyses, 15 tailored rewrites, 40 questions and 20 uploads per hour per user/IP).
  - *Why:* free API quotas can be drained.
  - *Pain point:* shared free tiers.

#### Sign-in & onboarding
- **Google sign-in with a full-page redirect.**
  - *Why:* it works in every browser.
  - *Pain point:* the popup never came back in in-editor browsers or the iPhone Home Screen app.
- **Check `.edu` on the server.**
  - *Why:* a browser check can be bypassed.
  - *Pain point:* security. The server verifies Google's ID token.
- **Clean up answers when questions change.**
  - *Why:* students shouldn't redo everything.
  - *Pain point:* questions changed after students had already answered, so now they only answer the new section.


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
| `VOYAGE_API_KEY` | Server | Voyage AI key for Ginny's semantic matching (free tier). Optional: without it, ATS analysis uses BM25 + the local reranker. |
| `VOYAGE_MODEL` | Server | Optional. Default `voyage-4`. |
| `GEMINI_API_KEY` | Server | Gemini key for Ask Gemini and tailored rewrites (free tier). Server-only, never sent to the browser. |
| `GEMINI_MODEL` | Server | Optional. Default `gemini-3.8-flash` (Interactions API). |
| `OPENAI_API_KEY` | Server | OpenAI key for Interview → Behavioral voice practice (Realtime API, paid: the account needs credits). Server-only; the browser gets short-lived session secrets. |
| `OPENAI_REALTIME_MODEL` | Server | Optional. Default `gpt-realtime-2.1`. |
| `OPENAI_REALTIME_VOICE` | Server | Optional. Default `marin`. |
| `OPENAI_TRANSCRIBE_MODEL` | Server | Optional. Transcribes what you say. Default `gpt-4o-mini-transcribe`. |
| `GEMINI_FALLBACK_MODELS` | Server | Optional. Comma-separated models to try when the main one is overloaded. Default `gemini-3.7-flash,gemini-3.5-flash`. |

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
| `GET /api/ginny/status` | Which Ginny pieces are set up (Voyage, Gemini, reranker) and the tier cutoffs |
| `GET` / `PUT` / `DELETE /api/ginny/resume` | The signed-in student's resume (PUT body = PDF bytes) |
| `POST /api/ginny/ats` | ATS match analysis for one job (guests send their PDF with the request) |
| `GET /api/interview/status` | Whether voice practice is set up, and the interviewer options |
| `POST /api/interview/session` | Short-lived OpenAI Realtime client secret for one behavioral interview (company persona + STAR tools baked in) |
| `GET /api/connect/school` | The signed-in student's school name, from their `.edu` email domain |
| `GET /api/neetcode` | The NeetCode 150 list (number, title, difficulty, category) and the 18 concepts |
| `GET /api/neetcode/problem/:slug` | One problem: statement (from LeetCode, cached), signature, starter code, accepted concepts, example tests and hidden tests with expected answers |
| `POST /api/neetcode/expected` | Expected answer for a custom test input, from the reference solution (3-second limit, 40 a minute per IP) |
| `POST /api/ginny/tailor` | Opt-in Gemini rewrites of the resume for the selected job (sends the redacted resume sections) |
| `POST /api/ginny/chat` | Ask Gemini about the selected job |
| `GET /api/logo/:domain` | A logo, cached by the server (only for companies in current postings, the tier list, or suggested programs) |
