/**
 * AI Model Configuration
 *
 * This module provides configuration for available Anthropic Claude models.
 *
 * NOTE: Model IDs and pricing change over time. Keep this list aligned with
 * Anthropic's "models list" endpoint and pricing page.
 */

export const MODEL_SONNET_4_5 = "claude-sonnet-4-5-20250929" as const
export const MODEL_HAIKU_4_5 = "claude-haiku-4-5-20251001" as const

export const SUPPORTED_MODEL_IDS = [MODEL_SONNET_4_5, MODEL_HAIKU_4_5] as const

export type ModelType = (typeof SUPPORTED_MODEL_IDS)[number]

export interface AIModel {
  id: ModelType
  name: string
  description: string
  speed: "fast" | "balanced" | "slow"
  quality: "good" | "great" | "best"
  cost: "low" | "medium" | "high"
  maxTokens: number
  inputCostPerMillion: number // in dollars
  outputCostPerMillion: number // in dollars
  recommended: boolean
}

/**
 * Available Claude models with their configurations
 */
export const AI_MODELS: Record<ModelType, AIModel> = {
  [MODEL_SONNET_4_5]: {
    id: MODEL_SONNET_4_5,
    name: "Claude Sonnet 4.5",
    description: "High-quality responses with a strong balance of speed and cost. Recommended.",
    speed: "balanced",
    quality: "great",
    cost: "medium",
    maxTokens: 8192,
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    recommended: true,
  },
  [MODEL_HAIKU_4_5]: {
    id: MODEL_HAIKU_4_5,
    name: "Claude Haiku 4.5",
    description: "Fast and affordable. Great for lightweight chats and background features.",
    speed: "fast",
    quality: "good",
    cost: "low",
    maxTokens: 4096,
    inputCostPerMillion: 1.0,
    outputCostPerMillion: 5.0,
    recommended: false,
  },
}

/**
 * Get model configuration
 */
export function getModel(modelId: ModelType): AIModel {
  return AI_MODELS[modelId] || AI_MODELS[MODEL_SONNET_4_5]
}

/**
 * Get all available models
 */
export function getAllModels(): AIModel[] {
  return Object.values(AI_MODELS)
}

/**
 * Get default model
 */
export function getDefaultModel(): ModelType {
  return MODEL_SONNET_4_5
}

/**
 * Validate model type
 */
export function isValidModel(type: string): type is ModelType {
  return type in AI_MODELS
}

/**
 * Get recommended model
 */
export function getRecommendedModel(): AIModel {
  return Object.values(AI_MODELS).find((model) => model.recommended) || AI_MODELS[MODEL_SONNET_4_5]
}

/**
 * Format cost for display
 */
export function formatCost(cost: "low" | "medium" | "high"): string {
  const costMap = {
    low: "$",
    medium: "$$",
    high: "$$$",
  }
  return costMap[cost]
}

/**
 * Get model icon/emoji
 */
export function getModelIcon(speed: "fast" | "balanced" | "slow"): string {
  const iconMap = {
    fast: "⚡",
    balanced: "⚖️",
    slow: "🎯",
  }
  return iconMap[speed]
}
