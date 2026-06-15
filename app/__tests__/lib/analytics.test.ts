/**
 * @jest-environment node
 */

const captureMock = jest.fn()
const shutdownMock = jest.fn()

jest.mock("posthog-node", () => ({
  __esModule: true,
  PostHog: jest.fn().mockImplementation(() => ({
    capture: captureMock,
    shutdown: shutdownMock,
  })),
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
  aiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  authLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

describe("captureServerEvent", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    captureMock.mockClear()
    shutdownMock.mockClear()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("forwards distinctId, event, and properties to PostHog.capture", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key"
    const { captureServerEvent } = await import("@/app/lib/analytics")

    captureServerEvent("user-123", "message_sent", { conversationId: "abc" })

    expect(captureMock).toHaveBeenCalledTimes(1)
    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "message_sent",
      properties: { conversationId: "abc" },
    })
  })

  it("defaults properties to an empty object when omitted", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key"
    const { captureServerEvent } = await import("@/app/lib/analytics")

    captureServerEvent("user-123", "conversation_created")

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "conversation_created",
      properties: {},
    })
  })

  it("no-ops (never constructs a client, never throws) when POSTHOG_API_KEY is unset", async () => {
    delete process.env.POSTHOG_API_KEY
    const { PostHog } = await import("posthog-node")
    const { captureServerEvent } = await import("@/app/lib/analytics")

    expect(() => captureServerEvent("user-123", "message_sent")).not.toThrow()
    expect(captureMock).not.toHaveBeenCalled()
    expect(PostHog).not.toHaveBeenCalled()
  })

  it("never throws into the caller when capture() throws internally", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key"
    captureMock.mockImplementationOnce(() => {
      throw new Error("boom")
    })
    const { captureServerEvent } = await import("@/app/lib/analytics")

    expect(() => captureServerEvent("user-123", "message_sent")).not.toThrow()
  })
})
