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
  {
    body,
    headers,
    search = "",
    text,
  }: {
    body?: unknown
    headers?: Record<string, string>
    search?: string
    text?: string
  } = {}
): NextRequest {
  return {
    method,
    url: `http://localhost:3000/api/thing${search}`,
    headers: new Headers(headers ?? {}),
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON input")
      return body
    },
    text: async () => text ?? "",
  } as unknown as NextRequest
}

const allow: { check: jest.Mock; retryAfterSeconds: number } = {
  check: jest.fn(),
  // Stubs model the real interface: a limiter knows its own window.
  retryAfterSeconds: 60,
}

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

// ---------------------------------------------------------------------------
// The four slots the policy had no word for
//
// ADR-0003 is right that a wrapper per concern does not work, and none of this
// re-litigates it. The claim is the opposite one: the single guard is correct
// and its slots were incomplete, which is why 81 of 89 routes stayed hand-rolled
// and therefore stayed in the state the ADR says nothing can detect an omission
// in.
// ---------------------------------------------------------------------------

describe("guard: query strings", () => {
  const schema = z.object({ status: z.string(), limit: z.string().optional() })

  it("parses searchParams and hands them to the handler", async () => {
    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const route = guard({ query: schema, csrf: false }, handler)

    await route(req("GET", { search: "?status=OPEN&limit=10" }), routeCtx())

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ query: { status: "OPEN", limit: "10" } })
    )
  })

  it("400s on a query that does not match the schema, without running the handler", async () => {
    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const route = guard({ query: schema, csrf: false }, handler)

    const res = await route(req("GET", { search: "?limit=10" }), routeCtx())

    expect(res.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })

  it("leaves query undefined when no schema is declared", async () => {
    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const route = guard({ csrf: false }, handler)

    await route(req("GET", { search: "?status=OPEN" }), routeCtx())

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ query: undefined }))
  })
})

describe("guard: raw bodies", () => {
  /**
   * Signature-verified entry points need the exact bytes. `auth: "none"` was
   * offered for them and the body slot then made it unusable, so every webhook
   * stayed hand-rolled.
   */
  it("hands the handler the unparsed text", async () => {
    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const route = guard({ rawBody: true, auth: "none", csrf: false }, handler)

    await route(req("POST", { text: '{"id":"evt_1"}' }), routeCtx())

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ rawBody: '{"id":"evt_1"}' }))
  })
})

describe("guard: the identity-keyed limiter", () => {
  const userLimiter: { check: jest.Mock; retryAfterSeconds: number } = {
    check: jest.fn(),
    retryAfterSeconds: 60,
  }
  const asLimiter = userLimiter as never

  beforeEach(() => userLimiter.check.mockResolvedValue(true))

  it("keys on the user, not the client identifier", async () => {
    const route = guard({ userLimiter: asLimiter, csrf: false }, async () =>
      NextResponse.json({ ok: true })
    )

    await route(req("POST", { body: {} }), routeCtx())

    expect(userLimiter.check).toHaveBeenCalledWith(USER.id)
  })

  it("429s when the identity limit is exhausted", async () => {
    userLimiter.check.mockResolvedValue(false)
    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const route = guard({ userLimiter: asLimiter, csrf: false }, handler)

    const res = await route(req("POST", { body: {} }), routeCtx())

    expect(res.status).toBe(429)
    expect(handler).not.toHaveBeenCalled()
  })

  /**
   * The ADR's ordering is a security property: the endpoint limiter runs first
   * so an unauthenticated flood is rejected before it costs a database round
   * trip. An identity-keyed limit cannot run before the identity is known, so
   * it is a second stage rather than a replacement for the first.
   */
  it("runs after auth, and after the endpoint limiter", async () => {
    const order: string[] = []
    allow.check.mockImplementation(async () => {
      order.push("endpoint-limiter")
      return true
    })
    mockGetCurrentUser.mockImplementation(async () => {
      order.push("auth")
      return USER
    })
    userLimiter.check.mockImplementation(async () => {
      order.push("user-limiter")
      return true
    })

    const route = guard(
      { limiter: allow as never, userLimiter: asLimiter, csrf: false },
      async () => NextResponse.json({ ok: true })
    )
    await route(req("POST", { body: {} }), routeCtx())

    expect(order).toEqual(["endpoint-limiter", "auth", "user-limiter"])
  })

  it("does not run when there is no user to key on", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const route = guard({ userLimiter: asLimiter, auth: "optional", csrf: false }, async () =>
      NextResponse.json({ ok: true })
    )

    await route(req("POST", { body: {} }), routeCtx())

    expect(userLimiter.check).not.toHaveBeenCalled()
  })
})

describe("guard: cron auth", () => {
  const OLD_SECRET = process.env.CRON_SECRET

  afterEach(() => {
    process.env.CRON_SECRET = OLD_SECRET
  })

  it("admits a request carrying the bearer secret", async () => {
    process.env.CRON_SECRET = "s3cret"
    const handler = jest.fn(async () => NextResponse.json({ ok: true }))
    const route = guard({ auth: "cron" }, handler)

    const res = await route(req("GET", { headers: { authorization: "Bearer s3cret" } }), routeCtx())

    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalled()
  })

  it("401s on a wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret"
    const route = guard({ auth: "cron" }, async () => NextResponse.json({ ok: true }))

    const res = await route(req("GET", { headers: { authorization: "Bearer wrong" } }), routeCtx())

    expect(res.status).toBe(401)
  })

  /**
   * The divergence this replaces: one of the four cron routes answered 500 when
   * CRON_SECRET was unset, where the other three fell through to 401. A 500
   * tells an unauthenticated caller something about the configuration.
   */
  it("401s rather than 500s when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET
    const route = guard({ auth: "cron" }, async () => NextResponse.json({ ok: true }))

    const res = await route(
      req("GET", { headers: { authorization: "Bearer anything" } }),
      routeCtx()
    )

    expect(res.status).toBe(401)
  })

  it("does not resolve a user", async () => {
    process.env.CRON_SECRET = "s3cret"
    const route = guard({ auth: "cron" }, async () => NextResponse.json({ ok: true }))

    await route(req("GET", { headers: { authorization: "Bearer s3cret" } }), routeCtx())

    expect(mockGetCurrentUser).not.toHaveBeenCalled()
  })
})

describe("guard: streaming handlers", () => {
  /**
   * The handler was constrained to `Promise<NextResponse>`, so the four routes
   * that return `new Response(stream)` — chat-stream, regenerate, the Clerk
   * proxy and the Clerk webhook — were type-excluded from the guard entirely.
   */
  it("accepts a handler that returns a plain Response", async () => {
    const route = guard({ csrf: false }, async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: hi\n\n"))
          controller.close()
        },
      })
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } })
    })

    const res = await route(req("GET"), routeCtx())

    expect(res.headers.get("Content-Type")).toBe("text/event-stream")
    expect(await res.text()).toContain("data: hi")
  })
})
