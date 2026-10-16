// Shared helpers for turning raw listings into Tepobaby postings.
//
// Posting shape (what /api/postings returns):
//   { id, source, company, title, location, url, postedAt (ISO), postedApprox (bool),
//     level: "underclassmen" | "internship" | "entry", sponsorship: "yes" | "no" | "citizens" | null,
//     program: true for rotational / development programs (shown in the Rotational Programs tab) }

const UNDERCLASS = /\b(freshman|freshmen|sophomore|first[- ]year|second[- ]year|underclass\w*|explore (program|intern)|early insight|discovery (program|day)|step intern|high school|pre-?university|insight program|extern(ship)?)\b/i;
const INTERN = /\b(intern|interns|internship|co-?op|summer analyst|summer associate|apprentice(ship)?)\b/i;
const ENTRY =
  /\b(new grad\w*|graduate|grad\b|entry[- ]level|junior|jr\.?|university|early[- ]career|campus|associate (software|engineer|developer|data)|(engineer|developer|analyst|scientist) (i|1)\b|level (i|1)\b|rotational|residency|fellowship)\b/i;
const TOO_SENIOR = /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp|vice president|architect|(engineer|developer|scientist) (ii|iii|iv|2|3|4))\b/i;

// Keep tech / tech-adjacent roles from broad sources (company job boards, HN, Google Jobs).
const TECH =
  /\b(software|engineer\w*|developer|swe|sde|data|machine learning|ml|ai|artificial intelligence|security|cyber|quant\w*|research|infrastructure|sre|devops|cloud|frontend|front-end|backend|back-end|full[- ]?stack|mobile|ios|android|web|product manag\w*|it support|systems|platform|firmware|embedded|robotics|computer|technology|analytics|forward deployed)\b/i;

// Rotational and early-career development programs in any function (finance, product, sales,
// engineering…), e.g. Microsoft's Finance Rotation Program (FRP) or Amazon's AFRP.
const PROGRAM =
  /\b(rotation|rotations|rotational|(leadership )?development program|(graduate|early[- ]career|analyst|associate) program|ldp|fldp|tdp|afrp|frp|launch graduate)\b/i;

export function isTech(title) {
  return TECH.test(title);
}

/** A rotational / development program that's open to students or new grads. */
// Not programs: work schedules ("Weekend Rotation", "on-call rotation") and programs for experienced hires.
const NOT_PROGRAM = /\b(weekend|on[- ]call|shift|night|holiday) rotations?\b|\bexperienced (professional|hire)s?\b/i;

export function isProgram(title) {
  return PROGRAM.test(title) && !NOT_PROGRAM.test(title) && !(TOO_SENIOR.test(title) && !ENTRY.test(title));
}

/** Tech roles, plus programs in any function. */
export const isRelevant = (title) => isTech(title) || isProgram(title);

/** Programs stay open for weeks, so they're kept longer than regular postings. */
export const maxAgeFor = (title) => (isProgram(title) ? PROGRAM_MAX_AGE_MS : MAX_AGE_MS);

/** Level from a role title, or null if it isn't early-career. `hint` comes from curated lists. */
export function classify(title, hint) {
  if (UNDERCLASS.test(title)) return "underclassmen";
  if (hint === "internship") return "internship";
  if (hint === "entry") return TOO_SENIOR.test(title) && !ENTRY.test(title) ? null : "entry";
  if (INTERN.test(title)) return "internship";
  if (ENTRY.test(title) && !TOO_SENIOR.test(title)) return "entry";
  if (isProgram(title)) return "entry";
  return null;
}

// ---- U.S. locations (company career sites list jobs worldwide) ----

const US_STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";
const US_STATE_NAMES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming";
const US_MARK = new RegExp(`\\b(USA?|United States|U\\.S\\.|${US_STATE_NAMES})\\b|,\\s*(${US_STATES})\\b|\\b(${US_STATES}),|^(${US_STATES})\\b|\\bremote\\b`, "");
const US_CITIES =
  /^(new york|seattle|redmond|bellevue|san francisco|san jose|santa clara|sunnyvale|mountain view|palo alto|austin|dallas|houston|chicago|boston|atlanta|charlotte|denver|los angeles|san diego|portland|indianapolis|phoenix|pittsburgh|raleigh|richmond|plano|mclean|arlington|nashville|miami|minneapolis|detroit|columbus|philadelphia|washington)\b/i;
const FOREIGN =
  /\b(canada|ontario|toronto|vancouver|montreal|(?<!new )mexico|jalisco|brazil|colombia|bogota|venezuela|argentina|chile|costa rica|uk|united kingdom|england|london|berkshire|ireland|dublin|germany|munich|berlin|france|paris|spain|madrid|italy|netherlands|amsterdam|belgium|switzerland|zurich|sweden|norway|denmark|finland|poland|pol|krak[oó]w|gdansk|czech|brno|prague|romania|hungary|turkey|istanbul|israel|tel aviv|india|bangalore|bengaluru|hyderabad|pune|chennai|china|prc|shanghai|beijing|shenzhen|hong kong|taiwan|taipei|japan|tokyo|korea|seoul|singapore|sgp|malaysia|penang|philippines|vietnam|indonesia|thailand|australia|sydney|melbourne|new zealand|uae|united arab emirates|dubai|saudi|qatar|egypt|south africa|nigeria|kenya|emea|apac|latam)\b/i;

