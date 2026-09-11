/**
 * @jest-environment node
 */

/**
 * These pin the exact production incident this script was written for: eight
 * variables written from `.env.ci.example` with `echo`, each carrying a
 * trailing newline. It read as four unrelated outages — a model that 401'd,
 * dead real-time, no transactional mail, a Redis URL pointing nowhere — and
 * each was diagnosed separately before anyone noticed they were one push.
 */

import { readFileSync } from "node:fs"

import { inspect } from "@/app/lib/env-audit"

/** Every key `env.mjs` requires, so a case can isolate the check it is about. */
function withRequired(extra: Record<string, string> = {}): Map<string, string> {
  const base: Record<string, string> = {}
  const source = readFileSync("env.mjs", "utf8")
  for (const match of source.matchAll(/^\s+([A-Z_0-9]+): z\.[^\n]*/gm)) {
    if (!match[0].includes(".optional()")) base[match[1]] = "a-real-looking-value"
  }
  return new Map(Object.entries({ ...base, ...extra }))
}

describe("catching configuration that was never filled in", () => {
  it("flags a CI example value", () => {
    const findings = inspect(withRequired({ ANTHROPIC_API_KEY: "ci_dummy_anthropic_key" }))

    expect(findings.find((f) => f.key === "ANTHROPIC_API_KEY")?.detail).toContain("CI example")
  })

  it("flags the trailing newline that `echo` leaves behind", () => {
    // Invisible in every dashboard, and it breaks every consumer of the value.
    const findings = inspect(withRequired({ STRIPE_API_KEY: "sk_live_realbutbroken\\n" }))

    expect(findings.find((f) => f.key === "STRIPE_API_KEY")?.detail).toContain("newline")
  })

  it("reports a key with two problems on one line", () => {
    const findings = inspect(withRequired({ PUSHER_SECRET: "ci_dummy_pusher_secret\\n" }))

    expect(findings.filter((f) => f.key === "PUSHER_SECRET")).toHaveLength(1)
  })

  it("flags a test key running in production", () => {
    const findings = inspect(withRequired({ STRIPE_API_KEY: "sk_test_abc123" }))

    expect(findings.find((f) => f.key === "STRIPE_API_KEY")?.detail).toContain("TEST key")
  })

  it("flags an example.com address and a localhost URL", () => {
    const findings = inspect(
      withRequired({
        SMTP_FROM: "noreply@example.com",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      })
    )

    expect(findings.map((f) => f.key)).toEqual(
      expect.arrayContaining(["SMTP_FROM", "NEXT_PUBLIC_APP_URL"])
    )
  })

  it("flags a required variable that is absent", () => {
    const complete = withRequired()
    complete.delete("DATABASE_URL")

    expect(inspect(complete).find((f) => f.key === "DATABASE_URL")?.detail).toContain("required")
  })

  it("passes a plausible production environment", () => {
    expect(inspect(withRequired())).toEqual([])
  })

  it("does not fail a real secret that merely contains a flagged word", () => {
    // Matching on substrings would fail releases over nothing and teach people
    // to ignore this script.
    const findings = inspect(
      withRequired({
        CLERK_SECRET_KEY: "sk_live_xxxDummyYourChangeme123",
        CRON_SECRET: "todo-list-cron",
      })
    )

    expect(findings).toEqual([])
  })
})
