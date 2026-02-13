import type Anthropic from "@anthropic-ai/sdk"

import { sanitizePlainText, sanitizeUrl } from "@/app/lib/sanitize"

export interface AiConversationMessageInput {
  isAI: boolean
  body?: string | null
  image?: string | null
}

export interface BuiltAiContent {
  content: Anthropic.Messages.MessageParam["content"] | null
  sanitizedText: string
  sanitizedImage: string | null
}

/**
 * Builds Anthropic-compatible message content while sanitizing text and image URL input.
 */
export function buildAiMessageContent(
  body: string | null | undefined,
  image: string | null | undefined
): BuiltAiContent {
  const sanitizedText = body ? sanitizePlainText(body).trim() : ""
  const safeImageUrl = image ? sanitizeUrl(image) : ""
  const sanitizedImage = safeImageUrl || null

  if (sanitizedImage) {
    const contentBlocks: Anthropic.Messages.ContentBlockParam[] = []
    if (sanitizedText) {
      contentBlocks.push({
        type: "text",
        text: sanitizedText,
      })
    }

    contentBlocks.push({
      type: "image",
      source: {
        type: "url",
        url: sanitizedImage,
      },
    })

    return {
      content: contentBlocks,
      sanitizedText,
      sanitizedImage,
    }
  }

  if (sanitizedText) {
    return {
      content: sanitizedText,
      sanitizedText,
      sanitizedImage: null,
    }
  }

  return {
    content: null,
    sanitizedText,
    sanitizedImage: null,
  }
}

/**
 * Converts stored conversation messages into Anthropic message payloads.
 */
export function buildAiConversationHistory(
  messages: AiConversationMessageInput[]
): Anthropic.Messages.MessageParam[] {
  return messages.flatMap((message) => {
    const built = buildAiMessageContent(message.body, message.image)
    if (!built.content) {
      return []
    }

    return [
      {
        role: message.isAI ? "assistant" : "user",
        content: built.content,
      },
    ]
  })
}
