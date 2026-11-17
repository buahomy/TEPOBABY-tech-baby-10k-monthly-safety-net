import { expect, test, type Page } from "@playwright/test";
import { sierraProblemById } from "../shared/sierra/problems.js";

// Interview → Technical → Sierra OA: TypeScript is compiled and graded in the browser, parts unlock in
// order, and a run that breaks an earlier part is caught.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: /30-second demo/i }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Interview" }).click();
  await page.getByRole("tab", { name: "Technical" }).click();
  await page.getByRole("tab", { name: /Sierra OA/ }).click();
  await expect(page.getByRole("heading", { name: "Sierra OA" })).toBeVisible();
});

async function replaceCode(page: Page, code: string) {
  const editor = page.locator(".so-ide .cm-content");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

// On a phone the question, code and tests are separate tabs; on desktop they're all visible.
async function showPane(page: Page, name: "Question" | "Code" | "Tests") {
  const tab = page.locator(".so-ide .nc-ide-tabs").getByRole("button", { name, exact: true });
  if (await tab.isVisible()) await tab.click();
}
const showTests = (page: Page) => showPane(page, "Tests");

test("starter code fails, a correct solution unlocks the next part", async ({ page }) => {
  await page.getByRole("button", { name: /Debug log intervals/ }).click();
  const ide = page.getByRole("dialog", { name: "Debug log intervals" });
  await expect(ide).toBeVisible();
  await showPane(page, "Question");
  await expect(ide.getByRole("tab", { name: /Part 2/ })).toBeDisabled();

  await ide.getByRole("button", { name: /Test part 1/ }).click();
  await showTests(page);
  await expect(ide.getByText("0/7 passed")).toBeVisible();

  await showPane(page, "Code");
  await replaceCode(page, sierraProblemById.get("intervals")!.reference);
  await ide.getByRole("button", { name: /Test part 1/ }).click();
  await showTests(page);
  await expect(ide.getByText(/Part 2 is unlocked/)).toBeVisible();
  await expect(ide.getByRole("button", { name: /Test part 2/ })).toBeVisible();

  await ide.getByRole("button", { name: /Test part 2/ }).click();
  await showTests(page);
  await expect(ide.getByText(/All 2 parts pass/)).toBeVisible();

  await ide.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: /Debug log intervals/ })).toHaveClass(/is-done/);
});

test("async project tests run against the flaky mock service", async ({ page }) => {
  await page.getByRole("button", { name: /Conversation history loader/ }).click();
  const ide = page.getByRole("dialog", { name: "Conversation history loader" });
  await replaceCode(page, sierraProblemById.get("history")!.reference);
  for (const n of [1, 2, 3]) {
    await ide.getByRole("button", { name: new RegExp(`Test part ${n}`) }).click();
    await showTests(page);
    await expect(ide.getByText(n < 3 ? `Part ${n + 1} is unlocked` : "All 3 parts pass", { exact: false })).toBeVisible({ timeout: 30_000 });
  }
});

test("a TypeScript error is reported as a compile error", async ({ page }) => {
  await page.getByRole("button", { name: /Related catalog items/ }).click();
  const ide = page.getByRole("dialog", { name: "Related catalog items" });
  await replaceCode(page, "function related(catalog: Record<string, string[]>, item: string {\n  return [];\n}");
  await ide.getByRole("button", { name: /Test part 1/ }).click();
  await showTests(page);
  await expect(ide.getByText("Compile error")).toBeVisible();
});

test("a mock OA starts a timer with two easy questions and a project", async ({ page }) => {
  await page.getByRole("button", { name: "Start a timed mock OA" }).click();
  await page.locator("#so-mock-minutes").selectOption("60");
  await page.getByRole("button", { name: "Start the clock" }).click();
  await expect(page.getByText("Mock OA in progress")).toBeVisible();
  await expect(page.locator(".so-big-clock")).toHaveText(/^(60:00|59:5\d)$/);
  await expect(page.locator(".so-mock .so-card")).toHaveCount(3);
  await page.getByRole("button", { name: /I'm done/ }).click();
  await expect(page.getByRole("heading", { name: "Record your reflection" })).toBeVisible();
  await page.getByRole("button", { name: "Save result and finish" }).click();
  await expect(page.getByRole("heading", { name: "Mock OA history" })).toBeVisible();
});

test("no sideways scrolling on the Sierra OA page", async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
