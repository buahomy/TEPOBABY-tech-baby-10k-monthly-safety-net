import { expect, test } from "@playwright/test";

// The job feed API behind Home: input checks and that every filter returns only what it says.
const TRACKS = ["eng", "ai", "sales", "product", "data"] as const;

test("rejects an unknown level", async ({ request }) => {
  const res = await request.get("/api/postings?level=bogus");
  expect(res.status()).toBe(400);
});

test("returns postings with counts for every tab", async ({ request }) => {
  const d = await (await request.get("/api/postings?level=entry&window=open&limit=5")).json();
  expect(d.postings.length).toBeGreaterThan(0);
  expect(d.postings.length).toBeLessThanOrEqual(5);
  for (const lv of ["underclassmen", "internship", "entry", "rotational"]) {
    expect(d.counts[lv].fresh).toBeLessThanOrEqual(d.counts[lv].week);
    expect(d.counts[lv].week).toBeLessThanOrEqual(d.counts[lv].open);
  }
  for (const p of d.postings) {
    expect(p.url).toMatch(/^https?:\/\//);
    expect(p.level).toBe("entry");
  }
});

for (const track of TRACKS) {
  test(`role type "${track}" returns only that type`, async ({ request }) => {
    const d = await (await request.get(`/api/postings?level=entry&window=open&limit=200&track=${track}`)).json();
    expect(d.total).toBe(d.trackCounts[track]);
    for (const p of d.postings) expect(p.track, p.title).toBe(track);
  });
}

test("role type counts add up to no more than All roles", async ({ request }) => {
  const d = await (await request.get("/api/postings?level=entry&window=open&limit=1")).json();
  const sum = TRACKS.reduce((n, t) => n + d.trackCounts[t], 0);
  expect(sum).toBeLessThanOrEqual(d.trackCounts.all);
  expect(d.trackCounts.all).toBe(d.total);
});

test("Remote / NYC returns only remote or New York City roles", async ({ request }) => {
  const d = await (await request.get("/api/postings?level=entry&window=open&limit=200&place=remote_nyc")).json();
  expect(d.postings.length).toBeGreaterThan(0);
  for (const p of d.postings) {
    expect(p.remoteNyc, `${p.title} · ${p.location}`).toBe(true);
    expect(p.location).toMatch(/remote|anywhere|distributed|work from home|wfh|new york|nyc|manhattan|brooklyn|queens|bronx|staten island/i);
  }
});

test("ignores an unknown role type instead of failing", async ({ request }) => {
  const all = await (await request.get("/api/postings?level=entry&window=open&limit=1")).json();
  const bad = await (await request.get("/api/postings?level=entry&window=open&limit=1&track=nope")).json();
  expect(bad.total).toBe(all.total);
});

test("stats for “How it's built” are numbers", async ({ request }) => {
  const s = await (await request.get("/api/stats")).json();
  for (const k of ["postings", "companies", "sponsorshipRead", "research", "remoteNyc"]) expect(typeof s[k], k).toBe("number");
  expect(s.postings).toBeGreaterThan(0);
  expect(s.bySource.reduce((n: number, x: { count: number }) => n + x.count, 0)).toBe(s.postings);
});
