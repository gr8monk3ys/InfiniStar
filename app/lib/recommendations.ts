const ONE_DAY_MS = 24 * 60 * 60 * 1000

export interface RecommendationCharacter {
  id: string
  category: string
  createdById: string
  usageCount: number
  likeCount: number
  featured?: boolean
  createdAt: Date
  lastUsedAt?: Date | null
}

export interface RecommendationSignals {
  likedCharacterIds: Set<string>
  categoryAffinity: Map<string, number>
  creatorAffinity: Map<string, number>
  recentlyUsedCharacterIds: Set<string>
}

interface CharacterPreferenceInput {
  id: string
  category: string
  createdById: string
  weight: number
}

function createEmptyMap(): Map<string, number> {
  return new Map<string, number>()
}

function incrementScore(map: Map<string, number>, key: string, value = 1): void {
  map.set(key, (map.get(key) || 0) + value)
}

export function createRecommendationSignals(
  likedCharacters: CharacterPreferenceInput[],
  interactedCharacters: CharacterPreferenceInput[]
): RecommendationSignals {
  const likedCharacterIds = new Set(likedCharacters.map((character) => character.id))
  const categoryAffinity = createEmptyMap()
  const creatorAffinity = createEmptyMap()
  const recentlyUsedCharacterIds = new Set<string>()

  likedCharacters.forEach((character) => {
    incrementScore(categoryAffinity, character.category, character.weight * 2)
    incrementScore(creatorAffinity, character.createdById, character.weight * 2)
  })

  interactedCharacters.forEach((character) => {
    incrementScore(categoryAffinity, character.category, character.weight)
    incrementScore(creatorAffinity, character.createdById, character.weight)
    recentlyUsedCharacterIds.add(character.id)
  })

  return {
    likedCharacterIds,
    categoryAffinity,
    creatorAffinity,
    recentlyUsedCharacterIds,
  }
}

export async function getRecommendationSignalsForUser(
  userId: string
): Promise<RecommendationSignals> {
  const prisma = (await import("@/app/lib/prismadb")).default

  const [likes, recentConversations] = await Promise.all([
    prisma.characterLike.findMany({
      where: { userId },
      select: {
        character: {
          select: {
            id: true,
            category: true,
            createdById: true,
          },
        },
      },
      take: 80,
    }),
    prisma.conversation.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
        characterId: {
          not: null,
        },
      },
      select: {
        lastMessageAt: true,
        character: {
          select: {
            id: true,
            category: true,
            createdById: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      take: 100,
    }),
  ])

  const likedCharacters: CharacterPreferenceInput[] = likes.flatMap(({ character }) =>
    character
      ? [
          {
            id: character.id,
            category: character.category,
            createdById: character.createdById,
            weight: 1,
          },
        ]
      : []
  )

  const now = Date.now()
  const interactedCharacters: CharacterPreferenceInput[] = recentConversations.flatMap(
    (conversation) => {
      if (!conversation.character) {
        return []
      }
      const ageInDays = Math.max(
        0,
        (now - new Date(conversation.lastMessageAt).getTime()) / ONE_DAY_MS
      )
      const recencyWeight = Math.max(0.25, 1.4 - ageInDays / 30)

      return [
        {
          id: conversation.character.id,
          category: conversation.character.category,
          createdById: conversation.character.createdById,
          weight: recencyWeight,
        },
      ]
    }
  )

  return createRecommendationSignals(likedCharacters, interactedCharacters)
}

function scoreCharacter(
  character: RecommendationCharacter,
  signals: RecommendationSignals,
  now: number
): number {
  const ageInDays = Math.max(0, (now - new Date(character.createdAt).getTime()) / ONE_DAY_MS)
  const freshnessScore = Math.max(0, 10 - ageInDays / 4)
  const popularityScore =
    Math.log10(Math.max(1, character.usageCount) + 1) * 22 +
    Math.log10(Math.max(1, character.likeCount) + 1) * 16
  const featuredScore = character.featured ? 8 : 0
  const categoryScore = (signals.categoryAffinity.get(character.category) || 0) * 5
  const creatorScore = (signals.creatorAffinity.get(character.createdById) || 0) * 3
  const recencyBoost = signals.recentlyUsedCharacterIds.has(character.id) ? 4 : 0
  const diversificationPenalty = signals.likedCharacterIds.has(character.id) ? -6 : 0

  return (
    popularityScore +
    freshnessScore +
    featuredScore +
    categoryScore +
    creatorScore +
    recencyBoost +
    diversificationPenalty
  )
}

export function rankCharactersForUser<T extends RecommendationCharacter>(
  characters: T[],
  signals: RecommendationSignals
): T[] {
  // Score each character once, not once per comparison: the comparator runs
  // O(n log n) times. One clock reading also keeps the comparator consistent —
  // a score that drifted with `Date.now()` between comparisons is not a valid
  // sort key.
  const now = Date.now()
  const ranked = characters.map((character) => ({
    character,
    score: scoreCharacter(character, signals, now),
    createdAt: new Date(character.createdAt).getTime(),
  }))

  ranked.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)

  return ranked.map((entry) => entry.character)
}
