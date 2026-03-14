import { type NextRequest } from "next/server"
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
import anthropic from "@/app/lib/anthropic"
import { maybeAutoExtractMemories } from "@/app/lib/auto-memory"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { aiLogger } from "@/app/lib/logger"
import {
  buildModerationDetails,
  moderateTextModelAssisted,
  moderationReasonFromCategories,
} from "@/app/lib/moderation"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { getPusherConversationChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizeUrl } from "@/app/lib/sanitize"
import { sendWebPushToUser } from "@/app/lib/web-push"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schema for AI chat stream requests
const chatStreamSchema = z.object({
  message: z.string().max(10000, "Message too long (max 10000 characters)").optional().nullable(),
  image: z.string().url("Invalid image URL").max(2000, "Image URL too long").optional().nullable(),
  audioUrl: z
    .string()
    .url("Invalid audio URL")
    .max(2000, "Audio URL too long")
    .optional()
    .nullable(),
  conversationId: z.string().min(1, "Conversation ID is required"),
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
      return new Response("Unauthorized", { status: 401 })
    }
    const allowNsfw = canAccessNsfw(currentUser)

    const body = await request.json()

    // Validate request body with Zod schema
    const validation = chatStreamSchema.safeParse(body)
    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error.issues[0].message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { message, image, audioUrl, conversationId } = validation.data

    const builtUserContent = buildAiMessageContent(message ?? null, image ?? null)
    const sanitizedMessage = builtUserContent.sanitizedText
    const sanitizedImage = builtUserContent.sanitizedImage
    const sanitizedAudioUrl = audioUrl ? sanitizeUrl(audioUrl) : null

    if (!builtUserContent.content) {
      return new Response(JSON.stringify({ error: "Message text or image is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const moderationResult = sanitizedMessage
      ? await moderateTextModelAssisted(sanitizedMessage)
      : null
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
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: { some: { id: currentUser.id } },
      },
      include: {
        character: {
          select: {
            name: true,
            isNsfw: true,
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
        messages: {
          orderBy: { createdAt: "desc" },
          take: 20, // Get last 20 messages for context
        },
      },
    })

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Not authorized for this conversation" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (!conversation.isAI) {
      return new Response("Not an AI conversation", { status: 400 })
    }

    if (conversation.character?.isNsfw && !allowNsfw) {
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
        audioUrl: sanitizedAudioUrl,
        audioTranscript: sanitizedAudioUrl ? sanitizedMessage || null : null,
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
    // Reverse because messages were fetched desc (newest-first) to get the last 20; restore chronological order
    const conversationHistory = buildAiConversationHistory(conversation.messages.slice().reverse())

    // Add the new user message to history
    conversationHistory.push({
      role: "user" as const,
      content: builtUserContent.content,
    })

    // AbortController that merges client disconnect and 60s hard timeout
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 60_000)
    request.signal.addEventListener("abort", () => abortController.abort())

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

        // Fetch and include user memories in system prompt
        let systemPrompt = baseSystemPrompt + personaContext
        try {
          const memories = await getRelevantMemories(currentUser.id)
          if (memories.length > 0) {
            const memoryContext = buildMemoryContext(memories)
            systemPrompt = systemPrompt + "\n" + memoryContext
          }
        } catch (memoryError) {
          aiLogger.warn({ err: memoryError }, "Failed to fetch memories")
        }

        try {
          // Call Anthropic API with streaming and system prompt (including memories)
          // Use cache_control to cache the system prompt — in roleplay the character
          // prompt repeats every turn, so caching saves ~90% on input token costs.
          const stream = await anthropic.messages.stream(
            {
              model: modelToUse,
              max_tokens: 1024,
              system: [
                {
                  type: "text" as const,
                  text: systemPrompt,
                  cache_control: { type: "ephemeral" as const },
                },
              ],
              messages: conversationHistory,
            },
            { signal: abortController.signal }
          )

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

          // Best-effort background memory extraction
          maybeAutoExtractMemories(currentUser.id, conversationId).catch((err) => {
            aiLogger.warn({ err }, "Auto memory extraction failed")
          })

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
            aiLogger.error({ err: error }, "WEB_PUSH_AI_COMPLETE_ERROR")
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

          clearTimeout(timeoutId)
          controller.close()
          await pushPromise
        } catch (error) {
          clearTimeout(timeoutId)
          aiLogger.error({ err: error }, "Streaming error")

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
    aiLogger.error({ err: error }, "AI Chat Stream error")
    return new Response("Internal Error", { status: 500 })
  }
}
