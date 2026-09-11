/**
 * Reads a pulled production environment and refuses to be quiet about
 * configuration that looks like it was never filled in. The rules — and the
 * incident behind them — live in `app/lib/env-audit.ts`.
 *
 *   vercel env pull .env.production.local --environment production
 *   bun run env:check .env.production.local
 *
 * Exits non-zero on a placeholder, a stray newline, or a missing required
 * variable, so it can gate a release.
 */

/* eslint-disable no-console -- a CLI script; its output is the point. */

import { readFileSync } from "node:fs"

import { inspect } from "@/app/lib/env-audit"

function parseEnvFile(path: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    // Keep the raw value: `vercel env pull` writes a literal `\n` for a
    // trailing newline in the stored value, and stripping it hides the problem.
    out.set(trimmed.slice(0, eq), trimmed.slice(eq + 1).replace(/^"|"$/g, ""))
  }
  return out
}

const path = process.argv[2] ?? ".env.production.local"
let env: Map<string, string>
try {
  env = parseEnvFile(path)
} catch {
  console.error(`Cannot read ${path}.`)
  console.error("  vercel env pull .env.production.local --environment production")
  process.exit(2)
}

const findings = inspect(env)
const errors = findings.filter((f) => f.severity === "error")

console.log(`Checked ${env.size} variables in ${path}\n`)

if (findings.length === 0) {
  console.log("  No placeholders, no stray newlines, nothing required is missing.")
  process.exit(0)
}

for (const { key, detail, severity } of findings) {
  console.log(`  ${severity === "error" ? "FAIL" : "warn"}  ${key}\n        ${detail}`)
}

console.log(
  `\n${errors.length} problem${errors.length === 1 ? "" : "s"}. ` +
    `Set a real value with \`printf '%s' "<value>" | vercel env add <KEY> production --force\` — ` +
    `\`echo\` appends a newline.`
)
process.exit(errors.length > 0 ? 1 : 0)
