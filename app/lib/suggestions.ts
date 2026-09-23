/**
 * AI Suggestions Service
 *
 * This module provides smart AI-powered suggestions for chat messages.
 * It uses Claude Haiku for fast, cost-effective suggestion generation.
 */

import { getFreeTierModel } from "@/app/lib/ai-model-routing"
import { trackAiUsage } from "@/app/lib/ai-usage"
import anthropic from "@/app/lib/anthropic"
import { type FullMessageType } from "@/app/types"

/**
 * Suggestion types available
 */
export type SuggestionType = "continue" | "reply" | "question" | "rephrase"

/**
 * Individual suggestion
 */
export interface Suggestion {
  id: string
  text: string
  type: SuggestionType
}

/**
 * Suggestions response from the API
 */
export interface SuggestionsResponse {
  suggestions: Suggestion[]
  type: SuggestionType
  cachedAt?: number
}

/**
 * Context for generating suggestions
 */
export interface SuggestionContext {
  messages: FullMessageType[]
  partialInput?: string
  conversationTopic?: string
}

/**
 * Simple in-memory cache for suggestions
 * Key: type + the recent messages' ids + the partial input (see generateCacheKey)
 * Value: cached suggestions with timestamp
 *
 * This Map is module state shared by every request the instance serves, so its
 * key must scope an entry to the conversation it came from.
 */
const suggestionCache = new Map<
  string,
  {
    response: SuggestionsResponse
    timestamp: number
  }
>()

const CACHE_TTL_MS = 30000 // 30 seconds
const MAX_CACHE_SIZE = 100

/**
 * Generate a cache key from the context and type
 */
function generateCacheKey(context: SuggestionContext, type: SuggestionType): string {
  // Keyed on message ids, not only on truncated bodies. Two conversations whose
  // last three messages *start* alike — a stock character greeting and a "hi" —
  // used to share a key, handing one chatter suggestions generated from another
  // chatter's history. A message id belongs to one conversation, so it scopes
  // the entry to people who can already read that conversation. The body slice
  // stays so an edited message still misses. The partial input is kept whole:
  // it is sent to the model whole, so a 50-character prefix under-keyed it.
  const lastMessages = context.messages
    .slice(-3)
    .map((m) => `${m.id}:${m.body?.slice(0, 50) || ""}`)
  const inputPart = context.partialInput || ""
  return `${type}:${lastMessages.join("|")}:${inputPart}`
}

/**
 * Clean up expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now()
  for (const [key, value] of suggestionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      suggestionCache.delete(key)
    }
  }

  // If still too large, remove oldest entries
  if (suggestionCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(suggestionCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE)
    for (const [key] of toRemove) {
      suggestionCache.delete(key)
    }
  }
}

/**
 * Get cached suggestions if available
 */
export function getCachedSuggestions(
  context: SuggestionContext,
  type: SuggestionType
): SuggestionsResponse | null {
  cleanupCache()
  const key = generateCacheKey(context, type)
  const cached = suggestionCache.get(key)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.response, cachedAt: cached.timestamp }
  }

  return null
}

/**
 * Cache suggestions response
 */
function cacheSuggestions(
  context: SuggestionContext,
  type: SuggestionType,
  response: SuggestionsResponse
): void {
  cleanupCache()
  const key = generateCacheKey(context, type)
  suggestionCache.set(key, {
    response,
    timestamp: Date.now(),
  })
}

/**
 * Build the prompt for Claude based on suggestion type
 */
