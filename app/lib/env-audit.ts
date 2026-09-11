/**
 * Recognising configuration that was never filled in.
 *
 * Production was found holding eight variables written from `.env.ci.example` —
 * `ANTHROPIC_API_KEY=ci_dummy_anthropic_key`, all three Pusher credentials, all
 * three Postmark ones, and `REDIS_URL`. Every one carried a trailing newline,
 * the fingerprint of `echo value | vercel env add` instead of `printf`.
 *
 * One bad push, and the consequences read as four unrelated outages: the model
 * 401'd on every message, real-time delivery was dead, no transactional mail
 * could send, and the Redis URL pointed nowhere. Each was diagnosed separately
 * and expensively, hours apart, because nothing in the system ever said "these
 * are placeholders" — the app just failed at the far end, four different ways.
 *
 * The rules live here rather than in the script so they can be tested without
 * a file on disk; `scripts/check-production-env.ts` is the CLI around them.
 */

import { readFileSync } from "node:fs"

/**
 * Values that mean "nobody filled this in". Deliberately matched on the whole
 * value or a clear prefix rather than a substring: a real secret can contain
 * the letters `xxx`, and failing a release over that would teach people to
 * ignore this script.
 */
const PLACEHOLDER_PATTERNS: Array<{ test: RegExp; why: string }> = [
  { test: /^ci_dummy/i, why: "a CI example value" },
  { test: /^(dummy|placeholder|changeme|todo|tbd|none|null|undefined)$/i, why: "a placeholder" },
  { test: /^your[-_]/i, why: "an unfilled template value" },
  { test: /^(sk|pk)_test_/, why: "a TEST key in production" },
  { test: /@example\.(com|org|test)$/i, why: "an example.com address" },
  { test: /^https?:\/\/(localhost|127\.0\.0\.1)/i, why: "a localhost URL" },
]

export interface Finding {
  key: string
  detail: string
  severity: "error" | "warning"
}

/** One line per variable: a key with two problems is still one thing to fix. */
function collapse(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>()
  for (const finding of findings) {
    const existing = byKey.get(finding.key)
    if (!existing) {
      byKey.set(finding.key, { ...finding })
      continue
    }
    existing.detail = `${existing.detail}; ${finding.detail}`
    if (finding.severity === "error") existing.severity = "error"
  }
  return [...byKey.values()]
}

function parseEnvFile(path: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    // Keep the raw value: the quotes and any escapes inside them are the
    // evidence. `vercel env pull` writes a literal `\n` for a trailing newline
    // in the stored value, and stripping it would hide the whole problem.
    out.set(trimmed.slice(0, eq), trimmed.slice(eq + 1).replace(/^"|"$/g, ""))
  }
  return out
}

/** Names `env.mjs` declares without `.optional()`. */
function requiredKeys(): string[] {
  const source = readFileSync("env.mjs", "utf8")
  const keys: string[] = []
  for (const match of source.matchAll(/^\s+([A-Z_0-9]+): z\.[^\n]*/gm)) {
    if (!match[0].includes(".optional()")) keys.push(match[1])
  }
  return [...new Set(keys)]
}

export function inspect(env: Map<string, string>): Finding[] {
  const findings: Finding[] = []

  for (const key of requiredKeys()) {
    const value = env.get(key)
    if (!value || value.trim().length === 0) {
      findings.push({ key, detail: "required by env.mjs but empty or absent", severity: "error" })
    }
  }

  for (const [key, value] of env) {
    if (!value) continue

    // The fingerprint of `echo` instead of `printf`. A trailing newline inside
    // a credential is invisible in every dashboard and breaks every consumer.
    if (/\\[rn]$/.test(value) || value !== value.trim()) {
      findings.push({
        key,
        detail: "value has trailing whitespace or a newline — likely written with `echo`",
        severity: "error",
      })
    }

    const bare = value.replace(/\\[rn]$/, "").trim()
    for (const { test, why } of PLACEHOLDER_PATTERNS) {
      if (test.test(bare)) {
        findings.push({ key, detail: `looks like ${why}`, severity: "error" })
        break
      }
    }
  }

  return collapse(findings)
}

