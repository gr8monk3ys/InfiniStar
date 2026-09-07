import getConversationById from "@/app/actions/getConversationById"

/**
 * @jest-environment node
 */

/**
 * `app/actions` had no tests at all. These cover the one thing the read's shape
 * is for: telling "this conversation does not exist" apart from "the database
 * is unreachable".
 */

const mockFindFirst = jest.fn()
const mockGetCurrentUser = jest.fn()
const mockLoggerError = jest.fn()

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: { conversation: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}))

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: { child: jest.fn() },
  dbLogger: { error: (...a: unknown[]) => mockLoggerError(...a), warn: jest.fn(), info: jest.fn() },
  apiLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  aiLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  authLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.com" }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue(USER)
})

describe("getConversationById", () => {
  it("returns the conversation when it exists", async () => {
    mockFindFirst.mockResolvedValue({ id: "conv-1" })

    await expect(getConversationById("conv-1")).resolves.toEqual({ id: "conv-1" })
  })

  it("returns null when the conversation does not exist", async () => {
    mockFindFirst.mockResolvedValue(null)

    await expect(getConversationById("conv-1")).resolves.toBeNull()
  })

  it("returns null when nobody is signed in, without querying", async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    await expect(getConversationById("conv-1")).resolves.toBeNull()
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  /**
   * The defect this shape exists to prevent. A bare `catch { return null }`
   * made an outage indistinguishable from a missing row, and the page renders
   * `null` as `<EmptyState />` — a chatter was told their conversation did not
   * exist while the database was down, and nothing was logged.
   */
  it("throws rather than reporting a missing conversation when the database fails", async () => {
    mockFindFirst.mockRejectedValue(new Error("connection terminated"))

    await expect(getConversationById("conv-1")).rejects.toThrow("connection terminated")
    expect(mockLoggerError).toHaveBeenCalled()
  })

  /**
   * The read used to filter on the id alone, and the page renders whatever it
   * returns — so any signed-in account holding a conversation UUID could read
   * another account's participants, character, persona and, through
   * `getMessages`, the whole message history.
   */
  it("only resolves a conversation the viewer is a participant of", async () => {
    mockFindFirst.mockResolvedValue({ id: "conv-1" })

    await getConversationById("conv-1")

    expect(mockFindFirst.mock.calls[0][0].where).toEqual({
      id: "conv-1",
      users: { some: { id: USER.id } },
    })
  })

  it("scopes tags to the viewer", async () => {
    mockFindFirst.mockResolvedValue({ id: "conv-1" })

    await getConversationById("conv-1")

    expect(mockFindFirst.mock.calls[0][0].include.tags).toEqual({ where: { userId: USER.id } })
  })
})
