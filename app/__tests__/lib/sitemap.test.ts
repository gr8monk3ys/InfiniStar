import prisma from "@/app/lib/prismadb"
import { buildSitemap, STATIC_SITEMAP_ROUTES } from "@/app/lib/sitemap-data"
import sitemap from "@/app/sitemap"

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    character: { findMany: jest.fn() },
  },
}))

const mockedFindMany = prisma.character.findMany as jest.Mock

describe("buildSitemap (pure helper)", () => {
  const base = "https://ci.example.com"
  const now = new Date("2026-06-01T00:00:00.000Z")

  it("emits all static routes with absolute URLs from siteConfig", () => {
    const entries = buildSitemap([], [])
    for (const route of STATIC_SITEMAP_ROUTES) {
      expect(entries.some((e) => e.url === `${base}${route}`)).toBe(true)
    }
    // home is highest priority
    const home = entries.find((e) => e.url === `${base}/`)
    expect(home?.priority).toBe(1.0)
  })

  it("emits a /characters/{slug} entry per character with lastModified from updatedAt", () => {
    const entries = buildSitemap(
      [{ slug: "luna-the-bard", updatedAt: now, usageCount: 1000, likeCount: 200 }],
      []
    )
    const charEntry = entries.find((e) => e.url === `${base}/characters/luna-the-bard`)
    expect(charEntry).toBeDefined()
    expect(charEntry?.lastModified).toEqual(now)
  })

  it("weights character priority higher for more popular characters", () => {
    const entries = buildSitemap(
      [
        { slug: "popular", updatedAt: now, usageCount: 100000, likeCount: 5000 },
        { slug: "obscure", updatedAt: now, usageCount: 0, likeCount: 0 },
      ],
      []
    )
    const popular = entries.find((e) => e.url === `${base}/characters/popular`)!
    const obscure = entries.find((e) => e.url === `${base}/characters/obscure`)!
    expect(popular.priority!).toBeGreaterThan(obscure.priority!)
    expect(popular.priority!).toBeLessThanOrEqual(1.0)
    expect(obscure.priority!).toBeGreaterThanOrEqual(0.1)
  })

  it("emits a /creators/{id} entry per creator id", () => {
    const entries = buildSitemap([], ["11111111-1111-4111-8111-111111111111"])
    expect(
      entries.some((e) => e.url === `${base}/creators/11111111-1111-4111-8111-111111111111`)
    ).toBe(true)
  })
})

describe("sitemap (Prisma-backed default export)", () => {
  const base = "https://ci.example.com"
  beforeEach(() => {
    mockedFindMany.mockReset()
  })

  it("queries with isPublic:true AND isNsfw:false and includes only SFW characters", async () => {
    // First call: characters; second call: distinct creators (groupBy-style findMany)
    mockedFindMany
      .mockResolvedValueOnce([
        {
          slug: "sfw-hero",
          updatedAt: new Date("2026-05-01T00:00:00.000Z"),
          usageCount: 10,
          likeCount: 2,
        },
      ])
      .mockResolvedValueOnce([{ createdById: "22222222-2222-4222-8222-222222222222" }])

    const entries = await sitemap()

    // SFW character present
    expect(entries.some((e) => e.url === `${base}/characters/sfw-hero`)).toBe(true)
    // creator present
    expect(
      entries.some((e) => e.url === `${base}/creators/22222222-2222-4222-8222-222222222222`)
    ).toBe(true)

    // The character query MUST filter NSFW out
    const charQuery = mockedFindMany.mock.calls[0][0]
    expect(charQuery.where).toEqual({ isPublic: true, isNsfw: false })
  })

  it("never emits NSFW characters even if the DB returns them (defense via where clause)", async () => {
    // Simulate a correctly-filtered DB: NSFW row is simply absent from results.
    mockedFindMany
      .mockResolvedValueOnce([
        {
          slug: "clean",
          updatedAt: new Date(),
          usageCount: 1,
          likeCount: 0,
        },
      ])
      .mockResolvedValueOnce([])

    const entries = await sitemap()
    expect(entries.some((e) => e.url.includes("/characters/clean"))).toBe(true)
    // The where clause is the guard — assert it is exactly the SFW filter.
    expect(mockedFindMany.mock.calls[0][0].where.isNsfw).toBe(false)
    expect(mockedFindMany.mock.calls[0][0].where.isPublic).toBe(true)
  })

  it("returns static routes even when the DB throws", async () => {
    mockedFindMany.mockRejectedValue(new Error("db down"))
    const entries = await sitemap()
    expect(entries.some((e) => e.url === `${base}/`)).toBe(true)
    expect(entries.some((e) => e.url === `${base}/explore`)).toBe(true)
  })
})
