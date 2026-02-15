import type {
  ModerationCategory,
  ModerationMatch,
  ModerationResult,
  ModerationSeverity,
} from "@/app/lib/moderation"

const DEFAULT_OPENAI_MODERATION_MODEL = "omni-moderation-latest"

function severityFromFlaggedKeys(keys: string[]): ModerationSeverity {
  const normalized = keys.map((key) => key.toLowerCase())
  const shouldBlock = normalized.some((key) =>
    ["minors", "threatening", "graphic", "instructions"].some((token) => key.includes(token))
  )
  return shouldBlock ? "block" : "review"
}

function mapOpenAiCategoryKeyToCategory(key: string): ModerationCategory | null {
  const normalized = key.toLowerCase()

  if (normalized.startsWith("hate")) return "hate"
  if (normalized.startsWith("harassment")) return "harassment"
  if (normalized.startsWith("sexual")) return "sexual"
  if (normalized.startsWith("violence")) return "violence"
  if (normalized.startsWith("self-harm") || normalized.startsWith("self_harm")) return "self_harm"

  // Some moderation taxonomies include "illicit" for wrongdoing; treat as scam.
  if (normalized.startsWith("illicit")) return "scam"

  return null
}

export async function moderateTextWithOpenAi(content: string): Promise<ModerationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENAI_MODERATION_MODEL || DEFAULT_OPENAI_MODERATION_MODEL

  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: content,
    }),
  })

  if (!res.ok) {
    return null
  }

  const json = (await res.json()) as unknown
  const result = (json as { results?: Array<{ categories?: Record<string, boolean> }> })
    .results?.[0]
  const categoriesRecord = result?.categories
  if (!categoriesRecord) return null

  const flaggedKeys = Object.entries(categoriesRecord)
    .filter(([, flagged]) => Boolean(flagged))
    .map(([key]) => key)

  if (flaggedKeys.length === 0) {
    return {
      severity: "safe",
      shouldBlock: false,
      shouldReview: false,
      categories: [],
      matches: [],
    }
  }

  const severity = severityFromFlaggedKeys(flaggedKeys)
  const categories: ModerationCategory[] = []
  const matches: ModerationMatch[] = []

  for (const key of flaggedKeys) {
    const mapped = mapOpenAiCategoryKeyToCategory(key)
    if (!mapped) continue
    categories.push(mapped)
    matches.push({ category: mapped, label: `openai:${key}` })
  }

  const uniqueCategories = [...new Set(categories)]
  const shouldBlock = severity === "block"

  return {
    severity,
    shouldBlock,
    shouldReview: !shouldBlock,
    categories: uniqueCategories,
    matches,
  }
}
