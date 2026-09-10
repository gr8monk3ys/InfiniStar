/**
 * Asks the configured model provider for one sentence, and prints what came
 * back.
 *
 * `/api/health` reports which provider is *configured*, which is not the same
 * as working: production carried an `ANTHROPIC_API_KEY` that returned 401 on
 * every call, and a configuration check would have said "anthropic" the whole
 * time while not one conversation completed. This is the check that would have
 * caught it. Run it after changing a key, and before believing the app works.
 *
 *   vercel env pull .env.prod --environment production
 *   set -a; source .env.prod; set +a
 *   bun scripts/check-model-provider.ts
 *
 * Costs a fraction of a cent. Exits non-zero when the provider will not answer,
 * so it can gate a deploy.
 */

/* eslint-disable no-console -- a CLI script; its output is the point. */

import { MODEL_HAIKU_4_5, MODEL_SONNET_4_6 } from "@/app/lib/ai-models"
import anthropic from "@/app/lib/anthropic"
import { resolveModelProvider } from "@/app/lib/model-provider"

const provider = resolveModelProvider()

if (provider.kind === "none") {
  console.error("No model provider configured. Set ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY.")
  process.exit(1)
}

console.log(`provider: ${provider.label}`)
if (provider.baseURL) console.log(`baseURL:  ${provider.baseURL}`)
console.log("")

let failures = 0

for (const modelId of [MODEL_SONNET_4_6, MODEL_HAIKU_4_5]) {
  const resolved = provider.resolveModel(modelId)
  const label = resolved === modelId ? modelId : `${modelId} -> ${resolved}`
  try {
    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 40,
      messages: [
        {
          role: "user",
          content: "Greet someone arriving at a crossroads tavern, in one sentence.",
        },
      ],
    })
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim()
    console.log(`  OK    ${label}`)
    console.log(`        "${text.slice(0, 90)}"`)
  } catch (error) {
    failures++
    const message = error instanceof Error ? error.message : String(error)
    console.log(`  FAIL  ${label}`)
    console.log(`        ${message.slice(0, 160)}`)
  }
}

process.exit(failures > 0 ? 1 : 0)
