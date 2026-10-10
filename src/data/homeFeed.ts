// Static content for the Home tab. Live job postings come from /api/postings (see src/utils/postings.ts).

export type Level = "underclassmen" | "internship" | "entry";

export const LEVELS: { id: Level; label: string }[] = [
  { id: "underclassmen", label: "Underclassmen Programs" },
  { id: "internship", label: "Internship" },
  { id: "entry", label: "Entry-level" },
];

export const WINDOWS = [
  { id: "fresh", label: "Last 48–72h", maxHours: 72 },
  { id: "week", label: "This week", maxHours: 168 },
] as const;
export type WindowId = (typeof WINDOWS)[number]["id"];

// Tier list by interview difficulty (TierMaker style). Community-sourced and subjective — edit freely.
export type Tier = { id: string; label: string; detail: string; color: string; companies: string[] };

export const TIERS: Tier[] = [
  { id: "sd", label: "System Design", detail: "Design rounds even for early-career roles", color: "#ff7f7f", companies: ["Google", "Meta", "Netflix", "Databricks", "Stripe"] },
  { id: "hard", label: "Hard LC + DP & Advanced Graphs", detail: "Hard problems, dynamic programming, graph algorithms", color: "#ffbf7f", companies: ["Citadel", "Jane Street", "HRT", "Uber", "ByteDance"] },
  { id: "medium", label: "Medium LC", detail: "Arrays, trees, BFS/DFS, hashing", color: "#ffdf7f", companies: ["Amazon", "Microsoft", "Apple", "LinkedIn", "Bloomberg"] },
  { id: "easy", label: "Easy LC", detail: "Fundamentals, SQL, behavioral-heavy", color: "#bfff7f", companies: ["Capital One", "IBM", "Deloitte", "JPMorgan Chase", "Accenture"] },
];

// Contractor & startup job boards.
export type Resource = { name: string; detail: string; kind: "Startup" | "Contract"; url: string };

export const RESOURCES: Resource[] = [
  { name: "Work at a Startup (Y Combinator)", detail: "Apply once to hundreds of YC startups", kind: "Startup", url: "https://www.workatastartup.com/" },
  { name: "Wellfound", detail: "Startup jobs with salary and equity upfront", kind: "Startup", url: "https://wellfound.com/jobs" },
  { name: "Hacker News: Who is hiring?", detail: "Monthly thread of startups hiring now", kind: "Startup", url: "https://news.ycombinator.com/submitted?id=whoishiring" },
  { name: "Contra", detail: "Freelance and contract projects, no fees for talent", kind: "Contract", url: "https://contra.com/" },
  { name: "Upwork", detail: "Short-term dev, data and design contracts", kind: "Contract", url: "https://www.upwork.com/" },
  { name: "Robert Half Technology", detail: "Contract and contract-to-hire tech roles", kind: "Contract", url: "https://www.roberthalf.com/us/en/jobs" },
];
