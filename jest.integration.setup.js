// Integration suites talk to a real database. Fail loudly rather than silently
// running against whatever DATABASE_URL happens to be set — pointing these at a
// real environment would truncate its tables.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set for integration tests. " +
      "Use a disposable database — these suites truncate tables between tests."
  )
}

if (!/test/i.test(process.env.DATABASE_URL)) {
  throw new Error(
    "Refusing to run integration tests: DATABASE_URL does not contain 'test'. " +
      "These suites truncate tables; point them at a disposable database."
  )
}
