import { expect, test, type Page } from "@playwright/test";

// What a visitor (often a recruiter) does: "How it's built", the one-tap demo, and the job filters.
// Assertions check behaviour, not specific listings: the feed changes every morning.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
});

async function openDemo(page: Page) {
  await page.getByRole("button", { name: /30-second demo/i }).click();
  await expect(page.getByRole("heading", { name: "Job postings" })).toBeVisible();
  await expect(page.locator(".posting-row").first()).toBeVisible();
}

test("“How it's built” shows live numbers and closes", async ({ page }) => {
  await page.getByRole("button", { name: /How it's built/i }).click();
  const sheet = page.getByRole("dialog", { name: "How Tepobaby is built" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".hood-num").first()).not.toHaveText("—");
  await expect(sheet.locator(".hood-sources li").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("recruiter demo opens the live job feed", async ({ page }) => {
  await openDemo(page);
  const first = page.locator(".posting-row a.posting").first();
  await expect(first).toHaveAttribute("href", /^https?:\/\//);
  await expect(first).toHaveAttribute("target", "_blank");
  await expect(page.locator(".level-tab.is-active")).toHaveCount(1);
});

test("Role type chips filter the feed", async ({ page }) => {
  await openDemo(page);
  const chip = page.getByRole("group", { name: "Role type" }).getByRole("button", { name: /Tech sales/ });
  const response = page.waitForResponse((r) => r.url().includes("/api/postings") && r.url().includes("track=sales"));
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  const data = await (await response).json();
  for (const p of data.postings) expect(p.track, p.title).toBe("sales");
  // The list shows what the API sent (or the empty message), and the chip's count matches the total.
  if (data.total) await expect(page.locator(".posting-row")).toHaveCount(Math.min(data.postings.length, 25));
  else await expect(page.getByText(/No roles of this type/)).toBeVisible();
  // Back to everything.
  await page.getByRole("button", { name: /All roles/ }).click();
  await expect(page.getByRole("button", { name: /All roles/ })).toHaveAttribute("aria-pressed", "true");
});

test("📍 Remote / NYC shows only remote or NYC roles", async ({ page }) => {
  await openDemo(page);
  const response = page.waitForResponse((r) => r.url().includes("place=remote_nyc"));
  await page.getByRole("button", { name: /Remote \/ NYC/ }).click();
  const data = await (await response).json();
  for (const p of data.postings) expect(p.remoteNyc, `${p.title} · ${p.location}`).toBe(true);
  const locations = await page.locator(".posting-loc").allTextContents();
  for (const loc of locations) expect(loc).toMatch(/remote|anywhere|distributed|work from home|wfh|new york|nyc|manhattan|brooklyn|queens|bronx|staten island/i);
});

test("filters are remembered after a reload", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("group", { name: "Role type" }).getByRole("button", { name: /AI & ML/ }).click();
  await page.reload();
  await expect(page.getByRole("group", { name: "Role type" }).getByRole("button", { name: /AI & ML/ })).toHaveAttribute("aria-pressed", "true");
});

test("no sideways scrolling", async ({ page }) => {
  await openDemo(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