/** True when a job location looks like it's in the U.S. (or is listed as several locations). */
export function isUSLocation(location = "") {
  const loc = String(location).trim();
  if (!loc || loc === "—") return true;
  if (FOREIGN.test(loc)) return false;
  return US_MARK.test(loc) || US_CITIES.test(loc) || /^\d+ locations?$/i.test(loc);
}

/** Titles written for a non-U.S. market ("Sales Path - German Speaking Market", "… - Mexico - 2027"). */
export const foreignTitle = (title = "") =>
  FOREIGN.test(title) || /\b(german|french|spanish|hebrew|danish|norwegian|swedish|dutch|italian|japanese|korean|mandarin|portuguese|polish|arabic|turkish|nordic|dach|bnl)\b[^-]*\b(speaking|market|path)\b|\b(speaking market)\b/i.test(title);

// ---- Sponsorship, from the job description ----
// Most lists no longer say whether a role sponsors visas (Simplify's field now reads "Other"), so the
// description is the source of truth. Strongest statement wins: U.S. citizens / clearance only →
// no sponsorship → sponsors. Anything else stays unknown (null): most postings don't say.

const NEG = /\b(not|no|never|without|nor)\b|n't\b/;
const US = "(?:u\\.?\\s?s\\.?|united states|us)";

// After a "citizens / clearance" match: an alternative for visa holders ("…or F-1 on CPT accepted"),
// or a value of "none" ("clearance level must be able to obtain: none") cancels it.
const OPEN_ALTERNATIVE = /^[^.]{0,120}\bor\b[^.]{0,80}\b(?:f-?1|visa|opt|cpt|work authorization|sponsor\w*|eligible to work)\b/;
const VALUE_NONE = /^[^.]{0,25}?[:\s]\s*(?:none|n\/a|not required|no)\b/;

/** A match that isn't negated by "not / no / never / n't" in the few words before it. */
function said(re, text, { strict = false } = {}) {
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, m.index - 32), m.index);
    if (NEG.test(before)) continue;
    if (strict) {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 200);
      if (OPEN_ALTERNATIVE.test(after) || VALUE_NONE.test(after)) continue;
    }
    return true;
  }
  return false;
}

const CITIZENS = [
  new RegExp(`\\b${US} citizenship (?:is |status is )?(?:required|needed|mandatory|a requirement)`, "g"),
  new RegExp(`\\bmust (?:also )?(?:be|hold) (?:a |an )?${US} citizen`, "g"),
  new RegExp(`\\b(?:only|solely|limited to) ${US} citizens`, "g"),
  new RegExp(`\\brequires? (?:you to be )?(?:a |an )?${US} citizen`, "g"),
  /\b(?:active |current )?(?:secret|top secret|ts\/sci|ts\s?\/\s?sci|public trust|dod|government) (?:security )?clearance (?:is |will be )?(?:required|needed|mandatory)/g,
  /\b(?:requires?|must (?:have|hold|possess|obtain)|ability to obtain|able to obtain|eligib\w+ (?:to obtain|for)) (?:and maintain )?(?:an? )?(?:active )?(?:u\.?s\.? )?(?:government |security |secret |top secret |ts\/sci )+clearance/g,
  /\bitar\b[^.]{0,120}\b(?:u\.?s\.? persons?|citizens?|permanent residents?)/g,
  /\bexport control[^.]{0,120}\bu\.?s\.? persons?\b/g,
];

