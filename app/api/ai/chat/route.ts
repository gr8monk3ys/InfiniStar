import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { claimAllowanceSlot, releaseAllowanceClaim, type AllowanceClaim } from "@/app/lib/ai-access"
import { buildAiMessageContent } from "@/app/lib/ai-message-content"
import { trackAiUsage } from "@/app/lib/ai-usage"
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

// Validation schema matching the chat-stream endpoint schema
const chatSchema = z.object({
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

export async function POST(request: NextRequest) {
  // Declared outside the try so the catch can release a Claim whose turn died.
  let claim: AllowanceClaim | undefined
  let usageRecorded = false

  // CSRF Protection
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCsrfTokenFromRequest(request)

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return new NextResponse(
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
    return new NextResponse(
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
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const access = matureAccess(currentUser)

    const body = await request.json()

    // Validate request body with Zod schema
    const validation = chatSchema.safeParse(body)
    if (!validation.success) {
      return new NextResponse(JSON.stringify({ error: validation.error.issues[0].message }), {
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
      return new NextResponse(JSON.stringify({ error: "Message text or image is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Verify the conversation exists and is an AI conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: { some: { id: currentUser.id } },
      },
      include: TURN_CONVERSATION_INCLUDE,
    })

    if (!conversation) {
      return new NextResponse(JSON.stringify({ error: "Not authorized for this conversation" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (!conversation.isAI) {
      return new NextResponse("Not an AI conversation", { status: 400 })
    }

    if (conversation.character?.isNsfw && !access.canView) {
      return new NextResponse(JSON.stringify({ error: "NSFW content is not enabled." }), {
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
      return new NextResponse(
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
      requestType: "chat",
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
          details: buildModerationDetails(moderationResult, "ai-chat-input"),
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

    await publishNewMessage({
      conversationId,
      message: userMessage,
      notify: [currentUser.id],
    })

    const startTime = Date.now()
    const turn = await assembleTurn({
      conversation,
      userId: currentUser.id,
      isPro: grant.isPro,
      input: builtUserContent.content,
      // Anchored on the row just written, so history stops short of it.
      asOf: userMessage.createdAt,
    })
    const modelToUse = turn.model

    const response = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 2048,
      system: turn.system,
      messages: turn.messages,
    })

    // Calculate latency
    const latencyMs = Date.now() - startTime

    // Extract AI response
    const aiResponseText = response.content[0].type === "text" ? response.content[0].text : ""

    // Track AI usage
    await trackAiUsage({
      userId: currentUser.id,
      conversationId,
      model: modelToUse,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      requestType: "chat",
      latencyMs,
      claimId: claim?.id,
    })
    usageRecorded = true

    // Create AI message
    const aiMessage = await prisma.message.create({
      data: {
        body: aiResponseText,
        conversation: {
          connect: { id: conversationId },
        },
        sender: {
          connect: { id: currentUser.id }, // AI messages still need a sender
        },
        seen: {
          connect: { id: currentUser.id },
        },
        isAI: true,
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
    try {
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
    } catch (error) {
      aiLogger.error({ err: error }, "WEB_PUSH_AI_COMPLETE_ERROR")
    }

    return NextResponse.json({
      userMessage,
      aiMessage,
    })
  } catch (error) {
    aiLogger.error({ err: error }, "AI Chat error")
    // The Claim is only released when the turn produced nothing. Once
    // `trackAiUsage` has filled it in there is real usage on the row, so
    // releasing would hand back an Allowance slot that was actually spent.
    if (claim && !usageRecorded) {
      await releaseAllowanceClaim(claim)
    }
    return new NextResponse("Internal Error", { status: 500 })
  }
}
