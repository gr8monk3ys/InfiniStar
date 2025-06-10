import "@testing-library/jest-dom"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import ExploreClient from "@/app/(marketing)/explore/ExploreClient"

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}))

jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "csrf-token" }),
  withCsrfHeader: (_token: string | null, headers: Record<string, string>) => headers,
}))

jest.mock("@/app/components/characters/CharacterCard", () => ({
  CharacterCard: ({ character }: { character: { name: string } }) => (
    <div data-testid="character-card">{character.name}</div>
  ),
}))

const sampleCharacters = [
  {
    id: "character-1",
    slug: "hero",
    name: "Hero",
    tagline: "Bold roleplay lead",
    category: "roleplay",
    usageCount: 10,
    likeCount: 2,
    commentCount: 1,
  },
  {
    id: "character-2",
    slug: "sage",
    name: "Sage",
    tagline: "Careful fantasy guide",
    category: "fantasy",
    usageCount: 8,
    likeCount: 1,
    commentCount: 0,
  },
]

describe("ExploreClient", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/explore")
  })

  it("hydrates search and category state from the URL", () => {
    window.history.replaceState(null, "", "/explore?category=roleplay&q=hero")

    render(
      <ExploreClient
        featured={sampleCharacters}
        trending={sampleCharacters}
        all={sampleCharacters}
        likedIds={[]}
        initialCategory="roleplay"
        initialSearchQuery="hero"
      />
    )

    expect(screen.getByRole("searchbox", { name: /search characters/i })).toHaveValue("hero")
    expect(screen.getByRole("button", { name: /roleplay/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("reflects search and category changes in the URL", async () => {
    const user = userEvent.setup()

    render(
      <ExploreClient
        featured={sampleCharacters}
        trending={sampleCharacters}
        all={sampleCharacters}
        likedIds={[]}
      />
    )

    await user.type(screen.getByRole("searchbox", { name: /search characters/i }), "mage")

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search)
      expect(params.get("q")).toBe("mage")
    })

    await user.click(screen.getByRole("button", { name: /fantasy/i }))

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search)
      expect(params.get("category")).toBe("fantasy")
      expect(params.get("q")).toBe("mage")
    })
  })

  it("lets users clear filters after an empty result", async () => {
    const user = userEvent.setup()

    render(
      <ExploreClient
        featured={sampleCharacters}
        trending={sampleCharacters}
        all={sampleCharacters}
        likedIds={[]}
      />
    )

    await user.type(screen.getByRole("searchbox", { name: /search characters/i }), "zzzz")

    expect(await screen.findByRole("button", { name: /clear filters/i })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /clear filters/i }))

    await waitFor(() => {
      expect(screen.getByRole("searchbox", { name: /search characters/i })).toHaveValue("")
      expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument()
      expect(window.location.search).toBe("")
    })
  })
})
