import { act, render, screen } from "@testing-library/react"

import { MatureCharacterGate } from "@/app/(marketing)/characters/[slug]/MatureCharacterGate"

const mockUseAppAuth = jest.fn()
const mockReveal = jest.fn()

jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => mockUseAppAuth(),
}))

jest.mock("@/app/(marketing)/characters/[slug]/actions", () => ({
  revealMatureCharacter: (...args: unknown[]) => mockReveal(...args),
}))

jest.mock("@/app/components/safety/NsfwGateCard", () => ({
  NsfwGateCard: () => <button type="button">Enable 18+ NSFW</button>,
}))

function auth(
  overrides: Partial<{
    isLoaded: boolean
    isSignedInHint: boolean
    canViewMature: boolean
  }>
) {
  const { isLoaded = true, isSignedInHint = false, canViewMature = false } = overrides
  mockUseAppAuth.mockReturnValue({
    isLoaded,
    isSignedInHint,
    viewer: { canViewMature, isPro: false },
  })
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// The cached page for a mature character is the gate and nothing else. These
// tests pin the two things that must hold: nothing is requested until the
// session has confirmed the preference, and the server's answer is final.
describe("MatureCharacterGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows the gate with a sign-in link for a signed-out viewer and requests nothing", () => {
    auth({ isSignedInHint: false })

    render(<MatureCharacterGate slug="rogue" />)

    expect(screen.getByTestId("mature-character-gate")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/sign-in")
    expect(mockReveal).not.toHaveBeenCalled()
  })

  it("does not open on the cookie hint alone: signed in but session not yet loaded", () => {
    auth({ isLoaded: false, isSignedInHint: true })

    render(<MatureCharacterGate slug="rogue" />)

    expect(screen.getByTestId("mature-character-gate")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Safety Settings" })).toHaveAttribute(
      "href",
      "/dashboard/profile"
    )
    expect(mockReveal).not.toHaveBeenCalled()
  })

  it("keeps the gate up for a signed-in viewer without the preference", () => {
    auth({ isSignedInHint: true, canViewMature: false })

    render(<MatureCharacterGate slug="rogue" />)

    expect(screen.getByTestId("mature-character-gate")).toBeInTheDocument()
    expect(mockReveal).not.toHaveBeenCalled()
  })

  it("asks the server for the body once the session confirms the preference, then swaps it in", async () => {
    auth({ isSignedInHint: true, canViewMature: true })
    const pending = deferred<{ status: "ok"; body: React.ReactNode }>()
    mockReveal.mockReturnValue(pending.promise)

    render(<MatureCharacterGate slug="rogue" />)

    expect(mockReveal).toHaveBeenCalledWith("rogue")
    expect(screen.getByTestId("mature-character-gate")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Unlocking")

    await act(async () => {
      pending.resolve({ status: "ok", body: <h1>Rogue</h1> })
    })

    expect(screen.getByRole("heading", { name: "Rogue" })).toBeInTheDocument()
    expect(screen.queryByTestId("mature-character-gate")).not.toBeInTheDocument()
  })

  it("leaves the gate up when the server refuses, whatever the session said", async () => {
    auth({ isSignedInHint: true, canViewMature: true })
    mockReveal.mockResolvedValue({ status: "forbidden" })

    render(<MatureCharacterGate slug="rogue" />)

    await act(async () => {})

    expect(screen.getByTestId("mature-character-gate")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("leaves the gate up when the request fails", async () => {
    auth({ isSignedInHint: true, canViewMature: true })
    mockReveal.mockRejectedValue(new Error("network"))

    render(<MatureCharacterGate slug="rogue" />)

    await act(async () => {})

    expect(screen.getByTestId("mature-character-gate")).toBeInTheDocument()
  })
})
