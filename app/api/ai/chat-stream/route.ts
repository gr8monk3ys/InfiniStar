import { type NextRequest } from "next/server"
import { z } from "zod"

import { claimAllowanceSlot, releaseAllowanceClaim, type AllowanceClaim } from "@/app/lib/ai-access"
import { buildAiMessageContent } from "@/app/lib/ai-message-content"
import { trackAiUsage } from "@/app/lib/ai-usage"
import { captureServerEvent } from "@/app/lib/analytics"
import { isFirstHumanMessage } from "@/app/lib/analytics-events"
import anthropic from "@/app/lib/anthropic"
import { maybeAutoExtractMemories } from "@/app/lib/auto-memory"
import { maybeAutoSummarize } from "@/app/lib/auto-summary"
import { publishNewMessage } from "@/app/lib/conversation-events"
import { MESSAGE_INCLUDE, PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { aiLogger } from "@/app/lib/logger"
import {
  buildModerationDetails,
  moderateTextModelAssisted,
  moderationReasonFromCategories,
} from "@/app/lib/moderation"
import { matureAccess } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizeUrl } from "@/app/lib/sanitize"
import { assembleTurn, TURN_CONVERSATION_INCLUDE } from "@/app/lib/turn"
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
  // Declared outside the try so the outer catch can release a Claim taken for a
  // turn that then failed before it ever reached the stream — a content-report
  // write or the message insert throwing would otherwise leave the row counting
  // against the chatter's month for a turn that never happened.
  let claim: AllowanceClaim | undefined
  let usageRecorded = false

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
    const access = matureAccess(currentUser)

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
    // Narrowed here rather than inside the stream closure, where TypeScript
    // cannot carry the guard above through.
    const turnInput = builtUserContent.content

    // Verify the conversation exists and is an AI conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: { some: { id: currentUser.id } },
      },
      include: TURN_CONVERSATION_INCLUDE,
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

    if (conversation.character?.isNsfw && !access.canView) {
      return new Response(JSON.stringify({ error: "NSFW content is not enabled." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Moderation runs after the gates, because it needs to know whether this is
    // a mature conversation — and because a request that is about to 403 should
    // not pay for a model-moderation call.
    //
    // A consenting adult talking to a mature Character used to file an OPEN
    // ContentReport against their own conversation every time a turn tripped a
    // sexual review rule. The posture suppresses that signal and only that one:
    // every block rule still blocks, and non-sexual review signals still flag.
    const moderationPosture =
      conversation.character?.isNsfw && access.canView ? access.moderationPosture : "standard"

    const moderationResult = sanitizedMessage
      ? await moderateTextModelAssisted(sanitizedMessage, moderationPosture)
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

    // The Claim is taken before the provider is called, so a concurrent turn
    // counts it. Released below if this turn produces nothing.
    const grant = await claimAllowanceSlot({
      userId: currentUser.id,
      requestType: "chat-stream",
      conversationId: conversationId,
    })
    if (!grant.ok) return grant.response
    claim = grant.claim

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
      include: MESSAGE_INCLUDE,
    })

    // The chatter is the only participant of an AI conversation, so they are
    // the whole notify list. Publishing through the module emits the sidebar
    // half too; this route used to emit only the conversation half, which is
    // why the default send path did not update the sidebar live.
    await publishNewMessage({
      conversationId,
      message: userMessage,
      notify: [currentUser.id],
    })

    captureServerEvent(currentUser.id, "message_sent", {
      conversationId,
      messageId: userMessage.id,
      hasImage: Boolean(sanitizedImage),
      hasAudio: Boolean(sanitizedAudioUrl),
      surface: "ai-chat",
    })

    if (await isFirstHumanMessage(currentUser.id)) {
      captureServerEvent(currentUser.id, "first_message_sent", {
        conversationId,
        messageId: userMessage.id,
        surface: "ai-chat",
      })
    }

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
        let modelToUse = ""
        try {
          // Assembled inside the try: `loadRecentHistory` is a live query, and
          // a failure out here would reject `start()` — no error frame for the
          // client, an unclosed controller, the abort timeout left running and
          // the Claim never released.
          const turn = await assembleTurn({
            conversation,
            userId: currentUser.id,
            isPro: grant.isPro,
            input: turnInput,
            // Anchored on the row just written, so history stops short of it.
            asOf: userMessage.createdAt,
          })
          modelToUse = turn.model

          const stream = await anthropic.messages.stream(
            {
              model: modelToUse,
              max_tokens: 2048,
              system: turn.system,
              messages: turn.messages,
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
            claimId: claim?.id,
          })
          usageRecorded = true

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
            include: MESSAGE_INCLUDE,
          })

          // Update conversation lastMessageAt
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: new Date() },
          })

          await publishNewMessage({
            conversationId,
            message: aiMessage,
            notify: [currentUser.id],
          })

          // Best-effort background memory extraction
          maybeAutoExtractMemories(currentUser.id, conversationId).catch((err) => {
            aiLogger.warn({ err }, "Auto memory extraction failed")
          })

          // Best-effort background summary refresh (continuity bridge for long chats)
          maybeAutoSummarize(conversationId, currentUser.id).catch((err) => {
            aiLogger.warn({ err }, "Auto summary failed")
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
          // Released only when the turn produced nothing; once usage is
          // recorded the Allowance slot was genuinely spent.
          if (claim && !usageRecorded) {
            await releaseAllowanceClaim(claim)
          }

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
    // The turn failed before the stream ever started, so nothing was produced
    // and the Claim must go back.
    if (claim && !usageRecorded) {
      await releaseAllowanceClaim(claim)
    }
    return new Response("Internal Error", { status: 500 })
  }
}
