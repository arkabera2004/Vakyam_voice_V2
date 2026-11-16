import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests against the Vite dev server. They never sign in, so
// they cover the public surface: login, reset, route guard, 404.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4317",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: {
    command: "npx vite --port 4317 --strictPort",
    url: "http://localhost:4317/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
