#!/usr/bin/env node

import process from "node:process"
import { performance } from "node:perf_hooks"

const runtimeFetch = globalThis.fetch
const RuntimeURL = globalThis.URL

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
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback
  }

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return fallback
  }

  return parsed
}

function percentile(values, targetPercentile) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((targetPercentile / 100) * sorted.length) - 1)
  )
  return sorted[index]
}

const argv = parseArgs(process.argv.slice(2))

const baseUrl = (argv["base-url"] || process.env.LOAD_SMOKE_BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
)
const requests = parsePositiveInt(argv.requests || process.env.LOAD_SMOKE_REQUESTS, 40)
const concurrency = parsePositiveInt(argv.concurrency || process.env.LOAD_SMOKE_CONCURRENCY, 8)
const p95ThresholdMs = parsePositiveInt(argv["p95-ms"] || process.env.LOAD_SMOKE_P95_MS, 900)
const endpoints = (argv.endpoints || process.env.LOAD_SMOKE_ENDPOINTS || "/api/health,/,/explore,/pricing")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0)

if (endpoints.length === 0) {
  writeErrorLine("No endpoints configured for load smoke test.")
  process.exit(1)
}

if (typeof runtimeFetch !== "function" || typeof RuntimeURL !== "function") {
  writeErrorLine("Load smoke requires Node.js runtime support for fetch and URL.")
  process.exit(1)
}

let issued = 0
let passed = 0
let failed = 0
const durations = []
const failures = []

async function runOneRequest(sequenceNumber) {
  const endpoint = endpoints[sequenceNumber % endpoints.length]
  const url = new RuntimeURL(endpoint, `${baseUrl}/`).toString()
  const startedAt = performance.now()

  try {
    const response = await runtimeFetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "Cache-Control": "no-cache",
      },
    })

    const elapsedMs = performance.now() - startedAt
    durations.push(elapsedMs)

    if (response.status >= 200 && response.status < 400) {
      passed += 1
      return
    }

    failed += 1
    if (failures.length < 10) {
      failures.push({
        endpoint,
        status: response.status,
      })
    }
  } catch (error) {
    const elapsedMs = performance.now() - startedAt
    durations.push(elapsedMs)
    failed += 1
    if (failures.length < 10) {
      failures.push({
        endpoint,
        status: "FETCH_ERROR",
        message: error instanceof Error ? error.message : "Unknown fetch error",
      })
    }
  }
}

async function runWorker() {
  while (true) {
    const nextSequence = issued
    issued += 1

    if (nextSequence >= requests) {
      return
    }

    await runOneRequest(nextSequence)
  }
}

const startedAt = performance.now()
const workerCount = Math.min(concurrency, requests)

await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

const totalElapsedMs = performance.now() - startedAt
const averageMs =
  durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0
const p50Ms = percentile(durations, 50)
const p95Ms = percentile(durations, 95)
const maxMs = durations.length > 0 ? Math.max(...durations) : 0
const minMs = durations.length > 0 ? Math.min(...durations) : 0
const requestsPerSecond = totalElapsedMs > 0 ? (requests / totalElapsedMs) * 1000 : 0

writeLine("Load smoke summary")
writeLine(`Base URL: ${baseUrl}`)
writeLine(`Endpoints: ${endpoints.join(", ")}`)
writeLine(`Requests: ${requests}`)
writeLine(`Concurrency: ${workerCount}`)
writeLine(`Pass: ${passed}`)
writeLine(`Fail: ${failed}`)
writeLine(`Min: ${minMs.toFixed(1)}ms`)
writeLine(`Avg: ${averageMs.toFixed(1)}ms`)
writeLine(`P50: ${p50Ms.toFixed(1)}ms`)
writeLine(`P95: ${p95Ms.toFixed(1)}ms`)
writeLine(`Max: ${maxMs.toFixed(1)}ms`)
writeLine(`Throughput: ${requestsPerSecond.toFixed(2)} req/s`)

if (failures.length > 0) {
  writeLine("Failure samples:")
  for (const failure of failures) {
    writeLine(
      `- ${failure.endpoint} -> ${failure.status}${failure.message ? ` (${failure.message})` : ""}`
    )
  }
}

if (failed > 0) {
  writeErrorLine(`Load smoke failed: ${failed} requests did not return a 2xx/3xx response.`)
  process.exit(1)
}

if (p95Ms > p95ThresholdMs) {
  writeErrorLine(
    `Load smoke failed: p95 ${p95Ms.toFixed(1)}ms exceeded threshold ${p95ThresholdMs}ms.`
  )
  process.exit(1)
}

writeLine(`Load smoke passed: p95 ${p95Ms.toFixed(1)}ms <= ${p95ThresholdMs}ms with 0 failures.`)
