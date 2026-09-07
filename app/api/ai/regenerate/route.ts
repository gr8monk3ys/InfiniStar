import { type NextRequest } from "next/server"
import { z } from "zod"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import { trackAiUsage } from "@/app/lib/ai-usage"
import anthropic from "@/app/lib/anthropic"
import { publishMessageUpdated } from "@/app/lib/conversation-events"
import { MESSAGE_INCLUDE, PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { aiLogger } from "@/app/lib/logger"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { assembleTurn, TURN_CONVERSATION_INCLUDE } from "@/app/lib/turn"
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

    // Find the message to regenerate. The conversation carries whatever a Turn
    // is assembled from, so a Regeneration is assembled by the same module a
    // fresh Turn is.
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: { select: PARTICIPANT_SELECT },
        conversation: {
          include: {
            users: { select: PARTICIPANT_SELECT },
            ...TURN_CONVERSATION_INCLUDE,
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

    // Create a ReadableStream for streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullResponse = ""
        const startTime = Date.now()
        // A Regeneration replaces the most recent reply of an existing Turn: no
        // new input, and history as it stood immediately before that reply, so
        // the model is asked the same question again rather than a different
        // one. This route used to read the *oldest* twenty messages.
        const turn = await assembleTurn({
          conversation: message.conversation,
          userId: currentUser.id,
          isPro: accessDecision.limits?.isPro ?? false,
          before: message.createdAt,
        })
        const modelToUse = turn.model

        try {
          const aiStream = await anthropic.messages.stream({
            model: modelToUse,
            max_tokens: 2048,
            system: turn.system,
            messages: turn.messages,
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
              include: MESSAGE_INCLUDE,
            })

            // Mark activity for conversation ordering and presence.
            await tx.conversation.update({
              where: { id: message.conversationId },
              data: { lastMessageAt: new Date() },
            })

            return updated
          })

          await publishMessageUpdated({
            conversationId: message.conversationId,
            message: updatedMessage,
          })

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
