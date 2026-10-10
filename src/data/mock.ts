// Sample data until the scraping pipeline and real APIs exist.
// Shapes here are what the backend should eventually return.

export type Difficulty = "Easy" | "Medium" | "Hard";

export type InterviewQuestion = {
  id: string;
  company: string;
  role: string;
  round: string; // e.g. "OA", "Phone screen", "Onsite – coding"
  type: "behavioral" | "technical";
  question: string;
  difficulty?: Difficulty;
  source: "Glassdoor" | "Reddit" | "LeetCode Discuss" | "Blind";
  postedHoursAgo: number;
};

export const questions: InterviewQuestion[] = [
  { id: "q1", company: "Google", role: "SWE Intern", round: "Phone screen", type: "technical", question: "Given a list of meeting intervals, return the minimum number of rooms needed.", difficulty: "Medium", source: "Glassdoor", postedHoursAgo: 20 },
  { id: "q2", company: "Google", role: "SWE Intern", round: "Onsite – Googleyness", type: "behavioral", question: "Tell me about a time you disagreed with a teammate. How did you resolve it?", source: "Glassdoor", postedHoursAgo: 40 },
  { id: "q3", company: "Meta", role: "SWE Intern", round: "Technical screen", type: "technical", question: "Return the k closest points to the origin.", difficulty: "Medium", source: "LeetCode Discuss", postedHoursAgo: 60 },
  { id: "q4", company: "Amazon", role: "SDE Intern", round: "OA", type: "technical", question: "Find the number of islands in a 2D grid.", difficulty: "Medium", source: "Reddit", postedHoursAgo: 30 },
  { id: "q5", company: "Amazon", role: "SDE Intern", round: "Final – Leadership Principles", type: "behavioral", question: "Tell me about a time you took ownership of something outside your responsibilities.", source: "Glassdoor", postedHoursAgo: 70 },
  { id: "q6", company: "Capital One", role: "Data Analyst Intern", round: "Case interview", type: "technical", question: "Write SQL to find the top 3 customers by monthly spend.", difficulty: "Easy", source: "Glassdoor", postedHoursAgo: 100 },
  { id: "q7", company: "Stripe", role: "SWE Intern", round: "Onsite – bug squash", type: "technical", question: "Debug a failing rate limiter in an unfamiliar codebase.", difficulty: "Hard", source: "Blind", postedHoursAgo: 130 },
  { id: "q8", company: "Microsoft", role: "Explore Intern", round: "Interview", type: "behavioral", question: "Why are you interested in software engineering?", source: "Glassdoor", postedHoursAgo: 150 },
];

export type CompanyTier = {
  company: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  dsaLevel: string;
  notes: string;
};

export const companyTiers: CompanyTier[] = [
  { company: "Google", tier: "Tier 1", dsaLevel: "Medium – Hard", notes: "Graphs, DP; expect follow-ups on complexity." },
  { company: "Meta", tier: "Tier 1", dsaLevel: "Medium", notes: "Two problems in 45 min. Speed matters." },
  { company: "Stripe", tier: "Tier 1", dsaLevel: "Practical", notes: "Real-world coding and bug fixing, little LeetCode." },
  { company: "Amazon", tier: "Tier 2", dsaLevel: "Easy – Medium", notes: "Leadership Principles weigh as much as coding." },
  { company: "Capital One", tier: "Tier 2", dsaLevel: "Easy", notes: "Case interviews and SQL for data roles." },
  { company: "Mid-size / contractor", tier: "Tier 3", dsaLevel: "Easy", notes: "Often take-home or resume walkthrough." },
];

export type Opportunity = {
  name: string;
  company: string;
  forYears: string[];
  deadline: string;
  link: string;
  description: string;
};

export const opportunities: Opportunity[] = [
  { name: "Explore Program", company: "Microsoft", forYears: ["Freshman", "Sophomore"], deadline: "Usually opens Aug–Sep", link: "https://careers.microsoft.com/", description: "12-week internship rotating across SWE and PM for first- and second-year students." },
  { name: "STEP Internship", company: "Google", forYears: ["Freshman", "Sophomore"], deadline: "Usually opens Sep–Oct", link: "https://buildyourfuture.withgoogle.com/", description: "Student Training in Engineering Program for early-year CS students." },
  { name: "Meta University", company: "Meta", forYears: ["Freshman", "Sophomore"], deadline: "Usually opens Aug–Sep", link: "https://www.metacareers.com/", description: "Paid internship for early-year students from underrepresented communities." },
  { name: "Future Talent", company: "Amazon", forYears: ["Freshman", "Sophomore"], deadline: "Varies", link: "https://www.amazon.jobs/", description: "Programs aimed at early-career and first-year students." },
];

export type Club = { name: string; forFirstGen?: boolean; forIdentity?: string[]; link: string };

export const clubs: Club[] = [
  { name: "ColorStack", forIdentity: ["Black", "Latinx"], link: "https://www.colorstack.org/" },
  { name: "SHPE", forIdentity: ["Latinx", "Hispanic"], link: "https://shpe.org/" },
  { name: "NSBE", forIdentity: ["Black"], link: "https://www.nsbe.org/" },
  { name: "Rewriting the Code", forIdentity: ["Woman"], link: "https://rewritingthecode.org/" },
  { name: "Code2040", forIdentity: ["Black", "Latinx"], link: "https://www.code2040.org/" },
  { name: "First-gen student org (check your campus)", forFirstGen: true, link: "#" },
  { name: "ACM (your campus chapter)", link: "https://www.acm.org/" },
];

export type JobPosting = {
  id: string;
  title: string;
  company: string;
  location: string;
  postedHoursAgo: number;
  directLink: string;
  linkedinCompany: string;
  contractor: boolean;
  sponsorsVisa: boolean;
  description: string;
};

export const jobs: JobPosting[] = [
  { id: "j1", title: "Software Engineering Intern, Summer", company: "Google", location: "Mountain View, CA", postedHoursAgo: 18, directLink: "https://careers.google.com/", linkedinCompany: "google", contractor: false, sponsorsVisa: true, description: "Build and test software in Python, Java, or C++. Data structures, algorithms, distributed systems." },
  { id: "j2", title: "Data Analyst Intern", company: "Capital One", location: "McLean, VA", postedHoursAgo: 50, directLink: "https://www.capitalonecareers.com/", linkedinCompany: "capital-one", contractor: false, sponsorsVisa: false, description: "SQL, Python, Tableau dashboards, statistics, stakeholder communication." },
  { id: "j3", title: "Frontend Developer (Contract)", company: "Robert Half", location: "Remote", postedHoursAgo: 90, directLink: "https://www.roberthalf.com/", linkedinCompany: "robert-half-international", contractor: true, sponsorsVisa: false, description: "React, TypeScript, CSS, REST APIs, accessibility, testing with Jest." },
];

export const infoInterviewQuestions = [
  "What does a normal week look like for you?",
  "What project are you most proud of on your team, and why?",
  "What surprised you most when you joined?",
  "What skills matter most in your day-to-day that school didn't teach?",
  "How did you prepare for your interviews here?",
  "What do you wish you had known as a student?",
];

export const referralCloser =
  "Would it be okay if I reached out to you again if I find any interesting roles that I think fit my experience?";

export const connectTemplate = (name: string, school: string, company: string) =>
  `Hi {first_name}, I'm ${name || "a student"} at ${school || "my university"} and saw you're at ${company}. I'd love to hear about your work there. Would you be open to a quick 15-minute chat?`;
