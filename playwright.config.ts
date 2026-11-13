import { defineConfig, devices } from "@playwright/test";

// End-to-end and API tests (npm run test:e2e). Starts the app locally (web on 5173, API on 8787)
// unless it's already running, and tests on a desktop browser and a phone-sized one.
export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // The API doesn't depend on screen size: its tests run once.
    { name: "api", testMatch: /api\.spec\.ts/ },
    { name: "desktop", testIgnore: /api\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "phone", testIgnore: /api\.spec\.ts/, use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
