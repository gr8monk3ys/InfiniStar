import { type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

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
import { sanitizePlainText } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
})

/**
 * Streaming AI Chat Endpoint
 *
 * POST /api/ai/chat-stream
 *
 * Streams AI responses in real-time using Server-Sent Events (SSE)
 * Provides better UX by showing responses as they're generated
 */
export async function POST(request: NextRequest) {
  // CSRF Protection
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
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
      return new Response("Unauthorized", { status: 401 })
    }

    const body = await request.json()
    const { message, conversationId } = body

    if (!message) {
      return new Response("Message is required", { status: 400 })
    }

    if (!conversationId) {
      return new Response("Conversation ID is required", { status: 400 })
    }

    // Sanitize user input to prevent XSS attacks
    const sanitizedMessage = sanitizePlainText(message)

    if (!sanitizedMessage || sanitizedMessage.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Valid message content is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Verify the conversation exists and is an AI conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20, // Get last 20 messages for context
        },
      },
    })

    if (!conversation) {
      return new Response("Conversation not found", { status: 404 })
    }

    if (!conversation.isAI) {
      return new Response("Not an AI conversation", { status: 400 })
    }

    // Create user message with sanitized content
    const userMessage = await prisma.message.create({
      data: {
        body: sanitizedMessage,
        conversation: {
          connect: { id: conversationId },
        },
        sender: {
          connect: { id: currentUser.id },
        },
        seen: {
          connect: { id: currentUser.id },
        },
        isAI: false,
      },
      include: {
        seen: true,
        sender: true,
      },
    })

    // Trigger Pusher event for user message
    await pusherServer.trigger(conversationId, "messages:new", userMessage)

    // Build conversation history for Claude
    const conversationHistory = conversation.messages.map((msg) => ({
      role: msg.isAI ? ("assistant" as const) : ("user" as const),
      content: msg.body || "",
    }))

    // Add the new user message to history
    conversationHistory.push({
      role: "user" as const,
      content: sanitizedMessage,
    })

    // Create a ReadableStream for streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullResponse = ""
        const startTime = Date.now()
        const modelToUse = conversation.aiModel || "claude-3-5-sonnet-20241022"

        // Get system prompt based on personality with proper type validation
        const personalityType =
          conversation.aiPersonality && isValidPersonality(conversation.aiPersonality)
            ? conversation.aiPersonality
            : getDefaultPersonality()
        const systemPrompt = getSystemPrompt(
          personalityType,
          conversation.aiSystemPrompt || undefined
        )

        try {
          // Call Anthropic API with streaming and system prompt
          const stream = await anthropic.messages.stream({
            model: modelToUse,
            max_tokens: 1024,
            system: systemPrompt, // Add system prompt for personality
            messages: conversationHistory,
          })

          // Stream the response
          for await (const chunk of stream) {
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
          const finalMessage = await stream.finalMessage()
          const latencyMs = Date.now() - startTime

          // Track AI usage with actual token counts from the API
          await trackAiUsage({
            userId: currentUser.id,
            conversationId,
            model: modelToUse,
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
            requestType: "chat-stream",
            latencyMs,
          })

          // Create AI message in database with full response
          const aiMessage = await prisma.message.create({
            data: {
              body: fullResponse,
              conversation: {
                connect: { id: conversationId },
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
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: new Date() },
          })

          // Trigger Pusher event for complete AI response
          await pusherServer.trigger(conversationId, "messages:new", aiMessage)

          // Send completion signal
          const completeData = JSON.stringify({
            type: "done",
            messageId: aiMessage.id,
          })
          controller.enqueue(encoder.encode(`data: ${completeData}\n\n`))

          controller.close()
        } catch (error) {
          console.error("Streaming error:", error)

          // Send error to client
          const errorData = JSON.stringify({
            type: "error",
            error: "Failed to generate response",
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
    console.error("AI Chat Stream error:", error)
    return new Response("Internal Error", { status: 500 })
  }
}
