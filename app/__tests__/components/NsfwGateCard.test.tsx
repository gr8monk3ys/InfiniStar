import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { NsfwGateCard } from "@/app/components/safety/NsfwGateCard"

// Mock the api client
jest.mock("@/app/lib/api-client", () => ({
  api: { patch: jest.fn() },
  ApiError: class ApiError extends Error {},
  createLoadingToast: () => ({ success: jest.fn(), error: jest.fn() }),
}))

jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: true }),
}))

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

describe("NsfwGateCard", () => {
  it("shows a dialog when the enable button is clicked", async () => {
    render(<NsfwGateCard />)
    fireEvent.click(screen.getByRole("button", { name: /enable.*nsfw/i }))
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument())
  })

  it("does not call API until user confirms", async () => {
    const { api } = require("@/app/lib/api-client")
    render(<NsfwGateCard />)
    fireEvent.click(screen.getByRole("button", { name: /enable.*nsfw/i }))
    await waitFor(() => screen.getByRole("dialog"))
    expect(api.patch).not.toHaveBeenCalled()
  })

  it("disables the confirm button until the age checkbox is checked", async () => {
    render(<NsfwGateCard />)
    fireEvent.click(screen.getByRole("button", { name: /enable.*nsfw/i }))
    await waitFor(() => screen.getByRole("dialog"))
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })

  it("calls the safety preferences API after user checks age box and confirms", async () => {
    const { api } = require("@/app/lib/api-client")
    api.patch.mockResolvedValueOnce({})
    render(<NsfwGateCard />)
    fireEvent.click(screen.getByRole("button", { name: /enable.*nsfw/i }))
    await waitFor(() => screen.getByRole("dialog"))
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        "/api/safety/preferences",
        { isAdult: true, nsfwEnabled: true },
        expect.any(Object)
      )
    )
  })
})