const NO_SPONSOR = [
  /\b(?:unable|not able|cannot|can ?not|will not|won't|does not|do not|don't|doesn't|is not able|are not able|isn't able|not in a position)\s+(?:to\s+)?(?:currently\s+)?(?:offer|provide|support|consider|accommodate|pursue|file for|obtain)?\s*(?:any\s+)?(?:employment\s+|work\s+|visa\s+|immigration\s+|h-?1b\s+)*(?:visa\s+)?sponsor/g,
  /\bno\s+(?:visa\s+|immigration\s+|h-?1b\s+|employment\s+|work\s+)*sponsorship\b/g,
  // "Work authorization" + "require(s)" together: work authorization that must not need sponsorship.
  /\bwork authori[sz]ation (?:that|which) does not (?:now or in the future |currently or in the future |now or later )?require (?:\w+ ){0,3}sponsorship/g,
  /\b(?:requires?|required|must (?:have|possess|hold|already have)|need) (?:a |an )?(?:permanent|unrestricted|unlimited|indefinite|full) (?:u\.?\s?s\.? |united states |us )?work authori[sz]ation/g,
  /\b(?:permanent|unrestricted|unlimited) (?:u\.?\s?s\.? |us )?work authori[sz]ation (?:is |will be )?required/g,
  /\bnot (?:be )?eligible for (?:employer[- ]sponsored|company[- ]sponsored|sponsored) (?:work authori[sz]ation|visas?|employment authori[sz]ation)/g,
  /\b(?:does not|do not|will not|cannot|unable to) (?:provide|offer|support) (?:immigration|visa)[- ]related (?:sponsorship|support)/g,
  /\b(?:visa\s+|immigration\s+)?sponsorship\s*(?:available)?\s*[:\-–]\s*(?:not available|unavailable|none|no)\b/g,
  /\bsponsorship\s+(?:is|will|would)?\s*(?:not|n't)\s+(?:be\s+)?(?:available|offered|provided|supported|possible|considered|an option)/g,
  /\b(?:not|ineligible|isn't) (?:be )?eligible for (?:visa |immigration |employment |h-?1b )?sponsorship/g,
  /\bwithout (?:a |the |any )?(?:need|needing|requiring|requirement|necessity) (?:for |of )?(?:any )?(?:current or future |future or current |present or future |now or in the future |either now or in the future )?(?:visa |immigration |employer |employment |work |authorization |h-?1b )*sponsorship/g,
  /\b(?:eligible|authorized|able|permitted|legally authorized) to work in the (?:u\.?\s?s\.?|united states|us)\b[^.]{0,60}\bwithout (?:visa |employer |employment |immigration |any |the need for |requiring )*sponsorship/g,
  /\b(?:does not|do not|will not|cannot|unable to)\s+(?:support|accept|sponsor)\s+(?:candidates|applicants)?\s*(?:on|with|requiring)?\s*(?:an?\s+)?(?:f-?1|opt|cpt|stem opt|h-?1b|tn|j-?1)\b/g,
];

const YES_SPONSOR = [
  /\b(?:visa|h-?1b|immigration|work visa|employment visa) sponsorship (?:is |may be |will be |can be )?(?:available|offered|provided|supported|possible)/g,
  /\b(?:we|company|employer|[a-z]+ (?:inc|llc)) (?:will |can |do |does |may |is able to |are able to )?(?:offer|provide|support)s? (?:visa |h-?1b |immigration )?sponsorship/g,
  /\bwill sponsor\b/g,
  /\bsponsorship (?:is )?available\b/g,
  /\bopen to (?:sponsoring|sponsorship)\b/g,
  /\b(?:visa\s+|immigration\s+)?sponsorship\s*(?:available)?\s*[:\-–]\s*yes\b/g,
];

/** "citizens" | "no" | "yes" | null from a job description. */
export function sponsorshipFromText(raw = "") {
  if (!raw) return null;
  const text = String(raw)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ");
  if (CITIZENS.some((re) => said(re, text, { strict: true }))) return "citizens";
  if (NO_SPONSOR.some((re) => text.match(re))) return "no"; // these phrases carry their own negation
  if (YES_SPONSOR.some((re) => said(re, text))) return "yes";
  return null;
}

/** Simplify-style sponsorship text or emoji flags → yes / no / citizens / null (unknown). */
export function sponsorship(value = "", title = "") {
  const v = String(value).toLowerCase();
  if (v.includes("does not offer") || title.includes("🛂")) return "no";
  if (v.includes("citizenship") || title.includes("🇺🇸")) return "citizens";
  if (v.includes("offers sponsorship")) return "yes";
  return null;
}

export function cleanText(s = "") {
  return String(s)
    .replace(/<br\s*\/?>|<\/br>/gi, ", ")
    .replace(/<[^>]+>/g, "")
    .replace(/[🛂🇺🇸🔒🔥🎓]/gu, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip tracking params so the same job from two sources dedupes. */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|gh_src$)/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return url;
  }
}

export const DAY = 24 * 60 * 60 * 1000;
export const MAX_AGE_MS = 7 * DAY;
export const PROGRAM_MAX_AGE_MS = 60 * DAY;

export const USER_AGENT = "TepobabyJobsBot/1.0 (+student job aggregator; contact via repo)";

// Conditional-request cache: url → { etag, lastModified, body }. With `cache: true`, unchanged
// files come back as 304 Not Modified, so frequent polling of big lists costs almost nothing.
const httpCache = new Map();

async function get(url, { timeoutMs = 20000, headers = {}, cache = false } = {}) {
  const hit = cache ? httpCache.get(url) : undefined;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      ...(hit?.etag ? { "If-None-Match": hit.etag } : {}),
      ...(hit?.lastModified ? { "If-Modified-Since": hit.lastModified } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 304 && hit) return { body: hit.body, changed: false };
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const body = await res.text();
  if (cache) {
    httpCache.set(url, { etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"), body });
  }
  return { body, changed: true };
}

export async function fetchJson(url, opts = {}) {
  const { body } = await get(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  return JSON.parse(body);
}

export async function fetchText(url, opts = {}) {
  return (await get(url, opts)).body;
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
