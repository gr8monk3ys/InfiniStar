import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import { CharacterStartChatButton } from "@/app/components/characters/CharacterStartChatButton"

// posthog-js singleton (installed + provider mounted by slice A1). Mock the capture sink.
jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { capture: jest.fn() },
}))

const pushMock = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

// CSRF token hook — not exercised on the logged-out path, return a stable stub.
jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "test-csrf" }),
}))

// Auth hook — drive the LOGGED-OUT branch.
const useAppAuthMock = jest.fn()
jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => useAppAuthMock(),
}))

const posthog = require("posthog-js").default

describe("CharacterStartChatButton — logged-out signup wall", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAppAuthMock.mockReturnValue({ userId: null, isSignedIn: false })
  })

  it("fires start_chat_signup_wall_hit and redirects to /sign-in for logged-out users", () => {
    render(<CharacterStartChatButton characterId="char-123" slug="aria" />)

    fireEvent.click(screen.getByRole("button", { name: /start chat/i }))

    expect(posthog.capture).toHaveBeenCalledWith("character_start_chat_clicked", {
      characterId: "char-123",
      slug: "aria",
      isAuthenticated: false,
    })
    expect(posthog.capture).toHaveBeenCalledWith("start_chat_signup_wall_hit", {
      characterId: "char-123",
      slug: "aria",
    })
    expect(pushMock).toHaveBeenCalledWith("/sign-in")
  })

  it("does NOT fire the signup wall event for authenticated users", () => {
    useAppAuthMock.mockReturnValue({ userId: "u1", isSignedIn: true })
    // Stub fetch so the authenticated branch does not throw.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "conv-1" }),
    }) as unknown as typeof fetch

    render(<CharacterStartChatButton characterId="char-123" slug="aria" />)
    fireEvent.click(screen.getByRole("button", { name: /start chat/i }))

    expect(posthog.capture).toHaveBeenCalledWith("character_start_chat_clicked", {
      characterId: "char-123",
      slug: "aria",
      isAuthenticated: true,
    })
    expect(posthog.capture).not.toHaveBeenCalledWith(
      "start_chat_signup_wall_hit",
      expect.anything()
    )
  })
})
