import {
  getDefaultModel,
  isValidModel,
  MODEL_HAIKU_4_5,
  MODEL_SONNET_4_5,
  type ModelType,
} from "@/app/lib/ai-models"

/**
 * Legacy model IDs that may still exist in the database.
 *
 * Anthropic retires models over time; this mapping keeps existing conversations working
 * without requiring a data migration.
 */
const LEGACY_MODEL_ID_MAP: Record<string, ModelType> = {
  // Retired (Oct 2025)
  "claude-3-5-sonnet-20241022": MODEL_SONNET_4_5,
  // Retired (Jan 2026)
  "claude-3-opus-20240229": MODEL_SONNET_4_5,
  // Older / legacy haiku variants
  "claude-3-5-haiku-20241022": MODEL_HAIKU_4_5,
  "claude-3-haiku-20240307": MODEL_HAIKU_4_5,
}

export function normalizeModelId(modelId: string | null | undefined): ModelType {
  const raw = typeof modelId === "string" ? modelId.trim() : ""
  if (!raw) {
    return getDefaultModel()
  }

  if (isValidModel(raw)) {
    return raw
  }

  return LEGACY_MODEL_ID_MAP[raw] || getDefaultModel()
}

export function getFreeTierModel(): ModelType {
  return MODEL_HAIKU_4_5
}

export function getProDefaultModel(): ModelType {
  return MODEL_SONNET_4_5
}

/**
 * Enforce model routing by plan (profit + safety).
 *
 * - Free users always use the free-tier model.
 * - Pro users can use any supported model; legacy/unknown ids normalize to default.
 */
export function getModelForUser(options: {
  isPro: boolean
  requestedModelId?: string | null
}): ModelType {
  if (!options.isPro) {
    return getFreeTierModel()
  }

  if (!options.requestedModelId) {
    return getProDefaultModel()
  }

  return normalizeModelId(options.requestedModelId)
}
