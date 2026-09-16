/* global console, process, URL */
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Lighthouse score floors, run against the production build in CI so the
// 2026-09-13..16 performance work (prerendered home/pricing/character pages,
// inlined route CSS, #104/#105) cannot silently regress.
//
// Runs with `--preset=desktop`: mobile devtools throttling is far too noisy on
// shared CI runners to gate on. Production mobile numbers are measured
// separately (PageSpeed Insights against https://infinistar.lscaturchio.xyz).
//
// Floors are MEASURED, not aspirational. Performance sits 2 points below the
// minimum observed across repeated runs (a floor that flakes gets bypassed; a
// floor that never fails is useless); the other three sit at the observed
// value. Raise a floor whenever the real score improves.
//
// Measured 2026-09-16, three local runs of the production build with the CI
// env (.env.ci.example, no database): / performance 95-97, /pricing and the
// docs pages 99-100; accessibility, best-practices and SEO 100 everywhere
// except the one route-level exception below.
const SCORE_FLOORS = {
  performance: 93,
  accessibility: 100,
  bestPractices: 100,
  seo: 100,
}

// Route-level exceptions, each with its cause. Keep this list short: an entry
// here is a known defect or a CI-environment artifact, never a convenience.
const ROUTE_FLOOR_OVERRIDES = {
  // The home page is the only route with real work above the fold (hero
  // image, character rail). Locally it measures 95-97; the shared CI runner's
  // first run of PR #107 scored 88 then 94 with no code change, so the floor
  // sits 2 below the lowest CI attempt. A regression that matters (losing the
  // prerender, #104) lands far below this.
  "/": { performance: 86 },
  // Clerk boots on /pricing (the plan buttons are auth-aware) and, with the
  // dummy CI publishable key, its dev_browser handshake returns 400 -> one
  // "errors-in-console" hit -> best-practices 96. Production, with a real key,
  // measures 100. Not reachable from this repo without a live Clerk instance.
  "/pricing": { bestPractices: 96 },
}

// Document byte budget for the home route (gzipped transfer size, in bytes).
// `experimental.inlineCss` moved the route CSS into the HTML, so the document
// is now the thing that grows when a style leak lands. The cap sits ~25% above
// the size measured when it was introduced; the measured value is printed on
// every run so the trend is visible in the job log.
// Measured 2026-09-16: 48,705 bytes compressed.
const DOCUMENT_BYTE_BUDGET = { route: "/", maxBytes: 61_000 }

const MAX_ATTEMPTS = 4
const artifactDir = join(process.cwd(), "artifacts", "lighthouse")
const [baseUrl, ...routes] = process.argv.slice(2)

if (!baseUrl || routes.length === 0) {
  console.error("Usage: node scripts/check-lighthouse-score.mjs <baseUrl> <route...>")
  process.exit(1)
}

const outputDir = mkdtempSync(join(tmpdir(), "infinistar-lighthouse-"))

try {
  mkdirSync(artifactDir, { recursive: true })

  for (const route of routes) {
    const url = new URL(route, baseUrl).toString()
    const floors = { ...SCORE_FLOORS, ...ROUTE_FLOOR_OVERRIDES[route] }
    warmRoute(url)
    let bestAttempt = null
    let attemptsRun = 0

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      attemptsRun = attempt
      const reportPath = join(outputDir, `${artifactSlug(route)}-attempt-${attempt}.json`)
      const scores = runLighthouse(url, reportPath)

      console.log(`[lighthouse] ${route} attempt ${attempt} -> ${JSON.stringify(scores)}`)

      if (!bestAttempt || totalScore(scores) > totalScore(bestAttempt.scores)) {
        bestAttempt = { attempt, scores, reportPath }
      }

      if (Object.entries(scores).every(([k, score]) => score >= (floors[k] ?? 100))) {
        break
      }
    }

    const failures = Object.entries(bestAttempt.scores).filter(
      ([k, score]) => score < (floors[k] ?? 100)
    )
    copyFileSync(bestAttempt.reportPath, join(artifactDir, `${artifactSlug(route)}.json`))

    if (failures.length > 0) {
      console.error(
        `[lighthouse] ${route} fell below its score floors after ${attemptsRun} attempt(s): ${failures
          .map(([category, score]) => `${category}=${score} (floor ${floors[category]})`)
          .join(", ")}`
      )
      logFailureDiagnostics(bestAttempt.reportPath)
      process.exit(1)
    }
  }

  checkDocumentBudget(new URL(DOCUMENT_BYTE_BUDGET.route, baseUrl).toString())
} finally {
  rmSync(outputDir, { recursive: true, force: true })
}

