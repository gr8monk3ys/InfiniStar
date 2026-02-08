/**
 * AI Memory Service
 *
 * Provides functions for managing AI memory/context persistence.
 * Allows the AI to remember important information across conversations.
 */

import Anthropic from "@anthropic-ai/sdk"
import { MemoryCategory, type AIMemory } from "@prisma/client"

import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"

// Memory limits by subscription tier
export const MEMORY_LIMITS = {
  FREE: 50,
  PRO: 200,
} as const

// Maximum content length per memory
export const MAX_MEMORY_CONTENT_LENGTH = 500

// Maximum memories to include in context
export const MAX_MEMORIES_IN_CONTEXT = 20

/**
 * Memory category metadata for UI display
 */
export const MEMORY_CATEGORIES: Record<
  MemoryCategory,
  {
    label: string
    description: string
    icon: string
    color: string
  }
> = {
  PREFERENCE: {
    label: "Preference",
    description: "User preferences and settings",
    icon: "settings",
    color: "blue",
  },
  FACT: {
    label: "Fact",
    description: "Facts about the user",
    icon: "info",
    color: "green",
  },
  CONTEXT: {
    label: "Context",
    description: "Project or work context",
    icon: "folder",
    color: "purple",
  },
  INSTRUCTION: {
    label: "Instruction",
    description: "Standing instructions for AI",
    icon: "clipboard",
    color: "orange",
  },
  RELATIONSHIP: {
    label: "Relationship",
    description: "Information about relationships",
    icon: "users",
    color: "pink",
  },
}

export interface MemoryWithMeta extends AIMemory {
  isExpired?: boolean
}

export interface SaveMemoryOptions {
  category?: MemoryCategory
  importance?: number
  expiresAt?: Date | null
  sourceConversationId?: string
}

export interface ExtractedMemory {
  key: string
  content: string
  category: MemoryCategory
  importance: number
}

/**
 * Get memory limit for user based on subscription
 */
export async function getMemoryLimit(userId: string): Promise<number> {
  try {
    const plan = await getUserSubscriptionPlan(userId)
    return plan.isPro ? MEMORY_LIMITS.PRO : MEMORY_LIMITS.FREE
  } catch {
    return MEMORY_LIMITS.FREE
  }
}

/**
 * Get current memory count for user
 */
export async function getMemoryCount(userId: string): Promise<number> {
  return prisma.aIMemory.count({
    where: { userId },
  })
}

/**
 * Check if user can create more memories
 */
export async function canCreateMemory(userId: string): Promise<{
  allowed: boolean
  current: number
  limit: number
}> {
  const [current, limit] = await Promise.all([getMemoryCount(userId), getMemoryLimit(userId)])

  return {
    allowed: current < limit,
    current,
    limit,
  }
}

/**
 * Get all memories for a user with optional filtering
 */
export async function getUserMemories(
  userId: string,
  options?: {
    category?: MemoryCategory
    includeExpired?: boolean
    orderBy?: "importance" | "createdAt" | "updatedAt"
    order?: "asc" | "desc"
  }
): Promise<MemoryWithMeta[]> {
  const { category, includeExpired = false, orderBy = "importance", order = "desc" } = options || {}

  const now = new Date()

  const memories = await prisma.aIMemory.findMany({
    where: {
      userId,
      ...(category && { category }),
      ...(!includeExpired && {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      }),
    },
    orderBy: { [orderBy]: order },
  })

  return memories.map((memory) => ({
    ...memory,
    isExpired: memory.expiresAt ? memory.expiresAt < now : false,
  }))
}

/**
 * Get a single memory by key
 */
export async function getMemoryByKey(userId: string, key: string): Promise<AIMemory | null> {
  return prisma.aIMemory.findUnique({
    where: {
      userId_key: {
        userId,
        key,
      },
    },
  })
}

/**
 * Save or update a memory
 */
export async function saveMemory(
  userId: string,
  key: string,
  content: string,
  options?: SaveMemoryOptions
): Promise<AIMemory> {
  const {
    category = MemoryCategory.FACT,
    importance = 3,
    expiresAt = null,
    sourceConversationId,
  } = options || {}

  // Validate content length
  if (content.length > MAX_MEMORY_CONTENT_LENGTH) {
    throw new Error(
      `Memory content exceeds maximum length of ${MAX_MEMORY_CONTENT_LENGTH} characters`
    )
  }

  // Validate importance range
  if (importance < 1 || importance > 5) {
    throw new Error("Importance must be between 1 and 5")
  }

  // Check if memory exists
  const existingMemory = await getMemoryByKey(userId, key)

  if (existingMemory) {
    // Update existing memory
    return prisma.aIMemory.update({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
      data: {
        content,
        category,
        importance,
        expiresAt,
        sourceConversationId,
      },
    })
  }

  // Check memory limit before creating new
  const { allowed, current, limit } = await canCreateMemory(userId)
  if (!allowed) {
    throw new Error(
      `Memory limit reached (${current}/${limit}). Delete some memories or upgrade to PRO.`
    )
  }

  // Create new memory
  return prisma.aIMemory.create({
    data: {
      userId,
      key,
      content,
      category,
      importance,
      expiresAt,
      sourceConversationId,
    },
  })
}

