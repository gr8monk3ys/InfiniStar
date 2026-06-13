/**
 * Automatic conversation summarization.
 *
 * Periodically regenerates a conversation's summary in the background so that
 * long roleplays retain continuity beyond the fixed history window the chat
 * prompt sends. The summary is injected into the chat system prompt as a bridge
 * (see renderSummaryForPrompt and the AI chat routes).
 *
 * Runs fire-and-forget after creating an AI message, mirroring auto-memory:
 *   maybeAutoSummarize(conversationId, userId).catch(() => {})
 *
 * Uses the cheap free-tier model and the "summary-auto" request type, which is
 * excluded from quota/cost enforcement — a user is never blocked or charged for
 * a summary they did not request.
 */
import { getFreeTierModel } from "@/app/lib/ai-model-routing"
import { generateConversationSummary } from "@/app/lib/conversation-summary"
import { aiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

// Regenerate the summary every N total messages, once the conversation is long
// enough that the recent-history window alone would start losing earlier context.
const AUTO_SUMMARY_INTERVAL = 20
const AUTO_SUMMARY_MIN_MESSAGES = 20

function isAutoSummaryEnabled(): boolean {
  const value = process.env.AI_AUTO_SUMMARY_ENABLED?.trim().toLowerCase()
  // Default ON; only an explicit falsy value disables it.
  return value !== "0" && value !== "false" && value !== "no" && value !== "off"
}

export async function maybeAutoSummarize(conversationId: string, userId: string): Promise<void> {
  if (!isAutoSummaryEnabled()) {
    return
  }

  const messageCount = await prisma.message.count({
    where: { conversationId, isDeleted: false },
  })

  if (messageCount < AUTO_SUMMARY_MIN_MESSAGES || messageCount % AUTO_SUMMARY_INTERVAL !== 0) {
    return
  }

  try {
    await generateConversationSummary({
      conversationId,
      userId,
      model: getFreeTierModel(),
      requestType: "summary-auto",
    })
    aiLogger.info({ conversationId, messageCount }, "Auto-summary regenerated")
  } catch (error) {
    aiLogger.warn({ err: error, conversationId }, "Auto-summary failed")
  }
}
