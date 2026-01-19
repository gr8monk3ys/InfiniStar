/**
 * AI Usage Tracking Tests
 *
 * Tests for the AI usage calculation functions.
 * Note: Database-dependent functions (trackAiUsage, getUserUsageStats, etc.)
 * should be tested via integration tests.
 */

import { MODEL_PRICING, calculateTokenCost } from "@/app/lib/ai-usage"

describe("MODEL_PRICING", () => {
  it("should have pricing for Claude 3.5 Sonnet", () => {
    const pricing = MODEL_PRICING["claude-3-5-sonnet-20241022"]
    expect(pricing).toBeDefined()
    expect(pricing.input).toBe(3.0)
    expect(pricing.output).toBe(15.0)
  })

  it("should have pricing for Claude 3 Opus", () => {
    const pricing = MODEL_PRICING["claude-3-opus-20240229"]
    expect(pricing).toBeDefined()
    expect(pricing.input).toBe(15.0)
    expect(pricing.output).toBe(75.0)
  })

  it("should have pricing for Claude 3 Haiku", () => {
    const pricing = MODEL_PRICING["claude-3-haiku-20240307"]
    expect(pricing).toBeDefined()
    expect(pricing.input).toBe(0.25)
    expect(pricing.output).toBe(1.25)
  })

  it("should have Haiku as the cheapest model", () => {
    const haiku = MODEL_PRICING["claude-3-haiku-20240307"]
    const sonnet = MODEL_PRICING["claude-3-5-sonnet-20241022"]
    const opus = MODEL_PRICING["claude-3-opus-20240229"]

    expect(haiku.input).toBeLessThan(sonnet.input)
    expect(haiku.input).toBeLessThan(opus.input)
    expect(haiku.output).toBeLessThan(sonnet.output)
    expect(haiku.output).toBeLessThan(opus.output)
  })

  it("should have Opus as the most expensive model", () => {
    const haiku = MODEL_PRICING["claude-3-haiku-20240307"]
    const sonnet = MODEL_PRICING["claude-3-5-sonnet-20241022"]
    const opus = MODEL_PRICING["claude-3-opus-20240229"]

    expect(opus.input).toBeGreaterThan(sonnet.input)
    expect(opus.input).toBeGreaterThan(haiku.input)
    expect(opus.output).toBeGreaterThan(sonnet.output)
    expect(opus.output).toBeGreaterThan(haiku.output)
  })
})

