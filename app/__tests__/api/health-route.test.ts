/**
 * @jest-environment node
 */

import { GET } from "@/app/api/health/route"

/**
 * The health check must agree with the module whose health it reports.
 *
 * It had its own copy of the "is Redis configured" rule and read only the
 * `UPSTASH_*` pair. When `getRedisClient` learned to accept the Vercel KV
 * credentials the platform already supplies, rate limiting started working and
 * this endpoint went on reporting `not_configured` — so the one signal a person
 * would look at to find the outage was itself the thing that was wrong.
 */

const mockQueryRaw = jest.fn()
const mockIsRedisAvailable = jest.fn()

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) },
}))

jest.mock("@/app/lib/redis", () => ({
  ...jest.requireActual("@/app/lib/redis"),
  isRedisAvailable: (...a: unknown[]) => mockIsRedisAvailable(...a),
}))

const ORIGINAL = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  mockQueryRaw.mockResolvedValue([{ "?column?": 1 }])
  mockIsRedisAvailable.mockResolvedValue(true)
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
})

afterAll(() => {
  process.env = ORIGINAL
})

describe("GET /api/health", () => {
  it("reports Redis connected from the Vercel KV credentials", async () => {
    process.env.KV_REST_API_URL = "https://example.kv.vercel-storage.com"
    process.env.KV_REST_API_TOKEN = "kv-token"

    const res = await GET()
    const body = await res.json()

    expect(body.redis).toBe("connected")
    expect(res.status).toBe(200)
  })

  it("reports Redis connected from an explicit Upstash pair", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"

    expect((await (await GET()).json()).redis).toBe("connected")
  })

  it("reports not_configured only when neither pair is present", async () => {
    const body = await (await GET()).json()

    expect(body.redis).toBe("not_configured")
  })

  it("distinguishes configured-but-unreachable from unconfigured", async () => {
    process.env.KV_REST_API_URL = "https://example.kv.vercel-storage.com"
    process.env.KV_REST_API_TOKEN = "kv-token"
    mockIsRedisAvailable.mockResolvedValue(false)

    expect((await (await GET()).json()).redis).toBe("disconnected")
  })

  it("reports the database as disconnected when the query throws", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection refused"))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.database).toBe("disconnected")
  })
})
