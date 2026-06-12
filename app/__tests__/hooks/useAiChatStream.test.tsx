import "@testing-library/jest-dom"

import { act, renderHook } from "@testing-library/react"

import { useAiChatStream } from "@/app/hooks/useAiChatStream"

const originalFetch = global.fetch

function mockFetchResolvedValue(value: unknown) {
  const fetchMock = jest.fn().mockResolvedValue(value)
  global.fetch = fetchMock as typeof global.fetch
  return fetchMock
}

/** Minimal SSE response body that yields the given events then completes. */
function sseBody(events: string[]) {
  const encoder = new TextEncoder()
  let index = 0
  return {
    getReader: () => ({
      read: jest.fn(async () => {
        if (index < events.length) {
          const value = encoder.encode(events[index])
          index += 1
          return { done: false, value }
        }
        return { done: true, value: undefined }
      }),
    }),
  }
}

describe("useAiChatStream", () => {
  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it("propagates code and limits to onError for structured 402 responses", async () => {
    const limits = {
      isPro: false,
      monthlyMessageCount: 50,
      monthlyMessageLimit: 50,
      remainingMessages: 0,
    }
    mockFetchResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: "You have reached the free-tier monthly AI message limit.",
        code: "FREE_TIER_MESSAGE_LIMIT_REACHED",
        limits,
      }),
    })
    const onError = jest.fn()

    const { result } = renderHook(() =>
      useAiChatStream({
        conversationId: "11111111-1111-4111-8111-111111111111",
        csrfToken: "csrf-token",
        onError,
      })
    )

    let sendResult: boolean | undefined
    await act(async () => {
      sendResult = await result.current.sendMessage({ message: "Hello" })
    })

    expect(sendResult).toBe(false)
    expect(onError).toHaveBeenCalledWith(
      "You have reached the free-tier monthly AI message limit.",
      { code: "FREE_TIER_MESSAGE_LIMIT_REACHED", limits, status: 402 }
    )
    expect(result.current.error).toBe("You have reached the free-tier monthly AI message limit.")
  })

  it("reports status without a code when the error body is not valid JSON", async () => {
    mockFetchResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("invalid json")
      },
    })
    const onError = jest.fn()

    const { result } = renderHook(() =>
      useAiChatStream({
        conversationId: "11111111-1111-4111-8111-111111111111",
        csrfToken: "csrf-token",
        onError,
      })
    )

    await act(async () => {
      await result.current.sendMessage({ message: "Hello" })
    })

    expect(onError).toHaveBeenCalledWith("HTTP error! status: 500", {
      code: undefined,
      limits: undefined,
      status: 500,
    })
  })

  it("calls onError with message only when the CSRF token is missing", async () => {
    const onError = jest.fn()

    const { result } = renderHook(() =>
      useAiChatStream({
        conversationId: "11111111-1111-4111-8111-111111111111",
        csrfToken: null,
        onError,
      })
    )

    await act(async () => {
      await result.current.sendMessage({ message: "Hello" })
    })

    expect(onError).toHaveBeenCalledWith("CSRF token not available")
  })

  it("streams chunks and completes without calling onError on success", async () => {
    const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
    mockFetchResolvedValue({
      ok: true,
      status: 200,
      body: sseBody([
        'data: {"type":"chunk","content":"Hello"}\n\n',
        `data: {"type":"done","messageId":"msg_1","usage":${JSON.stringify(usage)}}\n\n`,
      ]),
    })
    const onChunk = jest.fn()
    const onComplete = jest.fn()
    const onError = jest.fn()

    const { result } = renderHook(() =>
      useAiChatStream({
        conversationId: "11111111-1111-4111-8111-111111111111",
        csrfToken: "csrf-token",
        onChunk,
        onComplete,
        onError,
      })
    )

    let sendResult: boolean | undefined
    await act(async () => {
      sendResult = await result.current.sendMessage({ message: "Hello" })
    })

    expect(sendResult).toBe(true)
    expect(onChunk).toHaveBeenCalledWith("Hello")
    expect(onComplete).toHaveBeenCalledWith("msg_1", usage)
    expect(onError).not.toHaveBeenCalled()
    expect(result.current.streamingContent).toBe("Hello")
  })
})
