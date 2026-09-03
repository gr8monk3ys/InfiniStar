import { clear2FAToken, get2FAToken, store2FAToken } from "@/app/lib/two-factor-tokens"

/**
 * `two-factor-tokens` is one of three consumers of `getRedisClient()`, and the
 * only one that had a deliberate, logged fallback. These tests pin that
 * fallback, because the degraded path is the one nobody exercises by hand:
 * Redis is optional (`REDIS_URL` is not required in `env.mjs`), so on a
 * single-instance deploy the in-memory store IS the store.
 */

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
}

let redisAvailable = true

jest.mock("@/app/lib/redis", () => ({
  getRedisClient: () => (redisAvailable ? mockRedis : null),
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: { child: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) },
  authLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

describe("2FA token store", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redisAvailable = true
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue("OK")
    mockRedis.del.mockResolvedValue(1)
  })

  describe("with Redis available", () => {
    it("stores and reads through Redis", async () => {
      await store2FAToken("User@Example.com", "123456")
      expect(mockRedis.set).toHaveBeenCalledTimes(1)

      mockRedis.get.mockResolvedValue(JSON.stringify({ token: "123456" }))
      await expect(get2FAToken("user@example.com")).resolves.toBe("123456")
    })

    it("normalises the email so case cannot split the key", async () => {
      await store2FAToken("MiXeD@Example.com", "111111")
      const key = mockRedis.set.mock.calls[0][0] as string
      expect(key).toBe(key.toLowerCase())
    })

    it("clears the token", async () => {
      await clear2FAToken("user@example.com")
      expect(mockRedis.del).toHaveBeenCalledTimes(1)
    })
  })

  describe("with Redis absent", () => {
    beforeEach(() => {
      redisAvailable = false
    })

    it("stores and reads through the in-memory store", async () => {
      await store2FAToken("nored@example.com", "222222")
      await expect(get2FAToken("nored@example.com")).resolves.toBe("222222")
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    it("returns null for an unknown email", async () => {
      await expect(get2FAToken("never-seen@example.com")).resolves.toBeNull()
    })

    it("clears the token", async () => {
      await store2FAToken("clearme@example.com", "333333")
      await clear2FAToken("clearme@example.com")
      await expect(get2FAToken("clearme@example.com")).resolves.toBeNull()
    })
  })

  describe("when Redis fails or flaps", () => {
    it("falls back to memory when the write throws", async () => {
      mockRedis.set.mockRejectedValue(new Error("ECONNREFUSED"))
      await store2FAToken("flap@example.com", "444444")

      // The read still finds it, because the write landed in memory.
      mockRedis.get.mockResolvedValue(null)
      await expect(get2FAToken("flap@example.com")).resolves.toBe("444444")
    })

    it("falls back to memory when the read throws", async () => {
      redisAvailable = false
      await store2FAToken("readfail@example.com", "555555")

      redisAvailable = true
      mockRedis.get.mockRejectedValue(new Error("ECONNREFUSED"))
      await expect(get2FAToken("readfail@example.com")).resolves.toBe("555555")
    })

    /**
     * The regression this file was written for. Redis was down when the token
     * was stored, so it went to memory. Redis is back by the time the user
     * submits the code, answers the GET with nothing, and the old code returned
     * null on the spot — stranding the user mid-login with a token that exists.
     */
    it("still finds a memory-stored token once Redis comes back empty", async () => {
      redisAvailable = false
      await store2FAToken("recovered@example.com", "666666")

      redisAvailable = true
      mockRedis.get.mockResolvedValue(null)
      await expect(get2FAToken("recovered@example.com")).resolves.toBe("666666")
    })
  })
})
