/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetCurrentUser = jest.fn()
const mockCharacterFindUnique = jest.fn()
const mockLikeFindUnique = jest.fn()
const mockRateLimitCheck = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetCurrentUser(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    character: { findUnique: (...args: unknown[]) => mockCharacterFindUnique(...args) },
    characterLike: { findUnique: (...args: unknown[]) => mockLikeFindUnique(...args) },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: (...args: unknown[]) => mockRateLimitCheck(...args) },
  getClientIdentifier: () => "127.0.0.1",
}))

jest.mock("@/app/lib/logger", () => ({
  apiLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

const characterId = "22222222-2222-4222-8222-222222222222"
const userId = "11111111-1111-4111-8111-111111111111"

function call(
  GET: (req: NextRequest, ctx: { params: Promise<{ characterId: string }> }) => Promise<Response>
) {
  return GET(new NextRequest(`http://localhost:3000/api/characters/${characterId}/like`), {
    params: Promise.resolve({ characterId }),
  })
}

// The public character page is cached, so its HTML cannot say "liked"; the
// button asks here after hydration. Signed-out viewers must get a safe answer.
describe("GET /api/characters/[characterId]/like", () => {
  let GET: Parameters<typeof call>[0]

  beforeAll(async () => {
    GET = (await import("@/app/api/characters/[characterId]/like/route")).GET
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimitCheck.mockResolvedValue(true)
    mockCharacterFindUnique.mockResolvedValue({
      id: characterId,
      isPublic: true,
      isNsfw: false,
      likeCount: 7,
    })
  })

  it("answers liked=false with the count for a signed-out viewer", async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const response = await call(GET)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ liked: false, likeCount: 7 })
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(mockLikeFindUnique).not.toHaveBeenCalled()
  })

  it("answers the viewer's own like row when signed in", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: userId })
    mockLikeFindUnique.mockResolvedValue({ userId })

    const body = await (await call(GET)).json()

    expect(body).toEqual({ liked: true, likeCount: 7 })
    expect(mockLikeFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_characterId: { userId, characterId } },
      })
    )
  })

  it("refuses a mature character to a viewer without the preference", async () => {
    mockCharacterFindUnique.mockResolvedValue({
      id: characterId,
      isPublic: true,
      isNsfw: true,
      likeCount: 1,
    })
    mockGetCurrentUser.mockResolvedValue({ id: userId, isAdult: false, nsfwEnabled: false })

    expect((await call(GET)).status).toBe(403)
  })

  it("404s a private or missing character", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    mockCharacterFindUnique.mockResolvedValue({ id: characterId, isPublic: false })
    expect((await call(GET)).status).toBe(404)

    mockCharacterFindUnique.mockResolvedValue(null)
    expect((await call(GET)).status).toBe(404)
  })
})
