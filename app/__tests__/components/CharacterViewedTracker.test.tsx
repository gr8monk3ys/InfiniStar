import React from "react"
import { render } from "@testing-library/react"

import { CharacterViewedTracker } from "@/app/components/characters/CharacterViewedTracker"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { capture: jest.fn() },
}))

const posthog = require("posthog-js").default

describe("CharacterViewedTracker", () => {
  beforeEach(() => jest.clearAllMocks())

  it("fires character_viewed exactly once on mount with the expected props", () => {
    render(
      <CharacterViewedTracker
        characterId="char-123"
        slug="aria"
        category="roleplay"
        isNsfw={false}
      />
    )

    expect(posthog.capture).toHaveBeenCalledTimes(1)
    expect(posthog.capture).toHaveBeenCalledWith("character_viewed", {
      characterId: "char-123",
      slug: "aria",
      category: "roleplay",
      isNsfw: false,
    })
  })

  it("renders nothing", () => {
    const { container } = render(
      <CharacterViewedTracker characterId="c" slug="s" category="general" isNsfw={true} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
