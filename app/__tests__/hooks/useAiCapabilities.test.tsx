import { renderHook, waitFor } from "@testing-library/react"

import { resetAiCapabilitiesCacheForTests, useAiCapabilities } from "@/app/hooks/useAiCapabilities"

const mockGet = jest.fn()

jest.mock("@/app/lib/api-client", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

describe("useAiCapabilities", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetAiCapabilitiesCacheForTests()
  })

  it("defaults to all capabilities enabled while the request is loading", () => {
    // Never resolves — simulates an in-flight request
    mockGet.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useAiCapabilities())

    expect(result.current.capabilities).toEqual({
      imageGeneration: true,
      voiceTranscription: true,
    })
    expect(result.current.isLoaded).toBe(false)
  })

  it("reflects server-reported capabilities once loaded", async () => {
    mockGet.mockResolvedValue({ imageGeneration: false, voiceTranscription: false })

    const { result } = renderHook(() => useAiCapabilities())

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true)
    })
    expect(result.current.capabilities).toEqual({
      imageGeneration: false,
      voiceTranscription: false,
    })
    expect(mockGet).toHaveBeenCalledWith(
      "/api/ai/capabilities",
      expect.objectContaining({ showErrorToast: false })
    )
  })

  it("supports mixed capability responses", async () => {
    mockGet.mockResolvedValue({ imageGeneration: true, voiceTranscription: false })

    const { result } = renderHook(() => useAiCapabilities())

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true)
    })
    expect(result.current.capabilities).toEqual({
      imageGeneration: true,
      voiceTranscription: false,
    })
  })

  it("treats malformed responses as capabilities unavailable", async () => {
    mockGet.mockResolvedValue({})

    const { result } = renderHook(() => useAiCapabilities())

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true)
    })
    expect(result.current.capabilities).toEqual({
      imageGeneration: false,
      voiceTranscription: false,
    })
  })

  it("fetches capabilities at most once across multiple hook consumers", async () => {
    mockGet.mockResolvedValue({ imageGeneration: true, voiceTranscription: true })

    const first = renderHook(() => useAiCapabilities())
    const second = renderHook(() => useAiCapabilities())

    await waitFor(() => {
      expect(first.result.current.isLoaded).toBe(true)
      expect(second.result.current.isLoaded).toBe(true)
    })

    expect(mockGet).toHaveBeenCalledTimes(1)

    // A consumer mounting after the cache is warm performs no new request.
    const third = renderHook(() => useAiCapabilities())
    expect(third.result.current.isLoaded).toBe(true)
    expect(third.result.current.capabilities).toEqual({
      imageGeneration: true,
      voiceTranscription: true,
    })
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it("keeps optimistic defaults when the request fails", async () => {
    mockGet.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useAiCapabilities())

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true)
    })
    // Buttons stay visible; the server routes still enforce configuration.
    expect(result.current.capabilities).toEqual({
      imageGeneration: true,
      voiceTranscription: true,
    })
  })
})

export {}
