// LinkedIn links for the Connect tab. A company's People tab lives at
// linkedin.com/company/<page>/people/, and ?keywords= filters it (a school name, "technical recruiter").
// The <page> name is set by each company, so common ones are listed here; anything else is a best
// guess the student can correct, with a plain people search as a fallback.

const PAGES: Record<string, string> = {
  stripe: "stripe",
  databricks: "databricks",
  openai: "openai",
  anthropic: "anthropicresearch",
  palantir: "palantir-technologies",
  netflix: "netflix",
  snowflake: "snowflake-computing",
  uber: "uber-com",
  citadel: "citadel-llc",
  "citadel securities": "citadel-securities",
  google: "google",
  meta: "meta",
  airbnb: "airbnb",
  tiktok: "tiktok",
  tesla: "tesla-motors",
  bloomberg: "bloomberg",
  "jane street": "jane-street-global-trading",
  "hudson river trading": "hudson-river-trading",
  "jump trading": "jump-trading",
  "two sigma": "two-sigma-investments",
  optiver: "optiver",
  imc: "imc-trading",
  "tower research": "tower-research-capital",
  "tower research capital": "tower-research-capital",
  sig: "susquehanna-international-group",
  "susquehanna international group": "susquehanna-international-group",
  "xtx markets": "xtx-markets",
  "akuna capital": "akuna-capital",
  amazon: "amazon",
  "amazon web services": "amazon-web-services",
  aws: "amazon-web-services",
  microsoft: "microsoft",
  apple: "apple",
  nvidia: "nvidia",
  linkedin: "linkedin",
  salesforce: "salesforce",
  adobe: "adobe",
  oracle: "oracle",
  coinbase: "coinbase",
  robinhood: "robinhood",
  doordash: "doordash",
  pinterest: "pinterest",
  snap: "snap-inc-co",
  "snap inc": "snap-inc-co",
  spotify: "spotify",
  lyft: "lyft",
  drw: "drw",
  point72: "point72",
  "old mission": "old-mission-capital",
  "old mission capital": "old-mission-capital",
  virtu: "virtu-financial",
  "virtu financial": "virtu-financial",
  "capital one": "capital-one",
  ibm: "ibm",
  intel: "intel-corporation",
  amd: "amd",
  cisco: "cisco",
  qualcomm: "qualcomm",
  "jpmorgan chase": "jpmorganchase",
  "jpmorgan chase & co": "jpmorganchase",
  jpmorgan: "jpmorganchase",
  "goldman sachs": "goldman-sachs",
  "morgan stanley": "morgan-stanley",
  visa: "visa",
  affirm: "affirm",
  airtable: "airtable",
  anduril: "anduril-industries",
  "anduril industries": "anduril-industries",
  asana: "asana",
  block: "joinblock",
  brex: "brexhq",
  cloudflare: "cloudflare",
  datadog: "datadog",
  discord: "discord",
  dropbox: "dropbox",
  duolingo: "duolingo",
  elastic: "elastic-co",
  "epic games": "epic-games",
  figma: "figma",
  flexport: "flexport",
  gitlab: "gitlab-com",
  gusto: "zenpayroll",
  instacart: "instacart",
  mongodb: "mongodbinc",
  okta: "okta-inc-",
  reddit: "reddit-com",
  "riot games": "riot-games",
  roblox: "roblox",
  rubrik: "rubrik-inc",
  samsara: "samsara",
  "scale ai": "scaleai",
  sofi: "sofi",
  spacex: "spacex",
  twilio: "twilio-inc-",
  twitch: "twitch-tv",
  vercel: "vercel",
  waymo: "waymo",
  zscaler: "zscaler",
  cohere: "cohere-ai",
  elevenlabs: "elevenlabsio",
  notion: "notionhq",
  perplexity: "perplexity-ai",
  ramp: "ramp",
  replit: "repl-it",
  supabase: "supabase",
};

const normalize = (company: string) =>
  company
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+(inc|llc|corp|corporation|co|ltd|lp|technologies|holdings|group)$/g, "")
    .trim();

/** The company's LinkedIn page name, and whether it's known or a guess. */
export function linkedinPage(company: string): { page: string; known: boolean } {
  const key = normalize(company);
  if (PAGES[key]) return { page: PAGES[key], known: true };
  const guess = key
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return { page: guess, known: false };
}

/** e.g. https://www.linkedin.com/company/google/people/?keywords=Whitman%20College */
export const peopleUrl = (page: string, keywords: string) =>
  `https://www.linkedin.com/company/${encodeURIComponent(page)}/people/?keywords=${encodeURIComponent(keywords.trim())}`;

/** Fallback when the company page name is wrong: LinkedIn's people search. */
export const searchUrl = (keywords: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords.trim())}`;

/** Copies text, falling back to a hidden textarea where the Clipboard API isn't available. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
