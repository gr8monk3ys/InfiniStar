/**
 * Auto-Delete Service
 *
 * Provides functionality to automatically delete old conversations
 * based on user preferences. This includes:
 * - Getting eligible conversations for deletion
 * - Preview of what would be deleted
 * - Performing the actual deletion
 *
 * BACKGROUND JOB NOTE:
 * For production, set up a cron job or scheduled function (e.g., Vercel Cron, AWS Lambda)
 * to call the cleanup endpoint or directly invoke `runAutoDeleteForAllUsers()`
 * on a regular schedule (e.g., daily at midnight).
 *
 * Example cron expression for daily at midnight: 0 0 * * *
 */

import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"

// Valid retention period options in days
export const RETENTION_PERIODS = [7, 14, 30, 60, 90, 180, 365] as const
export type RetentionPeriod = (typeof RETENTION_PERIODS)[number]

export interface AutoDeleteSettings {
  autoDeleteEnabled: boolean
  autoDeleteAfterDays: number
  autoDeleteArchived: boolean
  autoDeleteExcludeTags: string[]
  lastAutoDeleteRun: Date | null
}

export interface ConversationPreview {
  id: string
  name: string | null
  isAI: boolean
  lastMessageAt: Date
  messageCount: number
  isArchived: boolean
  tags: { id: string; name: string; color: string }[]
  daysSinceLastMessage: number
}

export interface AutoDeletePreviewResult {
  conversations: ConversationPreview[]
  totalCount: number
  settings: AutoDeleteSettings
}

export interface AutoDeleteResult {
  deletedCount: number
  deletedConversationIds: string[]
  errors: string[]
}

/**
 * Get the auto-delete settings for a user
 */
export async function getAutoDeleteSettings(userId: string): Promise<AutoDeleteSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      autoDeleteEnabled: true,
      autoDeleteAfterDays: true,
      autoDeleteArchived: true,
      autoDeleteExcludeTags: true,
      lastAutoDeleteRun: true,
    },
  })

  if (!user) {
    throw new Error("User not found")
  }

  return {
    autoDeleteEnabled: user.autoDeleteEnabled,
    autoDeleteAfterDays: user.autoDeleteAfterDays,
    autoDeleteArchived: user.autoDeleteArchived,
    autoDeleteExcludeTags: user.autoDeleteExcludeTags,
    lastAutoDeleteRun: user.lastAutoDeleteRun,
  }
}

/**
 * Update auto-delete settings for a user
 */
export async function updateAutoDeleteSettings(
  userId: string,
  settings: Partial<Omit<AutoDeleteSettings, "lastAutoDeleteRun">>
): Promise<AutoDeleteSettings> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(settings.autoDeleteEnabled !== undefined && {
        autoDeleteEnabled: settings.autoDeleteEnabled,
      }),
      ...(settings.autoDeleteAfterDays !== undefined && {
        autoDeleteAfterDays: settings.autoDeleteAfterDays,
      }),
      ...(settings.autoDeleteArchived !== undefined && {
        autoDeleteArchived: settings.autoDeleteArchived,
      }),
      ...(settings.autoDeleteExcludeTags !== undefined && {
        autoDeleteExcludeTags: settings.autoDeleteExcludeTags,
      }),
    },
    select: {
      autoDeleteEnabled: true,
      autoDeleteAfterDays: true,
      autoDeleteArchived: true,
      autoDeleteExcludeTags: true,
      lastAutoDeleteRun: true,
    },
  })

  return {
    autoDeleteEnabled: user.autoDeleteEnabled,
    autoDeleteAfterDays: user.autoDeleteAfterDays,
    autoDeleteArchived: user.autoDeleteArchived,
    autoDeleteExcludeTags: user.autoDeleteExcludeTags,
    lastAutoDeleteRun: user.lastAutoDeleteRun,
  }
}

/**
 * Get conversations eligible for deletion based on user's settings
 */
