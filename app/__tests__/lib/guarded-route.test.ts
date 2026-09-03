/**
 * @jest-environment node
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { guard } from "@/app/lib/guarded-route"

const mockGetCurrentUser = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockGetClientIdentifier = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: (...args: unknown[]) => mockGetCsrfTokenFromRequest(...args),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: { child: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  authLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

const USER = { id: "user-1", name: "Nyra" }

function req(
  method = "POST",
  { body, headers }: { body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  return {
    method,
    url: "http://localhost:3000/api/thing",
    headers: new Headers(headers ?? {}),
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON input")
      return body
    },
  } as unknown as NextRequest
}

const allow: { check: jest.Mock } = { check: jest.fn() }

/** Next always passes a context; only dynamic segments put anything in it. */
const routeCtx = <T extends Record<string, string | string[] | undefined>>(params?: T) => ({
  params: Promise.resolve((params ?? {}) as T),
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue(USER)
  mockVerifyCsrfToken.mockReturnValue(true)
  mockGetCsrfTokenFromRequest.mockReturnValue("cookie-token")
  mockGetClientIdentifier.mockReturnValue("1.2.3.4")
  allow.check.mockResolvedValue(true)
})

describe("guard: the happy path", () => {
  it("hands the handler the user, the parsed body and the awaited params", async () => {
    const schema = z.object({ name: z.string().min(1) })
    const handler = jest.fn(async (_ctx: unknown) => NextResponse.json({ ok: true }))

    const route = guard<{ name: string }, { id: string }>({ body: schema }, handler)
    const res = await route(req("POST", { body: { name: "Nova" } }), {
      params: Promise.resolve({ id: "abc" }),
    })

    expect(res.status).toBe(200)
    const ctx = handler.mock.calls[0][0] as unknown as {
      user: typeof USER
      body: { name: string }
      params: { id: string }
    }
    expect(ctx.user).toEqual(USER)
    expect(ctx.body).toEqual({ name: "Nova" })
    expect(ctx.params).toEqual({ id: "abc" })
  })

  it("gives static routes an empty params object rather than undefined", async () => {
    const handler = jest.fn(async (_ctx: unknown) => NextResponse.json({ ok: true }))
    await guard({ csrf: false }, handler)(req("GET"), routeCtx())
    const ctx = handler.mock.calls[0][0] as unknown as { params: unknown }
    expect(ctx.params).toEqual({})
  })
})

describe("guard: ordering", () => {
  /**
   * The order is the contract. Cheapest and most hostile first, so a flood is
   * rejected before it costs a database round trip and a forged request is
   * rejected before its body is read.
   */
  it("checks the limiter before CSRF, and CSRF before auth", async () => {
    allow.check.mockResolvedValue(false)
    mockVerifyCsrfToken.mockReturnValue(false)

    const res = await guard({ limiter: allow as never, csrf: true }, async () =>
      NextResponse.json({})
    )(req(), routeCtx())

    expect(res.status).toBe(429)
    expect(mockVerifyCsrfToken).not.toHaveBeenCalled()
    expect(mockGetCurrentUser).not.toHaveBeenCalled()
  })

  it("rejects a forged request before resolving the user", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await guard({ csrf: true }, async () => NextResponse.json({}))(req(), routeCtx())

    expect(res.status).toBe(403)
    expect(mockGetCurrentUser).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated request before reading the body", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const json = jest.fn()
    const request = req("POST", { body: {} })
    ;(request as unknown as { json: unknown }).json = json

    const res = await guard({ body: z.object({}) }, async () => NextResponse.json({}))(
      request,
      routeCtx()
    )

    expect(res.status).toBe(401)
    expect(json).not.toHaveBeenCalled()
  })
})

describe("guard: rate limiting", () => {
  it("returns 429 with a Retry-After header", async () => {
    allow.check.mockResolvedValue(false)
    const res = await guard({ limiter: allow as never }, async () => NextResponse.json({}))(
      req(),
      routeCtx()
    )

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("60")
  })

  it("derives the identifier through getClientIdentifier, never by hand", async () => {
    await guard({ limiter: allow as never }, async () => NextResponse.json({}))(req(), routeCtx())
    expect(mockGetClientIdentifier).toHaveBeenCalledTimes(1)
    expect(allow.check).toHaveBeenCalledWith("1.2.3.4")
  })

  it("skips the limiter when none is declared", async () => {
    await guard({}, async () => NextResponse.json({}))(req(), routeCtx())
    expect(allow.check).not.toHaveBeenCalled()
  })
})

