import { NextResponse, type NextRequest } from "next/server"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import { getFreeTierModel } from "@/app/lib/ai-model-routing"
import {
  generateConversationSummary,
  MIN_MESSAGES_FOR_SUMMARY,
  type ConversationSummary,
} from "@/app/lib/conversation-summary"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface SummarizeRequestBody {
  forceRegenerate?: boolean
}

// POST /api/conversations/[conversationId]/summarize - Generate AI summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
): Promise<NextResponse> {
  try {
    // CSRF Protection
    if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(aiChatLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again in a minute.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        }
      )
    }

    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body for forceRegenerate option
    let forceRegenerate = false
    try {
      const body = (await request.json()) as SummarizeRequestBody
      forceRegenerate = body.forceRegenerate === true
    } catch {
      // Body is optional, proceed with defaults
    }

    // Look up the conversation for authorization and the cached-summary check.
    // The message content for generation is fetched inside generateConversationSummary.
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: { select: { id: true } },
        _count: {
          select: {
            messages: {
              where: { isDeleted: false },
            },
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Use the real total count from _count so the cache invalidates correctly
    // even when the conversation has more messages than fit in the generation window
    const totalMessageCount = conversation._count.messages

    // Check minimum message count
    if (totalMessageCount < MIN_MESSAGES_FOR_SUMMARY) {
      return NextResponse.json(
        {
          error: `Conversation needs at least ${MIN_MESSAGES_FOR_SUMMARY} messages to generate a summary. Current count: ${totalMessageCount}`,
        },
        { status: 400 }
      )
    }

    // Check if we can use cached summary
    if (
      !forceRegenerate &&
      conversation.summary &&
      conversation.summaryGeneratedAt &&
      conversation.summaryMessageCount === totalMessageCount
    ) {
      // Return cached summary
      const parsedSummary = JSON.parse(conversation.summary) as ConversationSummary
      return NextResponse.json({
        summary: parsedSummary,
        generatedAt: conversation.summaryGeneratedAt,
        messageCount: conversation.summaryMessageCount,
        cached: true,
      })
    }

    const accessDecision = await getAiAccessDecision(currentUser.id)
    if (!accessDecision.allowed) {
      return NextResponse.json(
        {
          error:
            accessDecision.message ??
            "AI access is unavailable for this account right now. Please try again.",
          code: accessDecision.code,
          limits: accessDecision.limits,
        },
        { status: 402 }
      )
    }

    const result = await generateConversationSummary({
      conversationId,
      userId: currentUser.id,
      model: getFreeTierModel(),
      requestType: "summary",
    })

    if (!result) {
      return NextResponse.json({ error: "Unable to generate a summary." }, { status: 400 })
    }

    return NextResponse.json({
      summary: result.summary,
      generatedAt: result.generatedAt,
      messageCount: result.messageCount,
      cached: false,
    })
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "CONVERSATION_SUMMARIZE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/conversations/[conversationId]/summarize - Get existing summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
): Promise<NextResponse> {
  try {
    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Return existing summary or indicate none exists
    if (conversation.summary && conversation.summaryGeneratedAt) {
      const parsedSummary = JSON.parse(conversation.summary) as ConversationSummary
      const currentMessageCount = conversation._count.messages

      return NextResponse.json({
        summary: parsedSummary,
        generatedAt: conversation.summaryGeneratedAt,
        messageCount: conversation.summaryMessageCount,
        currentMessageCount,
        hasNewMessages: currentMessageCount !== conversation.summaryMessageCount,
        canSummarize: currentMessageCount >= MIN_MESSAGES_FOR_SUMMARY,
      })
    }

    // No summary exists
    const currentMessageCount = conversation._count.messages
    return NextResponse.json({
      summary: null,
      generatedAt: null,
      messageCount: null,
      currentMessageCount,
      hasNewMessages: false,
      canSummarize: currentMessageCount >= MIN_MESSAGES_FOR_SUMMARY,
    })
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "CONVERSATION_GET_SUMMARY_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
