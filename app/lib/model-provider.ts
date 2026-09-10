/**
 * Which service answers a model call, and what that service calls the model.
 *
 * Seven modules reach for the `anthropic` client — the two chat routes,
 * regenerate, memory extraction, summaries, suggestions and the moderator —
 * and every one of them names a model from `ai-models.ts`. None of them should
 * have to know who is actually serving it. This module answers that question
 * once so `anthropic.ts` can build the right client, and the seven callers stay
 * as they are.
 *
 * ## Why this exists
 *
 * Production held one `ANTHROPIC_API_KEY` and it returned 401 —
 * `authentication_error: invalid x-api-key` — which meant every conversation,
 * every summary and every memory extraction failed. One dead credential took
 * the whole product down and there was nothing to fall back to.
 *
 * PRODUCT.md is explicit that "the model is an implementation detail, not a
 * commitment". This makes that true in code rather than only in the positioning
 * document.
 *
 * ## The order, and why
 *
 * 1. `ANTHROPIC_API_KEY` — direct to Anthropic. Fastest path, no intermediary,
 *    and prompt caching (which the roleplay prompts depend on) behaves exactly
 *    as documented.
 * 2. `AI_GATEWAY_API_KEY` — Vercel's AI Gateway with an explicit key.
 * 3. `VERCEL_OIDC_TOKEN` — the same gateway on the token Vercel already injects
 *    into every deployment. Nothing to provision: if the app is on Vercel, this
 *    exists.
 *
 * The gateway matters because it speaks the **Anthropic Messages API** at
 * `/v1/messages` for every model it carries, not just Anthropic's. Verified
 * against the live service: `meta/llama-3.3-70b`, `zai/glm-4.6` and
 * `moonshotai/kimi-k2` all return Anthropic-shaped responses there. So pointing
 * the Anthropic SDK's `baseURL` at it turns a Claude-only app into a
 * model-agnostic one without touching a single call site.
 *
 * The honest caveat, also measured: Vercel's **free tier refuses
 * `anthropic/*` outright and rate-limits everything else**. The gateway is a
 * genuine fallback, not a replacement for a working key — it will serve a
 * trickle, and under load it returns 429. Set `AI_GATEWAY_MODEL_*` to a model
 * the account can actually afford.
 */

export type ProviderKind = "anthropic" | "gateway" | "none"

export interface ModelProvider {
  kind: ProviderKind
  /** Passed to the Anthropic SDK; `undefined` means the SDK's own default. */
  baseURL?: string
  /** `x-api-key` for Anthropic direct. */
  apiKey?: string
  /** `Authorization: Bearer` for the gateway. */
  authToken?: string
  /** Translates an `ai-models.ts` id into what this provider calls it. */
  resolveModel(modelId: string): string
  /** For logs and `/api/health`. Never contains a credential. */
  label: string
}

// No `/v1` here: the Anthropic SDK appends its own, and a base URL that
// already carries one produces `/v1/v1/messages` and a 404 from the gateway.
const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh"

/**
 * `claude-sonnet-4-6` → `anthropic/claude-sonnet-4.6`.
 *
 * The gateway spells versions with dots where `ai-models.ts` uses dashes, and
 * namespaces by vendor. Only the trailing version segments are converted, so
 * the `claude-sonnet` part of the name survives.
 */
export function toGatewayModelId(modelId: string): string {
  const dotted = modelId.replace(/-(\d+)-(\d+)$/, "-$1.$2")
  return `anthropic/${dotted}`
}

/**
 * Per-tier overrides, so an account that cannot afford `anthropic/*` can point
 * the two tiers at models it can. Without these the gateway is asked for the
 * Anthropic model, which is right whenever the account has credits.
 */
function gatewayOverrideFor(modelId: string): string | undefined {
  const isHaiku = modelId.includes("haiku")
  const override = isHaiku
    ? process.env.AI_GATEWAY_MODEL_HAIKU
    : process.env.AI_GATEWAY_MODEL_SONNET
  return override && override.trim().length > 0 ? override.trim() : undefined
}

export function resolveModelProvider(): ModelProvider {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    return {
      kind: "anthropic",
      apiKey: anthropicKey,
      resolveModel: (modelId) => modelId,
      label: "anthropic",
    }
  }

  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
  if (gatewayToken) {
    return {
      kind: "gateway",
      baseURL: GATEWAY_BASE_URL,
      authToken: gatewayToken,
      resolveModel: (modelId) => gatewayOverrideFor(modelId) ?? toGatewayModelId(modelId),
      label: process.env.AI_GATEWAY_API_KEY ? "vercel-ai-gateway" : "vercel-ai-gateway (oidc)",
    }
  }

  return {
    kind: "none",
    resolveModel: (modelId) => modelId,
    label: "none",
  }
}

/** Whether any provider is configured. Drives `/api/health`. */
export function isModelProviderConfigured(): boolean {
  return resolveModelProvider().kind !== "none"
}
