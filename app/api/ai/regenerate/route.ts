import { type NextRequest } from "next/server"
import { z } from "zod"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import { buildMemoryContext, getRelevantMemories } from "@/app/lib/ai-memory"
import { buildAiConversationHistory } from "@/app/lib/ai-message-content"
import { getModelForUser } from "@/app/lib/ai-model-routing"
import {
  getDefaultPersonality,
  getSystemPrompt,
  isValidPersonality,
} from "@/app/lib/ai-personalities"
import { buildChatSystemBlocks } from "@/app/lib/ai-system-prompt"
import { trackAiUsage } from "@/app/lib/ai-usage"
import anthropic from "@/app/lib/anthropic"
import { buildCharacterSystemPrompt } from "@/app/lib/character-prompt"
import { PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import { renderSummaryForPrompt } from "@/app/lib/conversation-summary"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { aiLogger } from "@/app/lib/logger"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { getPusherConversationChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

/**
 * Zod schema for request body validation
 */
const regenerateSchema = z.object({
  messageId: z.string().min(1, "Message ID is required"),
})

/**
 * AI Response Regeneration Endpoint
 *
 * POST /api/ai/regenerate
 *
 * Deletes an existing AI response and regenerates a new one using the conversation context.
 * Streams the new response back using Server-Sent Events (SSE).
 */
export async function POST(request: NextRequest) {
  // CSRF Protection
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCsrfTokenFromRequest(request)

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return new Response(
      JSON.stringify({
        error: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // Rate limiting
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(aiChatLimiter.check(identifier))
  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many AI requests. Please try again in a minute.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    )
  }

  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id || !currentUser?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Validate Content-Type
    const contentType = request.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
        status: 415,
        headers: { "Content-Type": "application/json" },
      })
    }

    const body = await request.json()

    // Validate request body with Zod
    const validation = regenerateSchema.safeParse(body)
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request data",
          details: validation.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const { messageId } = validation.data

    // Find the message to regenerate.
    // The conversation is loaded with the same character/persona selection that
    // /api/ai/chat-stream uses, so a regeneration rebuilds the identical system
    // prompt instead of falling back to a bare personality prompt.
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: { select: PARTICIPANT_SELECT },
        conversation: {
          include: {
            users: { select: PARTICIPANT_SELECT },
            character: {
              select: {
                name: true,
                isNsfw: true,
                systemPrompt: true,
                scenario: true,
                exampleDialogues: true,
              },
            },
            persona: {
              select: {
                name: true,
                description: true,
                appearance: true,
                personalityTraits: true,
              },
            },
          },
        },
      },
    })

    if (!message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Verify it's an AI message
    if (!message.isAI) {
      return new Response(JSON.stringify({ error: "Can only regenerate AI messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Verify the conversation is an AI conversation
    if (!message.conversation.isAI) {
      return new Response(JSON.stringify({ error: "Not an AI conversation" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Verify user is part of the conversation
    const isUserInConversation = message.conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )

    if (!isUserInConversation) {
      return new Response(JSON.stringify({ error: "You are not part of this conversation" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    // A regeneration produces brand-new model output, so the NSFW gate is
    // re-evaluated here exactly as it is on a fresh turn: a user who has since
    // disabled NSFW (or lost adult confirmation) must not be able to press
    // "reply again" and get fresh NSFW generation out of the same character.
    if (message.conversation.character?.isNsfw && !canAccessNsfw(currentUser)) {
      return new Response(JSON.stringify({ error: "NSFW content is not enabled." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    const accessDecision = await getAiAccessDecision(currentUser.id)
    if (!accessDecision.allowed) {
      return new Response(
        JSON.stringify({
          error:
            accessDecision.message ??
            "AI access is unavailable for this account right now. Please try again.",
          code: accessDecision.code,
          limits: accessDecision.limits,
        }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Get all messages in the conversation up to (but not including) the AI message being regenerated
    const conversationMessages = await prisma.message.findMany({
      where: {
        conversationId: message.conversationId,
        createdAt: { lt: message.createdAt },
        isDeleted: false,
      },
      orderBy: { createdAt: "asc" },
      take: 20, // Get last 20 messages for context
    })

    // Build conversation history for Claude
    const conversationHistory = buildAiConversationHistory(conversationMessages)

    // Create a ReadableStream for streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullResponse = ""
        const startTime = Date.now()
        const modelToUse = getModelForUser({
          isPro: accessDecision.limits?.isPro ?? false,
          requestedModelId: message.conversation.aiModel,
        })

        const conversation = message.conversation

        // Rebuild the exact same system prompt a fresh turn would get. Character
        // conversations rebuild from the character row so edits to a character
        // (and the roleplay guardrails) apply to regenerations too, instead of
        // regenerating with a bare personality prompt.
        const personalityType =
          conversation.aiPersonality && isValidPersonality(conversation.aiPersonality)
            ? conversation.aiPersonality
            : getDefaultPersonality()
        const baseSystemPrompt = conversation.character?.systemPrompt
          ? buildCharacterSystemPrompt(conversation.character)
          : getSystemPrompt(personalityType, conversation.aiSystemPrompt || undefined)

        // Build persona context if a persona is set on this conversation
        let personaContext = ""
        if (conversation.persona) {
          const p = conversation.persona
          const parts = [`\n\n[User Persona]\nThe user is roleplaying as: ${p.name}`]
          if (p.description) parts.push(`Description: ${p.description}`)
          if (p.appearance) parts.push(`Appearance: ${p.appearance}`)
          if (p.personalityTraits) parts.push(`Personality: ${p.personalityTraits}`)
          parts.push(
            "Address the user as this persona and react to their described traits naturally."
          )
          personaContext = parts.join("\n")
        }

        // Bridge long conversations: when a stored AI summary exists, inject a
        // compact rendering of it so the model retains continuity beyond the
        // recent-history window.
        const summaryContext = renderSummaryForPrompt(conversation.summary)

        // The character + persona prefix is stable across turns and is the cached
        // block; volatile context (summary + memories) goes in a separate trailing
        // block so regenerating the summary or adding a memory never invalidates
        // the cached character prompt.
        const stablePrompt = baseSystemPrompt + personaContext
        let volatileContext = summaryContext
        try {
          const memories = await getRelevantMemories(currentUser.id)
          if (memories.length > 0) {
            volatileContext = volatileContext + "\n" + buildMemoryContext(memories)
          }
        } catch (memoryError) {
          aiLogger.warn({ err: memoryError }, "Failed to fetch memories")
        }

        try {
          // Call Anthropic API with streaming. The stable character prompt carries
          // the cache breakpoint; volatile summary/memory text is a separate block
          // so it never busts the cached prefix. See buildChatSystemBlocks.
          const aiStream = await anthropic.messages.stream({
            model: modelToUse,
            max_tokens: 2048,
            system: buildChatSystemBlocks(stablePrompt, volatileContext),
            messages: conversationHistory,
          })

          // Stream the response
          for await (const chunk of aiStream) {
            if (chunk.type === "content_block_delta") {
              if (chunk.delta.type === "text_delta") {
                const text = chunk.delta.text
                fullResponse += text

                // Send chunk to client
                const data = JSON.stringify({
                  type: "chunk",
                  content: text,
                })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }
            }
          }

          // Get the final message with usage data
          const finalMessage = await aiStream.finalMessage()
          const latencyMs = Date.now() - startTime

          // Track AI usage with actual token counts from the API
          await trackAiUsage({
            userId: currentUser.id,
            conversationId: message.conversationId,
            model: modelToUse,
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
            // AiRequestType (app/lib/ai-usage.ts) has no "regenerate" variant, and
            // adding one would silently drop regenerations out of the monthly
            // message counters, which both ai-access.ts and /api/ai/usage compute
            // with `requestType: { in: ["chat", "chat-stream"] }` — free users
            // could then regenerate past the cap for free. "chat" is the generic
            // conversational-turn label (also getAiAccessDecision's default) and
            // keeps this counted; "chat-stream" specifically means the
            // /api/ai/chat-stream send endpoint, which this is not.
            requestType: "chat",
            latencyMs,
          })

          const existingVariants = Array.isArray(message.variants)
            ? message.variants.filter((variant): variant is string => typeof variant === "string")
            : []

          // Backfill the current body as the first variant on the first regeneration.
          if (existingVariants.length === 0 && message.body) {
            existingVariants.push(message.body)
          }

          const nextVariants = [...existingVariants, fullResponse]
          const nextActiveVariant = nextVariants.length - 1

          // Overwrite the existing AI message instead of deleting + creating a new one.
          // This avoids leaving "This message was deleted" placeholders in the UI.
          const updatedMessage = await prisma.$transaction(async (tx) => {
            const updated = await tx.message.update({
              where: { id: messageId },
              data: {
                body: fullResponse,
                isDeleted: false,
                deletedAt: null,
                variants: nextVariants,
                activeVariant: nextActiveVariant,
                inputTokens: finalMessage.usage.input_tokens,
                outputTokens: finalMessage.usage.output_tokens,
              },
              include: {
                seen: { select: PARTICIPANT_SELECT },
                sender: { select: PARTICIPANT_SELECT },
              },
            })

            // Mark activity for conversation ordering and presence.
            await tx.conversation.update({
              where: { id: message.conversationId },
              data: { lastMessageAt: new Date() },
            })

            return updated
          })

          // Trigger Pusher update event for real-time UI refresh.
          await pusherServer.trigger(
            getPusherConversationChannel(message.conversationId),
            "message:update",
            updatedMessage
          )

          // Send completion signal
          const completeData = JSON.stringify({
            type: "done",
            messageId,
          })
          controller.enqueue(encoder.encode(`data: ${completeData}\n\n`))

          controller.close()
        } catch (error) {
          aiLogger.error({ err: error }, "Regeneration streaming error")

          // Send error to client
          const errorData = JSON.stringify({
            type: "error",
            error: "Failed to regenerate response",
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))

          controller.close()
        }
      },
    })

    // Return streaming response with SSE headers
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    })
  } catch (error) {
    aiLogger.error({ err: error }, "AI Regenerate error")
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
