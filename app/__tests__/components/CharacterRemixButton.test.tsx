import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import { CharacterRemixButton } from "@/app/components/characters/CharacterRemixButton"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { capture: jest.fn() },
}))

const pushMock = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "test-csrf" }),
}))

const useAppAuthMock = jest.fn()
jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => useAppAuthMock(),
}))

const posthog = require("posthog-js").default

describe("CharacterRemixButton", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAppAuthMock.mockReturnValue({ isSignedIn: false })
  })

  it("fires character_remix_clicked on click", () => {
    render(<CharacterRemixButton characterId="char-123" slug="aria" />)
    fireEvent.click(screen.getByRole("button", { name: /remix/i }))

    expect(posthog.capture).toHaveBeenCalledWith("character_remix_clicked", {
      characterId: "char-123",
      slug: "aria",
      isAuthenticated: false,
    })
    expect(pushMock).toHaveBeenCalledWith("/sign-in")
  })
})
