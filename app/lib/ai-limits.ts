function parsePositiveInt(envVarName: string, fallback: number): number {
  const raw = process.env[envVarName]
  const parsed = Number.parseInt(raw ?? "", 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInt(envVarName: string, fallback: number): number {
  const raw = process.env[envVarName]
  const parsed = Number.parseInt(raw ?? "", 10)

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseNonNegativeIntOrNull(envVarName: string, fallback: number | null): number | null {
  const raw = process.env[envVarName]
  if (raw === undefined) {
    return fallback
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

function parsePositiveIntOrNull(envVarName: string, fallback: number | null): number | null {
  const raw = process.env[envVarName]
  if (raw === undefined) {
    return fallback
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  // Explicitly allow <= 0 to mean "unlimited" (null).
  return parsed > 0 ? parsed : null
}

// Defaults are intentionally conservative to prevent accidental unlimited spend in production.
export const AI_FREE_MONTHLY_MESSAGE_LIMIT = parsePositiveInt("AI_FREE_MONTHLY_MESSAGE_LIMIT", 50)
export const AI_FREE_MONTHLY_TOKEN_QUOTA = parsePositiveInt("AI_FREE_MONTHLY_TOKEN_QUOTA", 200_000)

// Multimodal AI limits (count-based). Defaults keep expensive features PRO-only.
export const AI_FREE_MONTHLY_IMAGE_LIMIT = parseNonNegativeInt("AI_FREE_MONTHLY_IMAGE_LIMIT", 0)
export const AI_FREE_MONTHLY_TRANSCRIBE_LIMIT = parseNonNegativeInt(
  "AI_FREE_MONTHLY_TRANSCRIBE_LIMIT",
  0
)

export const AI_PRO_MONTHLY_IMAGE_LIMIT = parseNonNegativeIntOrNull(
  "AI_PRO_MONTHLY_IMAGE_LIMIT",
  null
)
export const AI_PRO_MONTHLY_TRANSCRIBE_LIMIT = parseNonNegativeIntOrNull(
  "AI_PRO_MONTHLY_TRANSCRIBE_LIMIT",
  null
)

// When unset, default to an $8.00/month fair-use cap per PRO user.
export const AI_PRO_MONTHLY_COST_CAP_CENTS = parsePositiveIntOrNull(
  "AI_PRO_MONTHLY_COST_CAP_CENTS",
  800
)

// OpenAI multimodal cost estimates (cents). Tune these to match your provider pricing.
export const AI_IMAGE_GENERATION_COST_CENTS_512 = parseNonNegativeInt(
  "AI_IMAGE_GENERATION_COST_CENTS_512",
  8
)
export const AI_IMAGE_GENERATION_COST_CENTS_1024 = parseNonNegativeInt(
  "AI_IMAGE_GENERATION_COST_CENTS_1024",
  15
)
export const AI_IMAGE_GENERATION_COST_CENTS_1024x1792 = parseNonNegativeInt(
  "AI_IMAGE_GENERATION_COST_CENTS_1024x1792",
  20
)
export const AI_IMAGE_GENERATION_COST_CENTS_1792x1024 = parseNonNegativeInt(
  "AI_IMAGE_GENERATION_COST_CENTS_1792x1024",
  20
)

export const AI_TRANSCRIBE_COST_CENTS_PER_REQUEST = parseNonNegativeInt(
  "AI_TRANSCRIBE_COST_CENTS_PER_REQUEST",
  2
)
