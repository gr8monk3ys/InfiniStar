import {
  createRecommendationSignals,
  rankCharactersForUser,
  type RecommendationCharacter,
} from "@/app/lib/recommendations"

describe("recommendations", () => {
  it("boosts characters that match user affinities", () => {
    const signals = createRecommendationSignals(
      [
        { id: "liked-1", category: "fantasy", createdById: "creator-a", weight: 1 },
        { id: "liked-2", category: "fantasy", createdById: "creator-a", weight: 1 },
      ],
      [{ id: "used-1", category: "fantasy", createdById: "creator-a", weight: 1.2 }]
    )

    const now = new Date("2026-02-13T00:00:00.000Z")
    const candidates: RecommendationCharacter[] = [
      {
        id: "char-fantasy",
        category: "fantasy",
        createdById: "creator-a",
        usageCount: 100,
        likeCount: 50,
        createdAt: now,
      },
      {
        id: "char-comedy",
        category: "comedy",
        createdById: "creator-b",
        usageCount: 100,
        likeCount: 50,
        createdAt: now,
      },
    ]

    const ranked = rankCharactersForUser(candidates, signals)
    expect(ranked[0].id).toBe("char-fantasy")
  })

  it("applies diversification penalty for already liked character IDs", () => {
    const signals = createRecommendationSignals(
      [{ id: "same-id", category: "helper", createdById: "creator-x", weight: 1 }],
      []
    )

    const now = new Date("2026-02-13T00:00:00.000Z")
    const candidates: RecommendationCharacter[] = [
      {
        id: "same-id",
        category: "helper",
        createdById: "creator-x",
        usageCount: 120,
        likeCount: 60,
        createdAt: now,
      },
      {
        id: "fresh-helper",
        category: "helper",
        createdById: "creator-x",
        usageCount: 119,
        likeCount: 59,
        createdAt: now,
      },
    ]

    const ranked = rankCharactersForUser(candidates, signals)
    expect(ranked[0].id).toBe("fresh-helper")
  })
})
