import { type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import { buildMemoryContext, getRelevantMemories } from "@/app/lib/ai-memory"
import { buildAiConversationHistory, buildAiMessageContent } from "@/app/lib/ai-message-content"
import { getModelForUser } from "@/app/lib/ai-model-routing"
import {
  getDefaultPersonality,
  getSystemPrompt,
  isValidPersonality,
} from "@/app/lib/ai-personalities"
import { trackAiUsage } from "@/app/lib/ai-usage"
import { verifyCsrfToken } from "@/app/lib/csrf"
import {
  buildModerationDetails,
  moderateText,
  moderationReasonFromCategories,
} from "@/app/lib/moderation"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherConversationChannel } from "@/app/lib/pusher-channels"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sendWebPushToUser } from "@/app/lib/web-push"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schema for AI chat stream requests
const chatStreamSchema = z.object({
  message: z.string().max(10000, "Message too long (max 10000 characters)").optional().nullable(),
  image: z.string().url("Invalid image URL").max(2000, "Image URL too long").optional().nullable(),
  conversationId: z.string().min(1, "Conversation ID is required"),
})

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
      return new Response("Unauthorized", { status: 401 })
    }

    const body = await request.json()

    // Validate request body with Zod schema
    const validation = chatStreamSchema.safeParse(body)
    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error.issues[0].message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { message, image, conversationId } = validation.data

    const builtUserContent = buildAiMessageContent(message ?? null, image ?? null)
    const sanitizedMessage = builtUserContent.sanitizedText
    const sanitizedImage = builtUserContent.sanitizedImage

    if (!builtUserContent.content) {
      return new Response(JSON.stringify({ error: "Message text or image is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const moderationResult = sanitizedMessage ? moderateText(sanitizedMessage) : null
    if (moderationResult?.shouldBlock) {
      return new Response(
        JSON.stringify({
          error: "Message was blocked by safety filters.",
          code: "CONTENT_BLOCKED",
          categories: moderationResult.categories,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Verify the conversation exists and is an AI conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        character: {
          select: {
            name: true,
          },
        },
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

    if (moderationResult?.shouldReview) {
      await prisma.contentReport.create({
        data: {
          reporterId: currentUser.id,
          targetType: "CONVERSATION",
          targetId: conversationId,
          reason: moderationReasonFromCategories(moderationResult.categories),
          details: buildModerationDetails(moderationResult, "ai-chat-stream-input"),
          status: "OPEN",
        },
      })
    }

    // Create user message with sanitized content
    const userMessage = await prisma.message.create({
      data: {
        body: sanitizedMessage || null,
        image: sanitizedImage,
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
    await pusherServer.trigger(
      getPusherConversationChannel(conversationId),
      "messages:new",
      userMessage
    )

    // Build conversation history for Claude
    const conversationHistory = buildAiConversationHistory(conversation.messages)

    // Add the new user message to history
    conversationHistory.push({
      role: "user" as const,
      content: builtUserContent.content,
    })

    // Create a ReadableStream for streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullResponse = ""
        const startTime = Date.now()
        const modelToUse = getModelForUser({
          isPro: accessDecision.limits?.isPro ?? false,
          requestedModelId: conversation.aiModel,
        })

        // Get system prompt based on personality with proper type validation
        const personalityType =
          conversation.aiPersonality && isValidPersonality(conversation.aiPersonality)
            ? conversation.aiPersonality
            : getDefaultPersonality()
        const baseSystemPrompt = getSystemPrompt(
          personalityType,
          conversation.aiSystemPrompt || undefined
        )

        // Fetch and include user memories in system prompt
        let systemPrompt = baseSystemPrompt
        try {
          const memories = await getRelevantMemories(currentUser.id)
          if (memories.length > 0) {
            const memoryContext = buildMemoryContext(memories)
            systemPrompt = baseSystemPrompt + "\n" + memoryContext
          }
        } catch (memoryError) {
          // Log but don't fail the request if memory fetch fails
          console.warn("Failed to fetch memories:", memoryError)
        }

        try {
          // Call Anthropic API with streaming and system prompt (including memories)
          const stream = await anthropic.messages.stream({
            model: modelToUse,
            max_tokens: 1024,
            system: systemPrompt, // Add system prompt for personality + memories
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

          // Create AI message in database with full response and token usage
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
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
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
          await pusherServer.trigger(
            getPusherConversationChannel(conversationId),
            "messages:new",
            aiMessage
          )

          // Best-effort background push (web push) for AI completion.
          const pushPromise = (async () => {
            const prefs = await prisma.user.findUnique({
              where: { id: currentUser.id },
              select: {
                browserNotifications: true,
                notifyOnAIComplete: true,
              },
            })

            const isMuted = (conversation.mutedBy || []).includes(currentUser.id)
            if (prefs?.browserNotifications && prefs.notifyOnAIComplete && !isMuted) {
              const title = conversation.name || conversation.character?.name || "AI reply"
              const preview = aiMessage.body ? aiMessage.body.slice(0, 160) : "AI response complete"
              await sendWebPushToUser(currentUser.id, {
                title,
                body: `AI: ${preview}`,
                url: `/dashboard/conversations/${conversationId}`,
                tag: conversationId,
              })
            }
          })().catch((error) => {
            console.error("WEB_PUSH_AI_COMPLETE_ERROR", error)
          })

          // Send completion signal with token usage data
          const completeData = JSON.stringify({
            type: "done",
            messageId: aiMessage.id,
            usage: {
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
              totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
            },
          })
          controller.enqueue(encoder.encode(`data: ${completeData}\n\n`))

          controller.close()
          await pushPromise
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
