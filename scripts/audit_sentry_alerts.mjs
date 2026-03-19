#!/usr/bin/env node

import process from "node:process"

const runtimeFetch = globalThis.fetch

function writeLine(message = "") {
  process.stdout.write(`${message}\n`)
}

function writeErrorLine(message) {
  process.stderr.write(`${message}\n`)
}

function parseArgs(argv) {
  const options = {}

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index]
    if (!raw.startsWith("--")) {
      continue
    }

    const withoutPrefix = raw.slice(2)
    const equalsIndex = withoutPrefix.indexOf("=")

    if (equalsIndex >= 0) {
      const key = withoutPrefix.slice(0, equalsIndex)
      const value = withoutPrefix.slice(equalsIndex + 1)
      options[key] = value
      continue
    }

    const key = withoutPrefix
    const next = argv[index + 1]
    if (next && !next.startsWith("--")) {
      options[key] = next
      index += 1
      continue
    }

    options[key] = "true"
  }

  return options
}

function parsePositiveInt(rawValue, fallback) {
  if (!rawValue) {
    return fallback
  }

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return fallback
  }

  return parsed
}

function summarizeRule(rule) {
  const actions = Array.isArray(rule?.actions) ? rule.actions.length : 0
  const frequency = rule?.frequency ? `${rule.frequency}` : "n/a"
  const environments = Array.isArray(rule?.environment) ? rule.environment.join(", ") : "all"
  return `${rule.name} | actions=${actions} | frequency=${frequency} | env=${environments}`
}

const options = parseArgs(process.argv.slice(2))

const sentryAuthToken = options.token || process.env.SENTRY_AUTH_TOKEN
const sentryOrg = options.org || process.env.SENTRY_ORG
const sentryProject = options.project || process.env.SENTRY_PROJECT
const sentryBaseUrl = (options["base-url"] || process.env.SENTRY_BASE_URL || "https://sentry.io").replace(
  /\/+$/,
  ""
)
const minimumRules = parsePositiveInt(options["min-rules"] || process.env.SENTRY_ALERT_MIN_RULES, 2)

if (typeof runtimeFetch !== "function") {
  writeErrorLine("Runtime fetch is unavailable. Use Node.js 18+.")
  process.exit(1)
}

if (!sentryAuthToken || !sentryOrg || !sentryProject) {
  writeErrorLine(
    "Missing Sentry configuration. Required: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT."
  )
  process.exit(1)
}

const endpoint = `${sentryBaseUrl}/api/0/projects/${encodeURIComponent(sentryOrg)}/${encodeURIComponent(
  sentryProject
)}/rules/`

writeLine(`Fetching issue alert rules from ${endpoint}`)

const response = await runtimeFetch(endpoint, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${sentryAuthToken}`,
    Accept: "application/json",
  },
})

const responseText = await response.text()
if (!response.ok) {
  writeErrorLine(
    `Sentry API request failed (${response.status}). Body: ${responseText.slice(0, 600)}`
  )
  process.exit(1)
}

let rules
try {
  rules = JSON.parse(responseText)
} catch {
  writeErrorLine("Unable to parse Sentry API response as JSON.")
  process.exit(1)
}

if (!Array.isArray(rules)) {
  writeErrorLine("Unexpected Sentry API response: expected an array of issue alert rules.")
  process.exit(1)
}

const activeRules = rules.filter((rule) => !rule?.status || rule.status === "active")
const criticalKeywordRules = activeRules.filter((rule) =>
  typeof rule?.name === "string" ? /critical|p0|sev0|sev1/i.test(rule.name) : false
)
const actionableRules = activeRules.filter(
  (rule) => Array.isArray(rule?.actions) && rule.actions.length > 0
)

writeLine(`Total rules: ${rules.length}`)
writeLine(`Active rules: ${activeRules.length}`)
writeLine(`Rules with actions: ${actionableRules.length}`)
writeLine(`Critical/P0 named rules: ${criticalKeywordRules.length}`)

if (activeRules.length > 0) {
  writeLine("Rule summary:")
  for (const rule of activeRules) {
    writeLine(`- ${summarizeRule(rule)}`)
  }
}

if (activeRules.length < minimumRules) {
  writeErrorLine(
    `Insufficient active issue alert coverage: found ${activeRules.length}, require at least ${minimumRules}.`
  )
  process.exit(1)
}

if (actionableRules.length === 0) {
  writeErrorLine("No active issue alert rules with actions were found.")
  process.exit(1)
}

if (criticalKeywordRules.length === 0) {
  writeErrorLine("No active critical/P0 issue alert rule detected by naming convention.")
  process.exit(1)
}

writeLine("Sentry issue alert audit passed.")
