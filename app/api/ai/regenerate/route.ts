import { type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import { buildAiConversationHistory } from "@/app/lib/ai-message-content"
import { getModelForUser } from "@/app/lib/ai-model-routing"
import {
  getDefaultPersonality,
  getSystemPrompt,
  isValidPersonality,
} from "@/app/lib/ai-personalities"
import { trackAiUsage } from "@/app/lib/ai-usage"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

/**
 * Zod schema for request body validation
 */
const regenerateSchema = z.object({
  messageId: z.string().min(1, "Message ID is required"),
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
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
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split("=")
        acc[key] = value
        return acc
      },
      {} as Record<string, string>
    )
    cookieToken = cookies["csrf-token"] || null
  }

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
  if (!aiChatLimiter.check(identifier)) {
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

    // Find the message to regenerate
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: true,
        conversation: {
          include: {
            users: true,
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

    // Soft delete the existing AI message
    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        body: null,
      },
      include: {
        sender: true,
        seen: true,
      },
    })

    // Trigger Pusher event to notify clients about the deletion
    await pusherServer.trigger(message.conversationId, "message:delete", deletedMessage)

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

        // Get system prompt based on personality with proper type validation
        const personalityType =
          message.conversation.aiPersonality &&
          isValidPersonality(message.conversation.aiPersonality)
            ? message.conversation.aiPersonality
            : getDefaultPersonality()
        const systemPrompt = getSystemPrompt(
          personalityType,
          message.conversation.aiSystemPrompt || undefined
        )

        try {
          // Call Anthropic API with streaming and system prompt
          const aiStream = await anthropic.messages.stream({
            model: modelToUse,
            max_tokens: 1024,
            system: systemPrompt,
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
            requestType: "chat-stream",
            latencyMs,
          })

          // Create new AI message and update conversation in a transaction for atomicity
          const newAiMessage = await prisma.$transaction(async (tx) => {
            const createdMessage = await tx.message.create({
              data: {
                body: fullResponse,
                conversation: {
                  connect: { id: message.conversationId },
                },
                sender: {
                  connect: { id: currentUser.id },
                },
                seen: {
                  connect: { id: currentUser.id },
                },
                isAI: true,
              },
              include: {
                seen: true,
                sender: true,
              },
            })

            // Update conversation lastMessageAt
            await tx.conversation.update({
              where: { id: message.conversationId },
              data: { lastMessageAt: new Date() },
            })

            return createdMessage
          })

          // Trigger Pusher event for complete AI response
          await pusherServer.trigger(message.conversationId, "messages:new", newAiMessage)

          // Send completion signal
          const completeData = JSON.stringify({
            type: "done",
            messageId: newAiMessage.id,
            deletedMessageId: messageId,
          })
          controller.enqueue(encoder.encode(`data: ${completeData}\n\n`))

          controller.close()
        } catch (error) {
          console.error("Regeneration streaming error:", error)

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
    console.error("AI Regenerate error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
