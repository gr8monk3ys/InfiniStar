import { render, screen } from "@testing-library/react"

import { ContinueChattingRail } from "@/app/components/characters/ContinueChattingRail"
import type { RecentCharacterChat } from "@/app/actions/getRecentCharacterChats"

/**
 * PRODUCT.md's first principle is "relationships over sessions — every surface
 * should make it easy to return to an existing character". Explore was a wall
 * of strangers whether you had been here five minutes or five months.
 */

function chat(overrides: Partial<RecentCharacterChat> = {}): RecentCharacterChat {
  return {
    conversationId: "11111111-1111-4111-8111-111111111111",
    characterId: "22222222-2222-4222-8222-222222222222",
    name: "Detective Ash Harlow",
    slug: "detective-ash-harlow",
    avatarUrl: "/characters/detective-ash-harlow.webp",
    lastMessageAt: new Date(Date.now() - 4 * 86_400_000),
    messageCount: 61,
    ...overrides,
  }
}

describe("the return rail", () => {
  it("renders nothing at all when there is no history", () => {
    // Every logged-out visitor lands here, so a first impression is unchanged.
    const { container } = render(<ContinueChattingRail chats={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("links straight into the conversation, not the character page", () => {
    // The point is resuming, not re-reading the profile and starting again.
    render(<ContinueChattingRail chats={[chat()]} />)

    expect(screen.getByRole("link", { name: /Detective Ash Harlow/ })).toHaveAttribute(
      "href",
      "/dashboard/conversations/11111111-1111-4111-8111-111111111111"
    )
  })

  it("describes recency the way a person thinks about it", () => {
    render(
      <ContinueChattingRail
        chats={[
          chat({ conversationId: "a", lastMessageAt: new Date(Date.now() - 86_400_000) }),
          chat({ conversationId: "b", lastMessageAt: new Date(Date.now() - 4 * 86_400_000) }),
          chat({ conversationId: "c", lastMessageAt: new Date(Date.now() - 40 * 86_400_000) }),
        ]}
      />
    )

    expect(screen.getByText(/yesterday/)).toBeInTheDocument()
    expect(screen.getByText(/4 days ago/)).toBeInTheDocument()
    expect(screen.getByText(/5 weeks ago/)).toBeInTheDocument()
  })

  it("counts one message without pluralising it", () => {
    render(<ContinueChattingRail chats={[chat({ messageCount: 1 })]} />)

    expect(screen.getByText(/1 message(?!s)/)).toBeInTheDocument()
  })

  it("falls back to the generated portrait when a character has no artwork", () => {
    render(<ContinueChattingRail chats={[chat({ avatarUrl: null, name: "Wren Ashdown" })]} />)

    expect(screen.getByText("W")).toBeInTheDocument()
  })
})
