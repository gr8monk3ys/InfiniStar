import {
  publishMessageDeleted,
  publishMessageReaction,
  publishMessageSeen,
  publishMessageUpdated,
  publishNewMessage,
  publishParticipantJoined,
} from "@/app/lib/conversation-events"
import { type FullMessageType } from "@/app/types"

/**
 * @jest-environment node
 */

/**
 * The publisher's contract.
 *
 * These tests exist because the three defects this module was written for were
 * all invisible to the route tests: those assert `pusherServer.trigger` was
 * called with a channel and an event name, never that the right *pair* of events
 * fired, never that the payload had the shape its handler reads, and never that
 * a Pusher outage is contained.
 */

const mockTrigger = jest.fn()
const mockLoggerError = jest.fn()

jest.mock("@/app/lib/pusher-server", () => ({
  pusherServer: {
    trigger: (...args: unknown[]) => mockTrigger(...args),
  },
}))

jest.mock("@/app/lib/pusher-channels", () => ({
  getPusherConversationChannel: (id: string) => `private-conversation-${id}`,
  getPusherUserChannel: (id: string) => `private-user-${id}`,
  PUSHER_PRESENCE_CHANNEL: "presence-messenger",
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: { child: jest.fn() },
  apiLogger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    info: jest.fn(),
  },
  aiLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  authLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  dbLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

const MESSAGE = {
  id: "msg-1",
  body: "hello",
  conversationId: "conv-1",
  senderId: "user-1",
  isAI: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  sender: { id: "user-1", name: "A", email: "a@x.com", image: null, createdAt: new Date() },
  seen: [],
  replyTo: null,
} as unknown as FullMessageType

beforeEach(() => {
  mockTrigger.mockReset()
  mockTrigger.mockResolvedValue(undefined)
  mockLoggerError.mockReset()
})

describe("publishNewMessage", () => {
  /**
   * The pairing that /api/ai/chat-stream used to break: it emitted only
   * `messages:new`, so the sidebar's last-message preview did not update live on
   * the default send path while the non-default routes' did.
   */
  it("emits both the conversation event and a sidebar update for every participant", async () => {
    await publishNewMessage({
      conversationId: "conv-1",
      message: MESSAGE,
      notify: ["user-1", "user-2"],
    })

    expect(mockTrigger).toHaveBeenCalledWith("private-conversation-conv-1", "messages:new", MESSAGE)
    expect(mockTrigger).toHaveBeenCalledWith("private-user-user-1", "conversation:update", {
      id: "conv-1",
      messages: [MESSAGE],
    })
    expect(mockTrigger).toHaveBeenCalledWith("private-user-user-2", "conversation:update", {
      id: "conv-1",
      messages: [MESSAGE],
    })
    expect(mockTrigger).toHaveBeenCalledTimes(3)
  })

  it("still emits the conversation event when there is nobody to notify", async () => {
    await publishNewMessage({ conversationId: "conv-1", message: MESSAGE, notify: [] })

    expect(mockTrigger).toHaveBeenCalledTimes(1)
    expect(mockTrigger).toHaveBeenCalledWith("private-conversation-conv-1", "messages:new", MESSAGE)
  })

  /**
   * `conversation:update`'s handler reads `conversation.messages[0]` as the
   * newest message. The payload is a one-element array so that read is correct
   * regardless of which end of the array a reader treats as newest — two
   * readers in the app disagree about that, and only the length keeps them
   * consistent.
   */
  it("sends exactly one message in the sidebar payload", async () => {
    await publishNewMessage({ conversationId: "conv-1", message: MESSAGE, notify: ["user-1"] })

    const sidebarCall = mockTrigger.mock.calls.find(
      (call) => call[1] === "conversation:update"
    ) as unknown[]
    expect((sidebarCall[2] as { messages: unknown[] }).messages).toHaveLength(1)
  })
})

describe("message change events", () => {
  it.each([
    ["message:update", publishMessageUpdated],
    ["message:delete", publishMessageDeleted],
    ["message:reaction", publishMessageReaction],
  ])("publishes %s on the conversation channel only", async (event, publisher) => {
    await publisher({ conversationId: "conv-1", message: MESSAGE })

    expect(mockTrigger).toHaveBeenCalledTimes(1)
    expect(mockTrigger).toHaveBeenCalledWith("private-conversation-conv-1", event, MESSAGE)
  })
})

describe("publishMessageSeen", () => {
  it("updates the reader's own sidebar as well as the open thread", async () => {
    await publishMessageSeen({ conversationId: "conv-1", message: MESSAGE, viewerId: "user-2" })

    expect(mockTrigger).toHaveBeenCalledWith("private-user-user-2", "conversation:update", {
      id: "conv-1",
      messages: [MESSAGE],
    })
    expect(mockTrigger).toHaveBeenCalledWith(
      "private-conversation-conv-1",
      "message:update",
      MESSAGE
    )
    expect(mockTrigger).toHaveBeenCalledTimes(2)
  })
})

describe("publishParticipantJoined", () => {
  /**
   * Regression: this was sent as `conversation:update`, and that handler keeps
   * only `messages`. The join reached the wire and was dropped on arrival.
   */
  it("uses an event name whose handler reads users, not messages", async () => {
    const users = [
      { id: "user-1", name: "A", email: "a@x.com", image: null, createdAt: new Date() },
      { id: "user-2", name: "B", email: "b@x.com", image: null, createdAt: new Date() },
    ]

    await publishParticipantJoined({ conversationId: "conv-1", users, notify: ["user-1"] })

    expect(mockTrigger).toHaveBeenCalledWith("private-user-user-1", "conversation:participants", {
      id: "conv-1",
      users,
    })
    expect(mockTrigger).not.toHaveBeenCalledWith(
      expect.anything(),
      "conversation:update",
      expect.anything()
    )
  })

  it("does not notify the joiner", async () => {
    await publishParticipantJoined({ conversationId: "conv-1", users: [], notify: [] })
    expect(mockTrigger).not.toHaveBeenCalled()
  })
})

describe("failure containment", () => {
  /**
   * The caller's database write has already committed. A Pusher outage must not
   * turn a successful mutation into a 500 — containment existed at exactly one
   * of 32 call sites before this module.
   */
  it("swallows and logs a publish failure instead of rejecting", async () => {
    mockTrigger.mockRejectedValue(new Error("pusher is down"))

    await expect(
      publishNewMessage({ conversationId: "conv-1", message: MESSAGE, notify: ["user-1"] })
    ).resolves.toBeUndefined()

    expect(mockLoggerError).toHaveBeenCalled()
    expect(mockLoggerError.mock.calls[0][1]).toBe("PUSHER_PUBLISH_FAILED")
  })

  it("still delivers to the other participants when one channel fails", async () => {
    mockTrigger.mockImplementation((channel: string) =>
      channel === "private-user-user-1" ? Promise.reject(new Error("nope")) : Promise.resolve()
    )

    await publishNewMessage({
      conversationId: "conv-1",
      message: MESSAGE,
      notify: ["user-1", "user-2"],
    })

    expect(mockTrigger).toHaveBeenCalledWith("private-user-user-2", "conversation:update", {
      id: "conv-1",
      messages: [MESSAGE],
    })
  })
})
