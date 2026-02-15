import { defineConfig, devices } from "@playwright/test"

const isCI = Boolean(process.env.CI)
const runAllProjects = process.env.PLAYWRIGHT_ALL_PROJECTS === "true"
const defaultBaseURL = "http://localhost:3101"
const skipClerkAuthHandshake = process.env.SKIP_CLERK_AUTH_HANDSHAKE ?? "1"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || defaultBaseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: runAllProjects
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
        {
          name: "Mobile Chrome",
          use: { ...devices["Pixel 5"] },
        },
        {
          name: "Mobile Safari",
          use: { ...devices["iPhone 12"] },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ],

  webServer: {
    command:
      process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ||
      `bash -lc 'set -a; [ -f .env.ci.example ] && source .env.ci.example; set +a; SKIP_ENV_VALIDATION=1 SKIP_CLERK_AUTH_HANDSHAKE=${skipClerkAuthHandshake} NEXT_PUBLIC_APP_URL=http://localhost:3101 PORT=3101 npm run build && SKIP_ENV_VALIDATION=1 SKIP_CLERK_AUTH_HANDSHAKE=${skipClerkAuthHandshake} NEXT_PUBLIC_APP_URL=http://localhost:3101 PORT=3101 npm run start'`,
    url: process.env.PLAYWRIGHT_TEST_BASE_URL || defaultBaseURL,
    reuseExistingServer: false,
    timeout: 180000,
  },
})