export async function getConversationsToDelete(
  userId: string,
  settings?: AutoDeleteSettings
): Promise<ConversationPreview[]> {
  // Get settings if not provided
  const userSettings = settings || (await getAutoDeleteSettings(userId))

  if (!userSettings.autoDeleteEnabled) {
    return []
  }

  // Calculate the cutoff date
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - userSettings.autoDeleteAfterDays)

  // Build the query conditions
  const conditions: Record<string, unknown>[] = [
    { users: { some: { id: userId } } },
    { lastMessageAt: { lt: cutoffDate } },
  ]

  // Exclude archived conversations if setting is disabled
  if (!userSettings.autoDeleteArchived) {
    conditions.push({
      OR: [{ archivedBy: { isEmpty: true } }, { NOT: { archivedBy: { has: userId } } }],
    })
  }

  // Exclude conversations with certain tags
  if (userSettings.autoDeleteExcludeTags.length > 0) {
    conditions.push({
      NOT: {
        tags: { some: { id: { in: userSettings.autoDeleteExcludeTags } } },
      },
    })
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      AND: conditions,
    },
    select: {
      id: true,
      name: true,
      isAI: true,
      lastMessageAt: true,
      archivedBy: true,
      tags: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
    orderBy: {
      lastMessageAt: "asc",
    },
  })

  const now = new Date()

  return conversations.map(
    (conv: {
      id: string
      name: string | null
      isAI: boolean
      lastMessageAt: Date
      _count: { messages: number }
      archivedBy: string[]
      tags: { id: string; name: string; color: string }[]
    }) => ({
      id: conv.id,
      name: conv.name,
      isAI: conv.isAI,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv._count.messages,
      isArchived: conv.archivedBy.includes(userId),
      tags: conv.tags,
      daysSinceLastMessage: Math.floor(
        (now.getTime() - conv.lastMessageAt.getTime()) / (1000 * 60 * 60 * 24)
      ),
    })
  )
}

/**
 * Get a preview of conversations that would be deleted
 */
export async function getAutoDeletePreview(userId: string): Promise<AutoDeletePreviewResult> {
  const settings = await getAutoDeleteSettings(userId)
  const conversations = await getConversationsToDelete(userId, settings)

  return {
    conversations,
    totalCount: conversations.length,
    settings,
  }
}

/**
 * Delete old conversations for a user based on their settings
 */
export async function deleteOldConversations(userId: string): Promise<AutoDeleteResult> {
  const settings = await getAutoDeleteSettings(userId)

  if (!settings.autoDeleteEnabled) {
    return {
      deletedCount: 0,
      deletedConversationIds: [],
      errors: ["Auto-delete is not enabled"],
    }
  }

  const conversationsToDelete = await getConversationsToDelete(userId, settings)

  if (conversationsToDelete.length === 0) {
    // Update last run time even if no conversations deleted
    await prisma.user.update({
      where: { id: userId },
      data: { lastAutoDeleteRun: new Date() },
    })

    return {
      deletedCount: 0,
      deletedConversationIds: [],
      errors: [],
    }
  }

  const deletedIds: string[] = []
  const errors: string[] = []

  for (const conversation of conversationsToDelete) {
    try {
      // Get all users in the conversation before deletion
      const conv = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        select: { users: { select: { id: true } } },
      })

      // Delete the conversation and its messages
      await prisma.$transaction([
        // Delete all messages in the conversation
        prisma.message.deleteMany({
          where: { conversationId: conversation.id },
        }),
        // Delete the conversation
        prisma.conversation.delete({
          where: { id: conversation.id },
        }),
      ])

      // Notify all users in the conversation about the deletion via Pusher
      if (conv?.users) {
        for (const participant of conv.users) {
          await pusherServer.trigger(`user-${participant.id}`, "conversation:auto-delete", {
            conversationId: conversation.id,
            reason: "auto-delete",
          })
        }
      }

      deletedIds.push(conversation.id)
    } catch (error) {
      console.error(`Error deleting conversation ${conversation.id}:`, error)
      errors.push(`Failed to delete conversation ${conversation.id}`)
    }
  }

  // Update last run time
  await prisma.user.update({
    where: { id: userId },
    data: { lastAutoDeleteRun: new Date() },
  })

  return {
    deletedCount: deletedIds.length,
    deletedConversationIds: deletedIds,
    errors,
  }
}

/**
 * Run auto-delete for all users who have it enabled
 * This should be called by a cron job or scheduled function
 */
export async function runAutoDeleteForAllUsers(): Promise<{
  processedUsers: number
  totalDeleted: number
  errors: string[]
}> {
  const users = await prisma.user.findMany({
    where: {
      autoDeleteEnabled: true,
    },
    select: {
      id: true,
    },
  })

  let totalDeleted = 0
  const errors: string[] = []

  for (const user of users) {
    try {
      const result = await deleteOldConversations(user.id)
      totalDeleted += result.deletedCount
      errors.push(...result.errors)
    } catch (error) {
      console.error(`Error running auto-delete for user ${user.id}:`, error)
      errors.push(`Failed to process user ${user.id}`)
    }
  }

  return {
    processedUsers: users.length,
    totalDeleted,
    errors,
  }
}

/**
 * Validate retention period
 */
export function isValidRetentionPeriod(days: number): days is RetentionPeriod {
  return RETENTION_PERIODS.includes(days as RetentionPeriod)
}

/**
 * Get human-readable retention period label
 */
export function getRetentionPeriodLabel(days: number): string {
  if (days === 7) return "1 week"
  if (days === 14) return "2 weeks"
  if (days === 30) return "1 month"
  if (days === 60) return "2 months"
  if (days === 90) return "3 months"
  if (days === 180) return "6 months"
  if (days === 365) return "1 year"
  return `${days} days`
}
