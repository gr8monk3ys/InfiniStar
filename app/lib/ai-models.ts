/**
 * AI Model Configuration
 *
 * This module provides configuration for available Anthropic Claude models
 */

export type ModelType =
  | "claude-3-5-sonnet-20241022"
  | "claude-3-opus-20240229"
  | "claude-3-5-haiku-20241022"

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
  "claude-3-5-sonnet-20241022": {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    description: "Best balance of speed, quality, and cost. Recommended for most use cases.",
    speed: "balanced",
    quality: "great",
    cost: "medium",
    maxTokens: 8192,
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
    recommended: true,
  },
  "claude-3-opus-20240229": {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    description: "Most capable model with best quality output. Slower and more expensive.",
    speed: "slow",
    quality: "best",
    cost: "high",
    maxTokens: 4096,
    inputCostPerMillion: 15.0,
    outputCostPerMillion: 75.0,
    recommended: false,
  },
  "claude-3-5-haiku-20241022": {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    description: "Fast, affordable model. Great for lightweight chats and background features.",
    speed: "fast",
    quality: "good",
    cost: "low",
    maxTokens: 4096,
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4.0,
    recommended: false,
  },
}

/**
 * Get model configuration
 */
export function getModel(modelId: ModelType): AIModel {
  return AI_MODELS[modelId] || AI_MODELS["claude-3-5-sonnet-20241022"]
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
  return "claude-3-5-sonnet-20241022"
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
  return (
    Object.values(AI_MODELS).find((model) => model.recommended) ||
    AI_MODELS["claude-3-5-sonnet-20241022"]
  )
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