export function buildSuggestionPrompt(
  context: SuggestionContext,
  type: SuggestionType
): { system: string; user: string } {
  // Take only last 5 messages for context
  const recentMessages = context.messages.slice(-5)

  const conversationHistory = recentMessages
    .map((msg) => {
      const role = msg.isAI ? "Assistant" : "User"
      const content = msg.body || "[Image]"
      return `${role}: ${content}`
    })
    .join("\n")

  // Search from the end instead of filtering the whole window twice.
  const lastAIMessage = recentMessages.findLast((m) => m.isAI)?.body || ""
  const lastUserMessage = recentMessages.findLast((m) => !m.isAI)?.body || ""

  let systemPrompt = ""
  let userPrompt = ""

  switch (type) {
    case "reply":
      systemPrompt = `You are a suggestion assistant. Generate 4 brief, natural reply suggestions that a user might want to send in response to an AI assistant's message. 

Rules:
- Each suggestion should be 1-2 sentences max
- Suggestions should be diverse (different approaches/angles)
- Keep suggestions conversational and natural
- Do not number the suggestions
- Output ONLY the suggestions, one per line
- No explanations or additional text`

      userPrompt = `Based on this conversation:

${conversationHistory}

The AI just said: "${lastAIMessage}"

Suggest 4 natural replies the user might want to send:`
      break

    case "question":
      systemPrompt = `You are a suggestion assistant. Generate 4 thoughtful follow-up questions that a user might want to ask to continue the conversation.

Rules:
- Questions should be relevant to the conversation topic
- Each question should explore a different aspect or angle
- Keep questions concise (1 sentence each)
- Do not number the questions
- Output ONLY the questions, one per line
- No explanations or additional text`

      userPrompt = `Based on this conversation:

${conversationHistory}

Suggest 4 follow-up questions the user might want to ask:`
      break

    case "continue":
      systemPrompt = `You are a suggestion assistant. Complete or continue the user's partial message in 4 different ways.

Rules:
- Each completion should naturally extend what the user started typing
- Provide diverse completions (different directions the message could go)
- Keep completions concise (1-2 sentences)
- Do not number the completions
- Output ONLY the completed messages, one per line
- Start each completion from where the user left off, not from the beginning
- No explanations or additional text`

      userPrompt = `Based on this conversation:

${conversationHistory}

The user is typing: "${context.partialInput}"

Suggest 4 ways to complete this message:`
      break

    case "rephrase":
      systemPrompt = `You are a suggestion assistant. Rephrase the user's message in 4 different ways while keeping the same meaning.

Rules:
- Each rephrasing should convey the same core message
- Vary the tone and style (more formal, more casual, more concise, etc.)
- Keep rephrasings concise (1-2 sentences)
- Do not number the rephrasings
- Output ONLY the rephrased messages, one per line
- No explanations or additional text`

      userPrompt = `The user wrote: "${context.partialInput || lastUserMessage}"

Suggest 4 different ways to phrase this message:`
      break
  }

  return { system: systemPrompt, user: userPrompt }
}

const NUMBERED_LINE = /^\d+[\.\)]\s/
// Global, but only ever used with `replace`, which resets `lastIndex` itself.
const SURROUNDING_QUOTES = /^["']|["']$/g
const MAX_PARSED_SUGGESTIONS = 5

/**
 * Parse Claude's response into an array of suggestions
 */
export function parseSuggestions(response: string, type: SuggestionType): Suggestion[] {
  // One pass over the lines, stopping once there are enough.
  const lines: string[] = []
  for (const rawLine of response.split("\n")) {
    const line = rawLine.trim()
    if (line.length === 0) continue
    if (NUMBERED_LINE.test(line)) continue // Remove numbered lines
    if (line.startsWith("-")) continue // Remove bullet points
    const text = line.replace(SURROUNDING_QUOTES, "").trim() // Remove quotes
    if (text.length <= 5) continue // Filter out very short lines
    lines.push(text)
    if (lines.length === MAX_PARSED_SUGGESTIONS) break
  }

  // Take up to 5 suggestions
  const suggestions = lines.map((text, index) => ({
    id: `${type}-${index}-${Date.now()}`,
    text,
    type,
  }))

  return suggestions
}

/**
 * Get shared Anthropic client
 */
function getAnthropicClient(): typeof anthropic {
  return anthropic
}

/**
 * Generate suggestions using Claude Haiku
 */
export async function generateSuggestions(
  context: SuggestionContext,
  type: SuggestionType,
  options?: {
    maxSuggestions?: number
    skipCache?: boolean
    tracking?: {
      userId: string
      conversationId: string
    }
  }
): Promise<SuggestionsResponse> {
  const { maxSuggestions = 4, skipCache = false, tracking } = options || {}

  // Check cache first
  if (!skipCache) {
    const cached = getCachedSuggestions(context, type)
    if (cached) {
      return cached
    }
  }

  // Validate context
  if (context.messages.length === 0 && !context.partialInput) {
    return { suggestions: [], type }
  }

  // Build prompt
  const { system, user } = buildSuggestionPrompt(context, type)

  // Call Claude Haiku for fast suggestions
  const anthropic = getAnthropicClient()

  const model = getFreeTierModel()
  const startedAt = Date.now()
  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system,
    messages: [
      {
        role: "user",
        content: user,
      },
    ],
  })
  const latencyMs = Date.now() - startedAt

  if (tracking) {
    await trackAiUsage({
      userId: tracking.userId,
      conversationId: tracking.conversationId,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      requestType: "suggestions",
      latencyMs,
    })
  }

  // Extract text from response
  const textContent = response.content.find((c) => c.type === "text")
  const responseText = textContent?.type === "text" ? textContent.text : ""

  // Parse suggestions
  const suggestions = parseSuggestions(responseText, type).slice(0, maxSuggestions)

  const result: SuggestionsResponse = {
    suggestions,
    type,
  }

  // Cache the result
  if (!skipCache) {
    cacheSuggestions(context, type, result)
  }

  return result
}

/**
 * Clear the suggestions cache (useful for testing or forced refresh)
 */
export function clearSuggestionsCache(): void {
  suggestionCache.clear()
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getSuggestionsCacheStats(): {
  size: number
  maxSize: number
  ttlMs: number
} {
  return {
    size: suggestionCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS,
  }
}
