/**
 * Conversation summarization core.
 *
 * Shared by the manual summarize endpoint and the automatic background
 * summarizer (app/lib/auto-summary.ts). Generates a structured summary of a
 * conversation, persists it on the Conversation row, and records AI usage.
 *
 * Callers are responsible for authorization and access/limit decisions — this
 * module only generates, persists, and tracks. The automatic path deliberately
 * skips access gating and uses the "summary-auto" request type so it never
 * counts against a user's quota (see app/lib/ai-access.ts).
 */
import { trackAiUsage, type AiRequestType } from "@/app/lib/ai-usage"
import anthropic from "@/app/lib/anthropic"
import { aiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

export const MIN_MESSAGES_FOR_SUMMARY = 5
export const MAX_MESSAGES_FOR_CONTEXT = 50

/**
 * Number of recent messages the AI chat routes send verbatim as live history
 * (`take: 20`). A stored summary is only worth injecting once the conversation
 * holds MORE messages than this window — past that point the earliest messages
 * have dropped out of the verbatim history, so the summary bridges them; below
 * it, every message is still sent verbatim and injecting would just duplicate
 * context. Keep in sync with the `take` values in app/api/ai/chat/route.ts and
 * app/api/ai/chat-stream/route.ts.
 */
export const HISTORY_WINDOW = 20

export interface ConversationSummary {
  overview: string
  keyTopics: string[]
  decisions: string[]
  participants: string[]
}

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

export interface GenerateSummaryResult {
  summary: ConversationSummary
  messageCount: number
  generatedAt: Date
}

/**
 * Generate a fresh summary for a conversation, persist it, and track usage.
 * Returns null if the conversation is too short or has no usable text content.
 */
export async function generateConversationSummary(options: {
  conversationId: string
  userId: string
  model: string
  requestType: AiRequestType
}): Promise<GenerateSummaryResult | null> {
  const { conversationId, userId, model, requestType } = options

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      users: { select: { name: true, email: true } },
      messages: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: MAX_MESSAGES_FOR_CONTEXT,
        include: { sender: { select: { name: true } } },
      },
      _count: { select: { messages: { where: { isDeleted: false } } } },
    },
  })

  if (!conversation) {
    return null
  }

  const totalMessageCount = conversation._count.messages
  if (totalMessageCount < MIN_MESSAGES_FOR_SUMMARY) {
    return null
  }

  const messagesInOrder = [...conversation.messages].reverse()
  const conversationContext = messagesInOrder
    .map((msg) => {
      const senderName = msg.isAI ? "AI Assistant" : msg.sender?.name || "Unknown User"
      const content = msg.body || "[Image/Media]"
      return `${senderName}: ${content}`
    })
    .join("\n\n")

  const participantNames = conversation.users
    .map((user) => user.name || user.email || "Unknown")
    .filter((name, index, self) => self.indexOf(name) === index)

  const startTime = Date.now()
  const response = await anthropic.messages.create({
    model,
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
  const latencyMs = Date.now() - startTime

  const responseText = response.content[0]?.type === "text" ? response.content[0].text : ""

  let summary: ConversationSummary
  try {
    summary = JSON.parse(responseText) as ConversationSummary
  } catch {
    summary = {
      overview: responseText,
      keyTopics: [],
      decisions: [],
      participants: participantNames,
    }
  }
  if (!summary.participants || summary.participants.length === 0) {
    summary.participants = participantNames
  }

  await trackAiUsage({
    userId,
    conversationId,
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    requestType,
    latencyMs,
  })

  // Never persist an empty/garbage summary. Anthropic can return non-text or
  // unparseable content, leaving overview blank. Caching that row would lock the
  // manual endpoint's cache key (summary + summaryMessageCount) onto a useless
  // summary, blocking regeneration without forceRegenerate. Return null so the
  // caller treats it as a failed generation (tokens are still tracked above).
  if (!summary.overview?.trim()) {
    aiLogger.warn(
      { conversationId },
      "Skipping conversation summary persistence: model returned a blank overview"
    )
    return null
  }

  const generatedAt = new Date()
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      summary: JSON.stringify(summary),
      summaryGeneratedAt: generatedAt,
      summaryMessageCount: totalMessageCount,
    },
  })

  return { summary, messageCount: totalMessageCount, generatedAt }
}

/**
 * Render a stored summary (JSON string from Conversation.summary) into compact
 * prose suitable for injecting into a chat system prompt as a continuity bridge.
 * Returns "" when there is nothing usable to inject.
 *
 * `currentMessageCount` is the conversation's CURRENT total message count. The
 * summary is only injected once that exceeds HISTORY_WINDOW — i.e. once the
 * conversation has more messages than the live history window can hold, so the
 * earliest messages have dropped out of the verbatim history the chat routes
 * send and the summary is needed to bridge them. While everything still fits in
 * the window, injecting the summary would duplicate context and mis-frame present
 * messages as "earlier". (Gating on the stored summaryMessageCount would be
 * wrong: that count is frozen at generation time, but the window slides as new
 * messages arrive, so a summary becomes necessary well before it is regenerated.)
 */
export function renderSummaryForPrompt(
  summaryJson: string | null | undefined,
  currentMessageCount: number | null | undefined
): string {
  if (!summaryJson) {
    return ""
  }

  if (!currentMessageCount || currentMessageCount <= HISTORY_WINDOW) {
    return ""
  }

  let parsed: Partial<ConversationSummary>
  try {
    parsed = JSON.parse(summaryJson) as Partial<ConversationSummary>
  } catch {
    aiLogger.warn("Failed to parse stored conversation summary for prompt bridge")
    return ""
  }

  const overview = parsed.overview?.trim()
  if (!overview) {
    return ""
  }

  const parts = [`\n\n[Earlier Conversation Summary]\n${overview}`]
  if (parsed.keyTopics && parsed.keyTopics.length > 0) {
    parts.push(`Key topics so far: ${parsed.keyTopics.join("; ")}`)
  }
  parts.push("(The messages below are the most recent part of this ongoing conversation.)")
  return parts.join("\n")
}
