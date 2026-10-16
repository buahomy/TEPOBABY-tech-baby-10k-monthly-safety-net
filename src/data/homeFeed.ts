// Static content for the Home tab. Live job postings come from /api/postings (see src/utils/postings.ts).
import resources from "./resources.json";

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

// Contractor & startup job boards (src/data/resources.json; the server also reads it to serve their logos).

export type Resource = { name: string; detail: string; kind: "Startup" | "Contract"; url: string; domain: string };

export const RESOURCES = resources.boards as Resource[];