describe("guard: CSRF defaults", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("verifies by default on %s", async (method) => {
    await guard({}, async () => NextResponse.json({}))(req(method), routeCtx())
    expect(mockVerifyCsrfToken).toHaveBeenCalledTimes(1)
  })

  it.each(["GET", "HEAD"])("does not verify by default on %s", async (method) => {
    await guard({}, async () => NextResponse.json({}))(req(method), routeCtx())
    expect(mockVerifyCsrfToken).not.toHaveBeenCalled()
  })

  it("honours an explicit false on a mutating method", async () => {
    await guard({ csrf: false }, async () => NextResponse.json({}))(req("POST"), routeCtx())
    expect(mockVerifyCsrfToken).not.toHaveBeenCalled()
  })

  it("honours an explicit true on a read method", async () => {
    await guard({ csrf: true }, async () => NextResponse.json({}))(req("GET"), routeCtx())
    expect(mockVerifyCsrfToken).toHaveBeenCalledTimes(1)
  })

  it("compares the header against the cookie", async () => {
    await guard({}, async () => NextResponse.json({}))(
      req("POST", { headers: { "X-CSRF-Token": "header-token" } }),
      routeCtx()
    )
    expect(mockVerifyCsrfToken).toHaveBeenCalledWith("header-token", "cookie-token")
  })
})

describe("guard: auth modes", () => {
  it("401s when required and absent", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await guard({ csrf: false }, async () => NextResponse.json({}))(req(), routeCtx())
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("passes null through when optional", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const handler = jest.fn(async (_ctx: unknown) => NextResponse.json({ ok: true }))
    const res = await guard({ auth: "optional", csrf: false }, handler)(req(), routeCtx())

    expect(res.status).toBe(200)
    expect((handler.mock.calls[0][0] as unknown as { user: unknown }).user).toBeNull()
  })

  it("never looks the user up when auth is none", async () => {
    await guard({ auth: "none", csrf: false }, async () => NextResponse.json({}))(req(), routeCtx())
    expect(mockGetCurrentUser).not.toHaveBeenCalled()
  })
})

describe("guard: body parsing", () => {
  it("400s with the first Zod issue message", async () => {
    const schema = z.object({ name: z.string().min(1, "Tag name is required") })
    const res = await guard({ body: schema, csrf: false }, async () => NextResponse.json({}))(
      req("POST", { body: { name: "" } }),
      routeCtx()
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Tag name is required" })
  })

  it("400s on a malformed body rather than throwing a 500", async () => {
    const res = await guard({ body: z.object({}), csrf: false }, async () => NextResponse.json({}))(
      req("POST"),
      routeCtx()
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" })
  })

  it("leaves the body undefined when no schema is declared", async () => {
    const handler = jest.fn(async (_ctx: unknown) => NextResponse.json({}))
    await guard({ csrf: false }, handler)(req("POST", { body: { anything: true } }), routeCtx())
    expect((handler.mock.calls[0][0] as unknown as { body: unknown }).body).toBeUndefined()
  })
})

describe("guard: failures inside the handler", () => {
  it("turns a thrown error into a logged 500 and leaks nothing", async () => {
    const res = await guard({ csrf: false }, async () => {
      throw new Error("db exploded: postgres://user:pw@host/db")
    })(req(), routeCtx())

    expect(res.status).toBe(500)
    const payload = await res.json()
    expect(payload).toEqual({ error: "Internal server error" })
    expect(JSON.stringify(payload)).not.toContain("postgres")
  })

  it("turns a rejected params promise into a 500 rather than an unhandled rejection", async () => {
    const res = await guard({ csrf: false }, async () => NextResponse.json({}))(req(), {
      params: Promise.reject(new Error("bad params")),
    })
    expect(res.status).toBe(500)
  })
})
