#!/usr/bin/env node

import process from "node:process"
import Stripe from "stripe"

const runtimeFetch = globalThis.fetch
const RuntimeAbortController = globalThis.AbortController
const runtimeSetTimeout = globalThis.setTimeout
const runtimeClearTimeout = globalThis.clearTimeout

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
    const separatorIndex = withoutPrefix.indexOf("=")
    if (separatorIndex >= 0) {
      const key = withoutPrefix.slice(0, separatorIndex)
      const value = withoutPrefix.slice(separatorIndex + 1)
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

function buildInvoicePaymentFailedEvent() {
  const now = Math.floor(Date.now() / 1000)

  return {
    id: `evt_test_${now}`,
    object: "event",
    api_version: "2025-01-27.acacia",
    created: now,
    data: {
      object: {
        id: `in_test_${now}`,
        object: "invoice",
        parent: {
          subscription_details: {
            subscription: null,
          },
        },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: "invoice.payment_failed",
  }
}

async function postWebhookEvent({ url, payload, signature, timeoutMs }) {
  const abortController = new RuntimeAbortController()
  const timeout = runtimeSetTimeout(() => abortController.abort(), timeoutMs)

  try {
    const response = await runtimeFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body: payload,
      signal: abortController.signal,
    })

    const body = await response.text()
    return {
      status: response.status,
      body,
    }
  } finally {
    runtimeClearTimeout(timeout)
  }
}

const options = parseArgs(process.argv.slice(2))

const webhookUrl =
  options.url ||
  process.env.STAGING_WEBHOOK_URL ||
  process.env.STRIPE_WEBHOOK_VERIFY_URL ||
  (process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/webhooks/stripe`
    : null)

const webhookSecret = options.secret || process.env.STRIPE_WEBHOOK_SECRET
const timeoutMs = parsePositiveInt(options["timeout-ms"] || process.env.STRIPE_WEBHOOK_VERIFY_TIMEOUT_MS, 15000)
const stripeApiKey = options["api-key"] || process.env.STRIPE_API_KEY || "sk_test_verification_placeholder"

if (typeof runtimeFetch !== "function") {
  writeErrorLine("Runtime fetch is unavailable. Use Node.js 18+.")
  process.exit(1)
}

if (
  typeof RuntimeAbortController !== "function" ||
  typeof runtimeSetTimeout !== "function" ||
  typeof runtimeClearTimeout !== "function"
) {
  writeErrorLine("Timer/abort APIs are unavailable in this runtime.")
  process.exit(1)
}

if (!webhookUrl) {
  writeErrorLine(
    "Webhook URL is required. Set STAGING_WEBHOOK_URL or pass --url=https://host/api/webhooks/stripe."
  )
  process.exit(1)
}

if (!webhookSecret) {
  writeErrorLine(
    "Webhook signing secret is required. Set STRIPE_WEBHOOK_SECRET or pass --secret=whsec_..."
  )
  process.exit(1)
}

const stripe = new Stripe(stripeApiKey)
const event = buildInvoicePaymentFailedEvent()
const payload = JSON.stringify(event)
const validSignature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: webhookSecret,
})

writeLine(`Verifying Stripe webhook at ${webhookUrl}`)
writeLine("1/2 Sending valid signature request...")

const validResult = await postWebhookEvent({
  url: webhookUrl,
  payload,
  signature: validSignature,
  timeoutMs,
})

if (validResult.status !== 200) {
  writeErrorLine(
    `Valid signature request failed. Expected 200, got ${validResult.status}. Body: ${validResult.body.slice(0, 500)}`
  )
  process.exit(1)
}

writeLine("2/2 Sending invalid signature request...")

const invalidResult = await postWebhookEvent({
  url: webhookUrl,
  payload,
  signature: "t=1,v1=invalid",
  timeoutMs,
})

if (invalidResult.status !== 400) {
  writeErrorLine(
    `Invalid signature request failed expectation. Expected 400, got ${invalidResult.status}. Body: ${invalidResult.body.slice(0, 500)}`
  )
  process.exit(1)
}

writeLine("Stripe webhook verification passed: valid signatures accepted and invalid signatures rejected.")
