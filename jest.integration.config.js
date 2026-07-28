// Integration tests run against a real Postgres database, so they are kept in a
// separate project from the mocked unit suites: node environment (no jsdom),
// their own setup file, and a longer timeout for real I/O.
//
// Requires DATABASE_URL to point at a disposable database with migrations
// applied. See `bun run test:integration` and the `integration` CI job.
const nextJest = require("next/jest")

const createJestConfig = nextJest({ dir: "./" })

const customJestConfig = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.integration.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/integration/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
  // A built .next/standalone tree contains a second package.json, which trips
  // jest-haste-map's name collision detection.
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  // Real database round-trips; the default 5s is too tight for cold starts.
  testTimeout: 30000,
  // Suites share one database, so run them serially to avoid cross-talk.
  maxWorkers: 1,
}

module.exports = async () => {
  const config = await createJestConfig(customJestConfig)()
  config.transformIgnorePatterns = [
    "/node_modules/(?!(react-icons|@radix-ui|class-variance-authority|tailwind-merge|nanoid|@t3-oss)/)",
    "^.+\\.module\\.(css|sass|scss)$",
  ]
  return config
}
