import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

import { trackAiUsage } from "@/app/lib/ai-usage"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { aiChatLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
})

// Helper function to validate CSRF token
function validateCsrf(request: NextRequest): boolean {
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

  return verifyCsrfToken(headerToken, cookieToken)
}

// Minimum number of messages required for summarization
const MIN_MESSAGES_FOR_SUMMARY = 5
// Maximum messages to include in context (to stay within token limits)
const MAX_MESSAGES_FOR_CONTEXT = 50

interface SummarizeRequestBody {
  forceRegenerate?: boolean
}

interface ConversationSummary {
  overview: string
  keyTopics: string[]
  decisions: string[]
  participants: string[]
}

// System prompt for generating summaries
const SUMMARY_SYSTEM_PROMPT = `You are a helpful assistant that creates concise conversation summaries. 
When given a conversation, produce a JSON response with the following structure:
{
  "overview": "A brief 1-2 sentence overview of the conversation",
  "keyTopics": ["Array of key topics discussed as bullet points"],
  "decisions": ["Array of any decisions made or action items identified. Use empty array if none."],
  "participants": ["Array of participant names or identifiers involved"]
}

Guidelines:
- Keep the overview concise and focused on the main purpose of the conversation
- Extract 3-5 key topics discussed
- Identify concrete decisions or action items if any exist
- List all participants who contributed to the conversation
- Respond ONLY with valid JSON, no additional text or markdown`

// POST /api/conversations/[conversationId]/summarize - Generate AI summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
): Promise<NextResponse> {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!aiChatLimiter.check(identifier)) {
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

    // Find the conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: true,
        messages: {
          where: {
            isDeleted: false,
          },
          orderBy: { createdAt: "desc" },
          take: MAX_MESSAGES_FOR_CONTEXT,
          include: {
            sender: true,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some((user: { id: string }) => user.id === currentUser.id)

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Check minimum message count
    const messageCount = conversation.messages.length
    if (messageCount < MIN_MESSAGES_FOR_SUMMARY) {
      return NextResponse.json(
        {
          error: `Conversation needs at least ${MIN_MESSAGES_FOR_SUMMARY} messages to generate a summary. Current count: ${messageCount}`,
        },
        { status: 400 }
      )
    }

    // Check if we can use cached summary
    if (
      !forceRegenerate &&
      conversation.summary &&
      conversation.summaryGeneratedAt &&
      conversation.summaryMessageCount === messageCount
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

    // Reverse messages to get chronological order for context
    const messagesInOrder = [...conversation.messages].reverse()

    // Build conversation context for Claude
    const conversationContext = messagesInOrder
      .map((msg: { isAI: boolean; body?: string | null; sender: { name?: string | null } }) => {
        const senderName = msg.isAI ? "AI Assistant" : msg.sender.name || "Unknown User"
        const content = msg.body || "[Image/Media]"
        return `${senderName}: ${content}`
      })
      .join("\n\n")

    // Get participant names
    const participantNames = conversation.users
      .map((user: { name?: string | null; email?: string | null }) => user.name || user.email || "Unknown")
      .filter((name: string, index: number, self: string[]) => self.indexOf(name) === index) // Remove duplicates

    // Track request start time for latency measurement
    const startTime = Date.now()
    const modelToUse = "claude-3-5-sonnet-20241022"

    // Call Anthropic API to generate summary
    const response = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 1024,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please summarize the following conversation. The participants are: ${participantNames.join(
            ", "
          )}\n\n--- CONVERSATION START ---\n${conversationContext}\n--- CONVERSATION END ---`,
        },
      ],
    })

    // Calculate latency
    const latencyMs = Date.now() - startTime

    // Extract response text
    const responseText = response.content[0].type === "text" ? response.content[0].text : ""

    // Parse the JSON response
    let summary: ConversationSummary
    try {
      summary = JSON.parse(responseText) as ConversationSummary
    } catch {
      // If parsing fails, create a basic summary structure
      summary = {
        overview: responseText,
        keyTopics: [],
        decisions: [],
        participants: participantNames,
      }
    }

    // Ensure participants are populated
    if (!summary.participants || summary.participants.length === 0) {
      summary.participants = participantNames
    }

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

    // Save summary to conversation
    const now = new Date()
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        summary: JSON.stringify(summary),
        summaryGeneratedAt: now,
        summaryMessageCount: messageCount,
      },
    })

    return NextResponse.json({
      summary,
      generatedAt: now,
      messageCount,
      cached: false,
    })
  } catch (error: unknown) {
    console.error("CONVERSATION_SUMMARIZE_ERROR", error)
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
    const isUserInConversation = conversation.users.some((user: { id: string }) => user.id === currentUser.id)

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
    console.error("CONVERSATION_GET_SUMMARY_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