function artifactSlug(route) {
  return route === "/" ? "root" : route.replace(/[^a-z0-9]+/gi, "-")
}

function runLighthouse(url, reportPath) {
  const result = spawnSync(
    "npx",
    [
      "-y",
      "lighthouse",
      url,
      "--preset=desktop",
      "--quiet",
      "--chrome-flags=--headless=new --no-sandbox",
      "--only-categories=performance,accessibility,best-practices,seo",
      "--output=json",
      `--output-path=${reportPath}`,
    ],
    { encoding: "utf-8" }
  )

  if (result.error) {
    console.error(`Failed to run Lighthouse for ${url}:`, result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  const report = JSON.parse(readFileSync(reportPath, "utf-8"))
  return {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    bestPractices: Math.round(report.categories["best-practices"].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
  }
}

function warmRoute(url) {
  spawnSync("curl", ["-fsSLo", "/dev/null", url], { stdio: "ignore" })
}

function checkDocumentBudget(url) {
  const result = spawnSync(
    "curl",
    ["--compressed", "-sSLo", "/dev/null", "-w", "%{size_download}", url],
    { encoding: "utf-8" }
  )
  const bytes = Number.parseInt(result.stdout.trim(), 10)

  if (result.status !== 0 || !Number.isFinite(bytes) || bytes <= 0) {
    console.error(`[document-budget] could not measure ${url}: ${result.stderr || result.stdout}`)
    process.exit(1)
  }

  const { maxBytes } = DOCUMENT_BYTE_BUDGET
  console.log(
    `[document-budget] ${DOCUMENT_BYTE_BUDGET.route} document is ${bytes} bytes compressed (cap ${maxBytes})`
  )

  if (bytes > maxBytes) {
    console.error(
      `[document-budget] ${DOCUMENT_BYTE_BUDGET.route} document grew past its ${maxBytes}-byte cap (${bytes} bytes). ` +
        "With experimental.inlineCss the document carries the route CSS: check for a style leak or a new global import."
    )
    process.exit(1)
  }
}

function totalScore(scores) {
  return Object.values(scores).reduce((sum, score) => sum + score, 0)
}

function logFailureDiagnostics(reportPath) {
  const report = JSON.parse(readFileSync(reportPath, "utf-8"))
  const metrics = report.audits.metrics?.details?.items?.[0]

  if (metrics) {
    const formatMetric = (value) => `${Math.round(value)}ms`
    console.error(
      `[lighthouse] metrics: fcp=${formatMetric(metrics.firstContentfulPaint)} lcp=${formatMetric(metrics.largestContentfulPaint)} tbt=${formatMetric(metrics.totalBlockingTime)} si=${formatMetric(metrics.speedIndex)} cls=${metrics.cumulativeLayoutShift}`
    )
  }

  const opportunities = Object.values(report.audits)
    .filter(
      (audit) => audit.details?.type === "opportunity" && typeof audit.numericValue === "number"
    )
    .sort((left, right) => right.numericValue - left.numericValue)
    .slice(0, 5)
    .map((audit) => `${audit.id}:${Math.round(audit.numericValue)}ms`)

  if (opportunities.length > 0) {
    console.error(`[lighthouse] top opportunities: ${opportunities.join(", ")}`)
  }

  const layoutShiftItems = report.audits["layout-shift-elements"]?.details?.items
    ?.slice(0, 5)
    .map((item) => {
      const node = item.node ?? {}
      const snippet = node.snippet ?? node.nodeLabel ?? node.path ?? "unknown"
      return `${snippet} (${Math.round((item.score ?? 0) * 1000) / 1000})`
    })

  if (layoutShiftItems?.length) {
    console.error(`[lighthouse] layout-shift-elements: ${layoutShiftItems.join(" | ")}`)
  }

  // Accessibility, best-practices and SEO are pinned at 100, so any failure
  // there is one named audit; print it rather than making someone open the JSON.
  for (const category of ["accessibility", "best-practices", "seo"]) {
    const failing = report.categories[category]?.auditRefs
      .map((ref) => report.audits[ref.id])
      .filter(
        (audit) =>
          audit &&
          audit.score !== null &&
          audit.score < 1 &&
          audit.scoreDisplayMode !== "informative"
      )
      .map((audit) => audit.id)
    if (failing?.length) {
      console.error(`[lighthouse] ${category} failing audits: ${failing.join(", ")}`)
    }
  }
}
