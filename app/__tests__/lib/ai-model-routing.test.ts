/**
 * @jest-environment node
 */
import {
  getFreeTierModel,
  getModelForUser,
  getProDefaultModel,
  normalizeModelId,
} from "@/app/lib/ai-model-routing"
import { getDefaultModel, MODEL_HAIKU_4_5, MODEL_SONNET_4_6 } from "@/app/lib/ai-models"

describe("normalizeModelId", () => {
  it("returns the default model for null, undefined, or blank input", () => {
    expect(normalizeModelId(null)).toBe(getDefaultModel())
    expect(normalizeModelId(undefined)).toBe(getDefaultModel())
    expect(normalizeModelId("")).toBe(getDefaultModel())
    expect(normalizeModelId("   ")).toBe(getDefaultModel())
  })

  it("passes through currently supported model ids unchanged", () => {
    expect(normalizeModelId(MODEL_SONNET_4_6)).toBe(MODEL_SONNET_4_6)
    expect(normalizeModelId(MODEL_HAIKU_4_5)).toBe(MODEL_HAIKU_4_5)
  })

  it("trims surrounding whitespace before matching", () => {
    expect(normalizeModelId(`  ${MODEL_HAIKU_4_5}  `)).toBe(MODEL_HAIKU_4_5)
  })

  it("maps legacy sonnet ids to the current sonnet model", () => {
    expect(normalizeModelId("claude-sonnet-4-5-20250929")).toBe(MODEL_SONNET_4_6)
    expect(normalizeModelId("claude-sonnet-4-5")).toBe(MODEL_SONNET_4_6)
    expect(normalizeModelId("claude-opus-4-1-20250805")).toBe(MODEL_SONNET_4_6)
    expect(normalizeModelId("claude-3-5-sonnet-20241022")).toBe(MODEL_SONNET_4_6)
    expect(normalizeModelId("claude-3-opus-20240229")).toBe(MODEL_SONNET_4_6)
  })

  it("maps legacy haiku ids to the current haiku model", () => {
    expect(normalizeModelId("claude-haiku-4-5-20251001")).toBe(MODEL_HAIKU_4_5)
    expect(normalizeModelId("claude-3-5-haiku-20241022")).toBe(MODEL_HAIKU_4_5)
    expect(normalizeModelId("claude-3-haiku-20240307")).toBe(MODEL_HAIKU_4_5)
  })

  it("falls back to the default model for unknown ids", () => {
    expect(normalizeModelId("not-a-real-model")).toBe(getDefaultModel())
    expect(normalizeModelId("gpt-4o")).toBe(getDefaultModel())
  })
})

describe("tier defaults", () => {
  it("free tier resolves to the cheaper haiku model", () => {
    expect(getFreeTierModel()).toBe(MODEL_HAIKU_4_5)
  })

  it("pro default resolves to the sonnet model", () => {
    expect(getProDefaultModel()).toBe(MODEL_SONNET_4_6)
  })
})

describe("getModelForUser", () => {
  it("forces free users onto the free-tier model regardless of request", () => {
    expect(getModelForUser({ isPro: false })).toBe(MODEL_HAIKU_4_5)
    expect(getModelForUser({ isPro: false, requestedModelId: MODEL_SONNET_4_6 })).toBe(
      MODEL_HAIKU_4_5
    )
    expect(getModelForUser({ isPro: false, requestedModelId: "claude-3-opus-20240229" })).toBe(
      MODEL_HAIKU_4_5
    )
  })

  it("gives pro users the pro default when they request nothing", () => {
    expect(getModelForUser({ isPro: true })).toBe(MODEL_SONNET_4_6)
    expect(getModelForUser({ isPro: true, requestedModelId: null })).toBe(MODEL_SONNET_4_6)
  })

  it("honors a pro user's valid model request", () => {
    expect(getModelForUser({ isPro: true, requestedModelId: MODEL_HAIKU_4_5 })).toBe(
      MODEL_HAIKU_4_5
    )
  })

  it("normalizes a pro user's legacy model request", () => {
    expect(getModelForUser({ isPro: true, requestedModelId: "claude-sonnet-4-5" })).toBe(
      MODEL_SONNET_4_6
    )
  })

  it("falls back to the default for a pro user's unknown model request", () => {
    expect(getModelForUser({ isPro: true, requestedModelId: "nonsense-model" })).toBe(
      getDefaultModel()
    )
  })
})
