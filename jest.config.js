const nextJest = require("next/jest")

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^otplib$": "<rootDir>/__mocks__/otplib.js",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(react-icons|@radix-ui|class-variance-authority|tailwind-merge|nanoid|@t3-oss)/)",
  ],
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "!app/**/*.d.ts",
    "!app/**/*.stories.{js,jsx,ts,tsx}",
    "!app/**/_*.{js,jsx,ts,tsx}",
  ],
  // Pinned at the 2026-09-03 measured floor (29.16/23.83/21.65/29.84) minus
  // two points of slack. The point is that coverage cannot regress while it is
  // being raised. Raised deliberately; never lowered to make a build pass.
  coverageThreshold: {
    global: {
      statements: 27,
      branches: 21,
      functions: 19,
      lines: 27,
    },
  },
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/e2e/", // Playwright E2E tests run separately
    // Integration suites need a real Postgres database and run under
    // jest.integration.config.js via `bun run test:integration`.
    "/__tests__/integration/",
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async.
// next/jest prepends its own "/node_modules/" transformIgnorePatterns entry which would override our
// ESM allowlist above, so re-apply it after the async config resolves.
module.exports = async () => {
  const config = await createJestConfig(customJestConfig)()
  config.transformIgnorePatterns = [
    "/node_modules/(?!(react-icons|@radix-ui|class-variance-authority|tailwind-merge|nanoid|@t3-oss)/)",
    "^.+\\.module\\.(css|sass|scss)$",
  ]
  return config
}
