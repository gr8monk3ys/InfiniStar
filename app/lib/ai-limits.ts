function parsePositiveInt(envVarName: string, fallback: number): number {
  const raw = process.env[envVarName]
  const parsed = Number.parseInt(raw ?? "", 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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

// When unset, default to an $8.00/month fair-use cap per PRO user.
export const AI_PRO_MONTHLY_COST_CAP_CENTS = parsePositiveIntOrNull(
  "AI_PRO_MONTHLY_COST_CAP_CENTS",
  800
)
