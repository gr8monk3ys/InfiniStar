/**
 * Auto Memory Extraction
 *
 * Triggers memory extraction automatically after AI conversations
 * reach certain message thresholds. Runs as fire-and-forget to avoid
 * blocking chat responses.
 */

import {
  canCreateMemory,
  extractMemoriesFromMessages,
  getUserMemories,
  saveExtractedMemories,
} from "@/app/lib/ai-memory"
import { aiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

const AUTO_EXTRACT_INTERVAL = 10

/**
 * Check if auto-extraction should run for this conversation,
 * and if so, extract and save memories in the background.
 *
 * Call this fire-and-forget after creating an AI message:
 *   maybeAutoExtractMemories(userId, conversationId).catch(() => {})
 */
export async function maybeAutoExtractMemories(
  userId: string,
  conversationId: string
): Promise<void> {
  const aiMessageCount = await prisma.message.count({
    where: {
      conversationId,
      isAI: true,
      isDeleted: false,
    },
  })

  if (aiMessageCount < AUTO_EXTRACT_INTERVAL || aiMessageCount % AUTO_EXTRACT_INTERVAL !== 0) {
    return
  }

  const capacityInfo = await canCreateMemory(userId)
  if (!capacityInfo.allowed) {
    return
  }

  const recentMessages = await prisma.message.findMany({
    where: {
      conversationId,
      isDeleted: false,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      body: true,
      isAI: true,
    },
  })

  const formatted = recentMessages
    .filter((msg) => msg.body)
    .reverse()
    .map((msg) => ({
      role: msg.isAI ? ("assistant" as const) : ("user" as const),
      content: msg.body!,
    }))

  if (formatted.length < 4) {
    return
  }

  const existingMemories = await getUserMemories(userId)
  const extracted = await extractMemoriesFromMessages(
    userId,
    conversationId,
    formatted,
    existingMemories
  )

  if (extracted.length === 0) {
    return
  }

  const newCount = extracted.filter((m) => !existingMemories.some((em) => em.key === m.key)).length

  if (newCount > capacityInfo.limit - capacityInfo.current) {
    aiLogger.info(
      {
        userId,
        conversationId,
        needed: newCount,
        available: capacityInfo.limit - capacityInfo.current,
      },
      "Auto-extract: insufficient memory capacity"
    )
    return
  }

  const result = await saveExtractedMemories(userId, extracted, conversationId)
  aiLogger.info(
    { userId, conversationId, extracted: extracted.length, saved: result.saved },
    "Auto-extract: memories saved"
  )
}
