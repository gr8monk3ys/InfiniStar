import { randomUUID } from "node:crypto"

import prisma from "@/app/lib/prismadb"

/**
 * Removes all rows the integration suites create. Ordered so that child rows go
 * before their parents where cascades do not already cover it.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "character_likes",
      "character_comments",
      "content_reports",
      "user_blocks",
      "user_follows",
      "messages",
      "conversation_shares",
      "conversations",
      "characters",
      "tags",
      "ai_memories",
      "ai_usage",
      "message_templates",
      "user_personas",
      "users"
    RESTART IDENTITY CASCADE
  `)
}

export async function createUser(
  overrides: Partial<{ name: string; email: string; clerkId: string }> = {}
) {
  const id = randomUUID()
  return prisma.user.create({
    data: {
      clerkId: overrides.clerkId ?? `clerk_${id}`,
      email: overrides.email ?? `${id}@example.test`,
      name: overrides.name ?? "Test User",
    },
  })
}

export async function createCharacter(
  createdById: string,
  overrides: Partial<{
    name: string
    slug: string
    systemPrompt: string
    isPublic: boolean
    exampleDialogues: string
  }> = {}
) {
  const id = randomUUID()
  return prisma.character.create({
    data: {
      name: overrides.name ?? "Test Character",
      slug: overrides.slug ?? `char-${id}`,
      systemPrompt: overrides.systemPrompt ?? "You are a test character.",
      isPublic: overrides.isPublic ?? false,
      exampleDialogues: overrides.exampleDialogues,
      createdById,
    },
  })
}

/**
 * Creates a conversation owned by `userId` whose last message landed
 * `daysAgo` days in the past — the axis auto-delete filters on.
 */
export async function createConversation(
  userId: string,
  options: Partial<{ daysAgo: number; name: string; archived: boolean; tagIds: string[] }> = {}
) {
  const lastMessageAt = new Date()
  lastMessageAt.setDate(lastMessageAt.getDate() - (options.daysAgo ?? 0))

  return prisma.conversation.create({
    data: {
      name: options.name ?? "Test Conversation",
      lastMessageAt,
      isAI: true,
      users: { connect: { id: userId } },
      archivedBy: options.archived ? [userId] : [],
      ...(options.tagIds?.length
        ? { tags: { connect: options.tagIds.map((id) => ({ id })) } }
        : {}),
    },
  })
}

export { prisma }
