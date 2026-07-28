import {
  deleteOldConversations,
  getAutoDeletePreview,
  getConversationsToDelete,
} from "@/app/lib/auto-delete"

import { createConversation, createUser, prisma, resetDatabase } from "./helpers"

/**
 * Auto-delete retention logic against a real database.
 *
 * getConversationsToDelete builds a Prisma `AND` of relation filters and array
 * predicates (`archivedBy.isEmpty`, `archivedBy.has`, tag `NOT ... some`).
 * Mocks assert the shape of that query object; only a real database proves the
 * predicates select the rows the feature intends — this is a destructive
 * feature, so selecting one row too many deletes a user's conversations.
 */
// Pusher is an external service. deleteOldConversations notifies participants
// over it; these suites are about database behavior, so the transport is mocked
// rather than reaching the network.
jest.mock("@/app/lib/pusher-server", () => ({
  pusherServer: { trigger: jest.fn().mockResolvedValue(undefined) },
}))

async function enableAutoDelete(
  userId: string,
  overrides: Partial<{
    autoDeleteAfterDays: number
    autoDeleteArchived: boolean
    autoDeleteExcludeTags: string[]
  }> = {}
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      autoDeleteEnabled: true,
      autoDeleteAfterDays: overrides.autoDeleteAfterDays ?? 30,
      autoDeleteArchived: overrides.autoDeleteArchived ?? false,
      autoDeleteExcludeTags: overrides.autoDeleteExcludeTags ?? [],
    },
  })
}

describe("auto-delete retention (real database)", () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("selects only conversations older than the retention window", async () => {
    const user = await createUser()
    await enableAutoDelete(user.id, { autoDeleteAfterDays: 30 })

    const old = await createConversation(user.id, { daysAgo: 45, name: "Old" })
    await createConversation(user.id, { daysAgo: 10, name: "Recent" })

    const toDelete = await getConversationsToDelete(user.id)

    expect(toDelete.map((c) => c.id)).toEqual([old.id])
  })

  it("returns nothing while auto-delete is disabled", async () => {
    const user = await createUser()
    await createConversation(user.id, { daysAgo: 400 })

    expect(await getConversationsToDelete(user.id)).toEqual([])
  })

  it("never selects another user's conversations", async () => {
    const user = await createUser()
    const other = await createUser()
    await enableAutoDelete(user.id, { autoDeleteAfterDays: 7 })

    await createConversation(other.id, { daysAgo: 90, name: "Someone else's" })
    const own = await createConversation(user.id, { daysAgo: 90, name: "Mine" })

    const toDelete = await getConversationsToDelete(user.id)
    expect(toDelete.map((c) => c.id)).toEqual([own.id])
  })

  it("skips archived conversations unless autoDeleteArchived is set", async () => {
    const user = await createUser()
    await enableAutoDelete(user.id, { autoDeleteAfterDays: 30, autoDeleteArchived: false })

    const archived = await createConversation(user.id, { daysAgo: 60, archived: true })
    const plain = await createConversation(user.id, { daysAgo: 60 })

    const withoutArchived = await getConversationsToDelete(user.id)
    expect(withoutArchived.map((c) => c.id)).toEqual([plain.id])

    await enableAutoDelete(user.id, { autoDeleteAfterDays: 30, autoDeleteArchived: true })
    const withArchived = await getConversationsToDelete(user.id)
    expect(withArchived.map((c) => c.id).sort()).toEqual([archived.id, plain.id].sort())
  })

  it("excludes conversations carrying an excluded tag", async () => {
    const user = await createUser()
    const keep = await prisma.tag.create({
      data: { name: "keep", color: "blue", userId: user.id },
    })

    await enableAutoDelete(user.id, {
      autoDeleteAfterDays: 30,
      autoDeleteExcludeTags: [keep.id],
    })

    const tagged = await createConversation(user.id, { daysAgo: 60, tagIds: [keep.id] })
    const untagged = await createConversation(user.id, { daysAgo: 60 })

    const toDelete = await getConversationsToDelete(user.id)
    const ids = toDelete.map((c) => c.id)

    expect(ids).toContain(untagged.id)
    expect(ids).not.toContain(tagged.id)
  })

  it("preview and delete agree, and delete removes exactly the previewed rows", async () => {
    const user = await createUser()
    await enableAutoDelete(user.id, { autoDeleteAfterDays: 30 })

    const doomed = await createConversation(user.id, { daysAgo: 60 })
    const spared = await createConversation(user.id, { daysAgo: 5 })

    const preview = await getAutoDeletePreview(user.id)
    expect(preview.conversations.map((c) => c.id)).toEqual([doomed.id])

    const result = await deleteOldConversations(user.id)
    expect(result.deletedCount).toBe(1)

    expect(await prisma.conversation.count({ where: { id: doomed.id } })).toBe(0)
    expect(await prisma.conversation.count({ where: { id: spared.id } })).toBe(1)
  })

  it("cascades message deletion when a conversation is auto-deleted", async () => {
    const user = await createUser()
    await enableAutoDelete(user.id, { autoDeleteAfterDays: 30 })

    const conversation = await createConversation(user.id, { daysAgo: 60 })
    await prisma.message.create({
      data: { body: "hello", conversationId: conversation.id, senderId: user.id },
    })

    await deleteOldConversations(user.id)

    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(0)
  })
})