/**
 * Delete a memory by key
 */
export async function deleteMemory(userId: string, key: string): Promise<boolean> {
  try {
    await prisma.aIMemory.delete({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Delete all memories for a user
 */
export async function deleteAllMemories(userId: string): Promise<number> {
  const result = await prisma.aIMemory.deleteMany({
    where: { userId },
  })
  return result.count
}

/**
 * Delete expired memories for all users
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredMemories(): Promise<number> {
  const result = await prisma.aIMemory.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
  return result.count
}

/**
 * Get memories relevant to the current conversation context
 * Returns high-importance and recently updated memories
 */
export async function getRelevantMemories(userId: string, _context?: string): Promise<AIMemory[]> {
  const now = new Date()

  // Get all non-expired memories sorted by importance
  const memories = await prisma.aIMemory.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: MAX_MEMORIES_IN_CONTEXT,
  })

  // If context is provided, we could do semantic matching here
  // For now, just return top memories by importance
  // Future enhancement: Use embeddings for semantic similarity

  return memories
}

/**
 * Build memory context string for AI system prompt
 */
export function buildMemoryContext(memories: AIMemory[]): string {
  if (memories.length === 0) {
    return ""
  }

  const memoryLines = memories.map((memory) => {
    const categoryLabel =
      MEMORY_CATEGORIES[memory.category as MemoryCategory]?.label || memory.category
    return `- [${categoryLabel}] ${memory.content}`
  })

  return `
## User Context (Remembered Information)
The following information has been saved about this user. Use it to personalize responses:

${memoryLines.join("\n")}

Remember to consider this context when responding, but don't explicitly mention that you're using stored memories unless relevant.
`
}

/**
 * Extract memorable information from conversation messages using AI
 */
export async function extractMemoriesFromMessages(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  existingMemories: AIMemory[]
): Promise<ExtractedMemory[]> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
  })

  // Build context of existing memories
  const existingMemoryContext =
    existingMemories.length > 0
      ? `Existing memories:\n${existingMemories.map((m) => `- ${m.key}: ${m.content}`).join("\n")}`
      : "No existing memories."

  // Build conversation context
  const conversationContext = messages
    .slice(-10) // Only last 10 messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n")

  const extractionPrompt = `Analyze the following conversation and extract any memorable information about the user that would be useful to remember for future conversations.

${existingMemoryContext}

Recent conversation:
${conversationContext}

Extract new or updated information about the user. Focus on:
1. PREFERENCE: User preferences (e.g., communication style, formatting preferences)
2. FACT: Facts about them (e.g., profession, location, expertise)
3. CONTEXT: Current projects or work context
4. INSTRUCTION: Standing instructions they've given (e.g., "always respond in Spanish")
5. RELATIONSHIP: People or things they've mentioned (e.g., family, pets, colleagues)

Return a JSON array of memories to save. Each memory should have:
- key: A unique snake_case identifier (e.g., "preferred_language", "current_project")
- content: The information to remember (max 500 chars, be concise)
- category: One of PREFERENCE, FACT, CONTEXT, INSTRUCTION, RELATIONSHIP
- importance: 1-5 (5 being most important)

Only extract genuinely useful information. Don't create memories for trivial or temporary things.
If there's nothing notable to remember, return an empty array.

Respond with ONLY the JSON array, no other text.`

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022", // Use faster model for extraction
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
    })

    const responseText = response.content[0].type === "text" ? response.content[0].text : ""

    // Parse the JSON response
    const extracted = JSON.parse(responseText) as ExtractedMemory[]

    // Validate and sanitize extracted memories
    return extracted
      .filter((memory) => {
        return (
          memory.key &&
          memory.content &&
          memory.category &&
          ["PREFERENCE", "FACT", "CONTEXT", "INSTRUCTION", "RELATIONSHIP"].includes(
            memory.category
          ) &&
          memory.importance >= 1 &&
          memory.importance <= 5 &&
          memory.content.length <= MAX_MEMORY_CONTENT_LENGTH
        )
      })
      .map((memory) => ({
        ...memory,
        key: memory.key.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        content: memory.content.slice(0, MAX_MEMORY_CONTENT_LENGTH),
        category: memory.category as MemoryCategory,
      }))
  } catch (error) {
    console.error("Failed to extract memories:", error)
    return []
  }
}

/**
 * Bulk save extracted memories
 */
export async function saveExtractedMemories(
  userId: string,
  memories: ExtractedMemory[],
  sourceConversationId?: string
): Promise<{ saved: number; failed: number }> {
  let saved = 0
  let failed = 0

  for (const memory of memories) {
    try {
      await saveMemory(userId, memory.key, memory.content, {
        category: memory.category,
        importance: memory.importance,
        sourceConversationId,
      })
      saved++
    } catch (error) {
      console.error(`Failed to save memory ${memory.key}:`, error)
      failed++
    }
  }

  return { saved, failed }
}
