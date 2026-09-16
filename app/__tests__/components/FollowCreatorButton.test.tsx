import { act, render, screen } from "@testing-library/react"

import FollowCreatorButton from "@/app/(marketing)/creators/[userId]/FollowCreatorButton"

const mockUseAppAuth = jest.fn()

jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => mockUseAppAuth(),
}))

jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "csrf-token", loading: false }),
}))

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}))

function mockFollowStatus(payload: { isFollowing: boolean; followerCount: number }) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: async () => payload })
  ) as unknown as typeof fetch
}

// The creator page is prerendered, so the button starts from "not following"
// and the server's follower count; these pin how it resolves the rest.
describe("FollowCreatorButton on a prerendered page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows the sign-in prompt and asks nothing when signed out", () => {
    mockUseAppAuth.mockReturnValue({ userId: null, isSignedInHint: false })
    mockFollowStatus({ isFollowing: true, followerCount: 99 })

    render(<FollowCreatorButton creatorId="c1" creatorName="Ada" initialFollowerCount={3} />)

    expect(screen.getByRole("link", { name: "Sign in to follow" })).toHaveAttribute(
      "href",
      "/sign-in"
    )
    expect(screen.getByText("3 followers")).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("resolves the viewer's follow state from the API once the session names them", async () => {
    mockUseAppAuth.mockReturnValue({ userId: "u1", isSignedInHint: true })
    mockFollowStatus({ isFollowing: true, followerCount: 4 })

    render(<FollowCreatorButton creatorId="c1" creatorName="Ada" initialFollowerCount={3} />)

    await act(async () => {})

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/creators/c1/follow",
      expect.objectContaining({ cache: "no-store", credentials: "include" })
    )
    expect(screen.getByRole("button", { name: "Following" })).toBeEnabled()
    expect(screen.getByText("4 followers")).toBeInTheDocument()
  })

  it("holds the follow button while the session is only hinted", () => {
    mockUseAppAuth.mockReturnValue({ userId: null, isSignedInHint: true })
    mockFollowStatus({ isFollowing: false, followerCount: 3 })

    render(<FollowCreatorButton creatorId="c1" creatorName="Ada" initialFollowerCount={3} />)

    expect(screen.getByRole("button", { name: "Follow Ada" })).toBeDisabled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("disables following yourself", async () => {
    mockUseAppAuth.mockReturnValue({ userId: "c1", isSignedInHint: true })
    mockFollowStatus({ isFollowing: false, followerCount: 3 })

    render(<FollowCreatorButton creatorId="c1" creatorName="Ada" initialFollowerCount={3} />)

    await act(async () => {})

    expect(screen.getByRole("button", { name: "This is you" })).toBeDisabled()
  })
})
