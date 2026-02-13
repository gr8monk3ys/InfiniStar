import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

import { getAiAccessDecision } from "@/app/lib/ai-access"
import { buildAiConversationHistory, buildAiMessageContent } from "@/app/lib/ai-message-content"
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
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
})

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
  if (!aiChatLimiter.check(identifier)) {
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

    const body = await request.json()
    const { message, image, conversationId } = body

    if (!conversationId) {
      return new NextResponse("Conversation ID is required", { status: 400 })
    }

    const builtUserContent = buildAiMessageContent(message ?? null, image ?? null)
    const sanitizedMessage = builtUserContent.sanitizedText
    const sanitizedImage = builtUserContent.sanitizedImage

    if (!builtUserContent.content) {
      return new NextResponse(JSON.stringify({ error: "Message text or image is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const moderationResult = sanitizedMessage ? moderateText(sanitizedMessage) : null
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
      return new NextResponse("Conversation not found", { status: 404 })
    }

    if (!conversation.isAI) {
      return new NextResponse("Not an AI conversation", { status: 400 })
    }

    const accessDecision = await getAiAccessDecision(currentUser.id)
    if (!accessDecision.allowed) {
      return new NextResponse(
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
    const conversationHistory = buildAiConversationHistory(conversation.messages)

    // Add the new user message to history
    conversationHistory.push({
      role: "user" as const,
      content: builtUserContent.content,
    })

    // Track request start time for latency measurement
    const startTime = Date.now()
    const modelToUse = conversation.aiModel || "claude-3-5-sonnet-20241022"

    // Get system prompt based on personality with proper type validation
    const personalityType =
      conversation.aiPersonality && isValidPersonality(conversation.aiPersonality)
        ? conversation.aiPersonality
        : getDefaultPersonality()
    const systemPrompt = getSystemPrompt(personalityType, conversation.aiSystemPrompt || undefined)

    // Call Anthropic API with system prompt
    const response = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 1024,
      system: systemPrompt, // Add system prompt for personality
      messages: conversationHistory,
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
    })

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

    // Trigger Pusher event for AI response
    await pusherServer.trigger(conversationId, "messages:new", aiMessage)

    // Notify user of conversation update
    await pusherServer.trigger(currentUser.email, "conversation:update", {
      id: conversationId,
      messages: [aiMessage],
    })

    return NextResponse.json({
      userMessage,
      aiMessage,
    })
  } catch (error) {
    console.error("AI Chat error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
