/**
 * The client is built from env on first call and memoised, so every case
 * resets the module registry and the env it reads.
 */
describe("getRedisClient", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("returns null when Upstash is not configured", async () => {
    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBeNull()
  })

  it("exposes the surface next-kit's RedisStore requires", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"

    const { getRedisClient } = await import("@/app/lib/redis")
    const client = getRedisClient() as unknown as Record<string, unknown>

    expect(client).not.toBeNull()
    // `RedisLike` in @gr8monk3ys/next-kit/rate-limit. If any of these stops
    // existing, rate limiting silently degrades to the memory store.
    for (const method of ["incr", "pexpire", "pttl", "del", "get", "set", "ping"]) {
      expect(typeof client[method]).toBe("function")
    }
  })

  it("memoises the client across calls", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"

    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBe(getRedisClient())
  })

  it("treats a url without a token as unconfigured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io"

    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBeNull()
  })

  it("reports unavailable when Upstash is not configured", async () => {
    const { isRedisAvailable } = await import("@/app/lib/redis")
    await expect(isRedisAvailable()).resolves.toBe(false)
  })
})

/**
 * A production fallback to in-memory storage is not a warning, it is an
 * outage: rate limiting and 2FA tokens silently become per-instance, which on
 * serverless is not enforcement. The original incident stood for days because
 * nothing reported it anywhere a person would look.
 */
describe("production fallback reporting", () => {
  const originalEnv = process.env

  /**
   * `NODE_ENV` is typed read-only, so it cannot be assigned directly even
   * though it is an ordinary property at runtime.
   */
  function setNodeEnv(value: string): void {
    Object.defineProperty(process.env, "NODE_ENV", {
      value,
      configurable: true,
      writable: true,
    })
  }

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("reports to Sentry when it falls back in production", async () => {
    const captureMessage = jest.fn()
    jest.doMock("@sentry/nextjs", () => ({ captureMessage }))
    setNodeEnv("production")

    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBeNull()

    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("in-memory"),
      expect.objectContaining({ level: "error" })
    )
  })

  it("stays quiet when it falls back outside production", async () => {
    const captureMessage = jest.fn()
    jest.doMock("@sentry/nextjs", () => ({ captureMessage }))
    setNodeEnv("development")

    const { getRedisClient } = await import("@/app/lib/redis")
    expect(getRedisClient()).toBeNull()

    expect(captureMessage).not.toHaveBeenCalled()
  })

  it("reports once per cold start, not once per call", async () => {
    const captureMessage = jest.fn()
    jest.doMock("@sentry/nextjs", () => ({ captureMessage }))
    setNodeEnv("production")

    const { getRedisClient } = await import("@/app/lib/redis")
    getRedisClient()
    getRedisClient()
    getRedisClient()

    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})
