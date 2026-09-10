/**
 * @jest-environment node
 */

/**
 * The failure these exist for: production carried one `ANTHROPIC_API_KEY`, it
 * returned 401, and every conversation, summary and memory extraction failed
 * with nothing to fall back to.
 */

import {
  isModelProviderConfigured,
  resolveModelProvider,
  toGatewayModelId,
} from "@/app/lib/model-provider"

const ORIGINAL_ENV = process.env

function setEnv(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV, ...env }
}

/** A clean slate — the ambient environment may carry any of these. */
function noProviders(extra: Record<string, string | undefined> = {}) {
  setEnv({
    ANTHROPIC_API_KEY: undefined,
    AI_GATEWAY_API_KEY: undefined,
    VERCEL_OIDC_TOKEN: undefined,
    AI_GATEWAY_MODEL_SONNET: undefined,
    AI_GATEWAY_MODEL_HAIKU: undefined,
    ...extra,
  })
}

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe("choosing a provider", () => {
  it("goes direct to Anthropic when its key is set", () => {
    noProviders({ ANTHROPIC_API_KEY: "sk-ant", VERCEL_OIDC_TOKEN: "oidc" })

    const provider = resolveModelProvider()

    expect(provider.kind).toBe("anthropic")
    expect(provider.baseURL).toBeUndefined()
    expect(provider.apiKey).toBe("sk-ant")
  })

  it("falls back to the gateway on the OIDC token Vercel already injects", () => {
    noProviders({ VERCEL_OIDC_TOKEN: "oidc-token" })

    const provider = resolveModelProvider()

    expect(provider.kind).toBe("gateway")
    expect(provider.baseURL).toBe("https://ai-gateway.vercel.sh")
    expect(provider.authToken).toBe("oidc-token")
  })

  it("prefers an explicit gateway key over the OIDC token", () => {
    noProviders({ AI_GATEWAY_API_KEY: "gw-key", VERCEL_OIDC_TOKEN: "oidc" })

    expect(resolveModelProvider().authToken).toBe("gw-key")
  })

  it("reports none when nothing is configured, rather than guessing", () => {
    noProviders()

    expect(resolveModelProvider().kind).toBe("none")
    expect(isModelProviderConfigured()).toBe(false)
  })

  it("never puts a credential in the label", () => {
    noProviders({ ANTHROPIC_API_KEY: "sk-ant-secret" })

    expect(resolveModelProvider().label).not.toContain("secret")
  })
})

describe("translating model ids", () => {
  it("spells the version with dots and namespaces by vendor", () => {
    expect(toGatewayModelId("claude-sonnet-4-6")).toBe("anthropic/claude-sonnet-4.6")
    expect(toGatewayModelId("claude-haiku-4-5")).toBe("anthropic/claude-haiku-4.5")
  })

  it("leaves the model alone when Anthropic is answering directly", () => {
    noProviders({ ANTHROPIC_API_KEY: "sk-ant" })

    expect(resolveModelProvider().resolveModel("claude-sonnet-4-6")).toBe("claude-sonnet-4-6")
  })

  it("routes each tier to its own override, so a free account can pick models it affords", () => {
    // Vercel's free tier refuses `anthropic/*` outright; without these an
    // account with no credits gets a 403 on every turn.
    noProviders({
      VERCEL_OIDC_TOKEN: "oidc",
      AI_GATEWAY_MODEL_SONNET: "zai/glm-4.6",
      AI_GATEWAY_MODEL_HAIKU: "meta/llama-3.3-70b",
    })
    const { resolveModel } = resolveModelProvider()

    expect(resolveModel("claude-sonnet-4-6")).toBe("zai/glm-4.6")
    expect(resolveModel("claude-haiku-4-5")).toBe("meta/llama-3.3-70b")
  })

  it("asks the gateway for the Anthropic model when no override is set", () => {
    noProviders({ VERCEL_OIDC_TOKEN: "oidc" })

    expect(resolveModelProvider().resolveModel("claude-sonnet-4-6")).toBe(
      "anthropic/claude-sonnet-4.6"
    )
  })

  it("ignores a blank override rather than asking for an empty model", () => {
    noProviders({ VERCEL_OIDC_TOKEN: "oidc", AI_GATEWAY_MODEL_SONNET: "   " })

    expect(resolveModelProvider().resolveModel("claude-sonnet-4-6")).toBe(
      "anthropic/claude-sonnet-4.6"
    )
  })
})
