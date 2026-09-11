/**
 * @jest-environment node
 */

const findMany = jest.fn()

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: { conversation: { findMany: (...a: unknown[]) => findMany(...a) } },
}))

import getRecentCharacterChats, {
  RECENT_CHARACTER_CHAT_LIMIT,
} from "@/app/actions/getRecentCharacterChats"

beforeEach(() => findMany.mockReset())

describe("the chatter's recent characters", () => {
  it("asks for nothing at all when nobody is signed in", () => {
    // A logged-out visit must not produce a query, let alone a row.
    expect(getRecentCharacterChats(undefined)).resolves.toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it("scopes to conversations the user is actually in", async () => {
    // The failure this guards is the IDOR shape: listing by id alone would
    // hand back other people's conversations.
    findMany.mockResolvedValue([])

    await getRecentCharacterChats("user-1")

    const { where, orderBy, take } = findMany.mock.calls[0][0]
    expect(where.users).toEqual({ some: { id: "user-1" } })
    expect(where.character).toEqual({ isNot: null })
    expect(orderBy).toEqual({ lastMessageAt: "desc" })
    expect(take).toBe(RECENT_CHARACTER_CHAT_LIMIT)
  })

  it("flattens a row into what the rail needs", async () => {
    const lastMessageAt = new Date("2026-09-01T10:00:00Z")
    findMany.mockResolvedValue([
      {
        id: "conv-1",
        lastMessageAt,
        character: { id: "char-1", name: "Luna", slug: "luna", avatarUrl: "/characters/luna.webp" },
        _count: { messages: 212 },
      },
    ])

    expect(await getRecentCharacterChats("user-1")).toEqual([
      {
        conversationId: "conv-1",
        characterId: "char-1",
        name: "Luna",
        slug: "luna",
        avatarUrl: "/characters/luna.webp",
        lastMessageAt,
        messageCount: 212,
      },
    ])
  })

  it("drops a row whose character was deleted rather than rendering a blank pill", async () => {
    // `onDelete: SetNull` on the relation makes this reachable: the filter asks
    // the database for a character, and the row can still arrive without one.
    findMany.mockResolvedValue([
      { id: "conv-1", lastMessageAt: new Date(), character: null, _count: { messages: 3 } },
    ])

    expect(await getRecentCharacterChats("user-1")).toEqual([])
  })
})