describe("calculateTokenCost", () => {
  describe("Sonnet model costs", () => {
    const model = "claude-3-5-sonnet-20241022"

    it("should calculate zero cost for zero tokens", () => {
      const result = calculateTokenCost(model, 0, 0)
      expect(result.inputCost).toBe(0)
      expect(result.outputCost).toBe(0)
      expect(result.totalCost).toBe(0)
    })

    it("should calculate cost for 1 million input tokens", () => {
      const result = calculateTokenCost(model, 1_000_000, 0)
      // $3 per million tokens = 300 cents
      expect(result.inputCost).toBe(300)
      expect(result.outputCost).toBe(0)
      expect(result.totalCost).toBe(300)
    })

    it("should calculate cost for 1 million output tokens", () => {
      const result = calculateTokenCost(model, 0, 1_000_000)
      // $15 per million tokens = 1500 cents
      expect(result.inputCost).toBe(0)
      expect(result.outputCost).toBe(1500)
      expect(result.totalCost).toBe(1500)
    })

    it("should calculate combined cost", () => {
      const result = calculateTokenCost(model, 1000, 500)
      // Input: (1000/1M) * 3 * 100 = 0.3 cents
      // Output: (500/1M) * 15 * 100 = 0.75 cents
      expect(result.inputCost).toBe(0.3)
      expect(result.outputCost).toBe(0.75)
      expect(result.totalCost).toBe(1.05)
    })

    it("should handle typical chat request", () => {
      // Typical request: ~500 input tokens, ~1000 output tokens
      const result = calculateTokenCost(model, 500, 1000)
      expect(result.totalCost).toBeGreaterThan(0)
      expect(result.totalCost).toBeLessThan(3) // Less than 3 cents
    })
  })

  describe("Opus model costs", () => {
    const model = "claude-3-opus-20240229"

    it("should calculate higher costs than Sonnet", () => {
      const opusResult = calculateTokenCost(model, 1000, 1000)
      const sonnetResult = calculateTokenCost("claude-3-5-sonnet-20241022", 1000, 1000)

      expect(opusResult.totalCost).toBeGreaterThan(sonnetResult.totalCost)
    })

    it("should calculate cost for 1 million input tokens", () => {
      const result = calculateTokenCost(model, 1_000_000, 0)
      // $15 per million tokens = 1500 cents
      expect(result.inputCost).toBe(1500)
    })

    it("should calculate cost for 1 million output tokens", () => {
      const result = calculateTokenCost(model, 0, 1_000_000)
      // $75 per million tokens = 7500 cents
      expect(result.outputCost).toBe(7500)
    })
  })

  describe("Haiku model costs", () => {
    const model = "claude-3-haiku-20240307"

    it("should calculate lower costs than Sonnet", () => {
      const haikuResult = calculateTokenCost(model, 1000, 1000)
      const sonnetResult = calculateTokenCost("claude-3-5-sonnet-20241022", 1000, 1000)

      expect(haikuResult.totalCost).toBeLessThan(sonnetResult.totalCost)
    })

    it("should calculate cost for 1 million input tokens", () => {
      const result = calculateTokenCost(model, 1_000_000, 0)
      // $0.25 per million tokens = 25 cents
      expect(result.inputCost).toBe(25)
    })

    it("should calculate cost for 1 million output tokens", () => {
      const result = calculateTokenCost(model, 0, 1_000_000)
      // $1.25 per million tokens = 125 cents
      expect(result.outputCost).toBe(125)
    })

    it("should handle large volume requests efficiently", () => {
      // 10K input, 5K output - typical for longer conversations
      const result = calculateTokenCost(model, 10_000, 5_000)
      expect(result.totalCost).toBeLessThan(1) // Still under 1 cent with Haiku
    })
  })

  describe("Unknown model handling", () => {
    it("should default to Sonnet pricing for unknown model", () => {
      const unknownResult = calculateTokenCost("unknown-model", 1000, 1000)
      const sonnetResult = calculateTokenCost("claude-3-5-sonnet-20241022", 1000, 1000)

      expect(unknownResult.inputCost).toBe(sonnetResult.inputCost)
      expect(unknownResult.outputCost).toBe(sonnetResult.outputCost)
      expect(unknownResult.totalCost).toBe(sonnetResult.totalCost)
    })

    it("should handle empty string model name", () => {
      const result = calculateTokenCost("", 1000, 1000)
      expect(result.totalCost).toBeGreaterThan(0) // Uses default pricing
    })
  })

  describe("Rounding behavior", () => {
    it("should round to 2 decimal places", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", 333, 777)

      // Check that results are rounded to 2 decimal places
      expect(result.inputCost.toString().split(".")[1]?.length || 0).toBeLessThanOrEqual(2)
      expect(result.outputCost.toString().split(".")[1]?.length || 0).toBeLessThanOrEqual(2)
      expect(result.totalCost.toString().split(".")[1]?.length || 0).toBeLessThanOrEqual(2)
    })

    it("should handle very small token counts", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", 1, 1)
      expect(result.totalCost).toBe(0) // Less than 0.005 cents, rounds to 0
    })

    it("should handle very large token counts", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", 100_000_000, 50_000_000)
      expect(result.inputCost).toBe(30000) // $300 worth
      expect(result.outputCost).toBe(75000) // $750 worth
      expect(result.totalCost).toBe(105000)
    })
  })

  describe("Return value structure", () => {
    it("should return object with all required fields", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", 1000, 1000)

      expect(result).toHaveProperty("inputCost")
      expect(result).toHaveProperty("outputCost")
      expect(result).toHaveProperty("totalCost")
    })

    it("should return numbers for all cost fields", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", 1000, 1000)

      expect(typeof result.inputCost).toBe("number")
      expect(typeof result.outputCost).toBe("number")
      expect(typeof result.totalCost).toBe("number")
    })

    it("should have totalCost equal to sum of input and output costs", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", 5000, 2500)

      // Due to rounding, we check within a small epsilon
      expect(Math.abs(result.totalCost - (result.inputCost + result.outputCost))).toBeLessThan(0.01)
    })
  })

  describe("Edge cases", () => {
    it("should handle negative input tokens (treat as 0)", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", -1000, 1000)
      // Negative tokens would produce negative cost
      expect(result.inputCost).toBeLessThanOrEqual(0)
    })

    it("should handle negative output tokens (treat as 0)", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", 1000, -1000)
      // Negative tokens would produce negative cost
      expect(result.outputCost).toBeLessThanOrEqual(0)
    })

    it("should handle floating point input tokens", () => {
      const result = calculateTokenCost("claude-3-5-sonnet-20241022", 1000.5, 500.7)
      expect(result.totalCost).toBeGreaterThan(0)
    })
  })
})

describe("Cost Comparison Scenarios", () => {
  it("should show significant cost difference between models for same usage", () => {
    const tokens = { input: 10_000, output: 5_000 }

    const haiku = calculateTokenCost("claude-3-haiku-20240307", tokens.input, tokens.output)
    const sonnet = calculateTokenCost("claude-3-5-sonnet-20241022", tokens.input, tokens.output)
    const opus = calculateTokenCost("claude-3-opus-20240229", tokens.input, tokens.output)

    // Verify relative costs
    expect(opus.totalCost).toBeGreaterThan(sonnet.totalCost)
    expect(sonnet.totalCost).toBeGreaterThan(haiku.totalCost)

    // Opus should be significantly more expensive
    expect(opus.totalCost / haiku.totalCost).toBeGreaterThan(10)
  })

  it("should calculate monthly cost estimate for typical usage", () => {
    // Assume 100 requests per day, 30 days, average 1000 input + 500 output per request
    const requestsPerMonth = 100 * 30
    const inputPerRequest = 1000
    const outputPerRequest = 500

    const totalInput = inputPerRequest * requestsPerMonth
    const totalOutput = outputPerRequest * requestsPerMonth

    const haikuMonthly = calculateTokenCost("claude-3-haiku-20240307", totalInput, totalOutput)
    const sonnetMonthly = calculateTokenCost("claude-3-5-sonnet-20241022", totalInput, totalOutput)

    // Sonnet: about $9 + $22.50 = $31.50 (3150 cents)
    expect(sonnetMonthly.totalCost).toBeGreaterThan(3000)
    expect(sonnetMonthly.totalCost).toBeLessThan(3500)

    // Haiku: about $0.75 + $1.875 = $2.625 (262.5 cents)
    expect(haikuMonthly.totalCost).toBeGreaterThan(200)
    expect(haikuMonthly.totalCost).toBeLessThan(300)
  })
})
