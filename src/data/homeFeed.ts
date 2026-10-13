// Static content for the Home tab. Live job postings come from /api/postings (see src/utils/postings.ts).

export type Level = "underclassmen" | "internship" | "entry" | "rotational";

export const LEVELS: { id: Level; label: string }[] = [
  { id: "underclassmen", label: "Underclassmen Programs" },
  { id: "internship", label: "Internship" },
  { id: "entry", label: "Entry-level" },
  { id: "rotational", label: "Rotational Programs" },
];

// "open" (every program still listed, up to 60 days) is only offered on the Rotational Programs tab:
// programs like Microsoft's Finance Rotation Program stay open for weeks.
export const WINDOWS = [
  { id: "fresh", label: "Last 48–72h", maxHours: 72 },
  { id: "week", label: "This week", maxHours: 168 },
  { id: "open", label: "All open", maxHours: 1440 },
] as const;
export type WindowId = (typeof WINDOWS)[number]["id"];

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
