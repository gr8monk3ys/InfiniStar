import { NextResponse, type NextRequest } from "next/server"
import type { ZodType } from "zod"

import { isAuthorizedCronRequest } from "@/app/lib/cron-auth"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import { getClientIdentifier, type IRateLimiter } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

/**
 * The request preamble, behind one interface.
 *
 * Every route module in `app/api` opens with some subset of: derive a client
 * identifier and check a limiter, compare the CSRF header against the cookie,
 * resolve the current user, parse the body with Zod, and close with a
 * catch that logs and returns 500. Roughly a fifth of all route text is that
 * subset, respelled 88 times.
 *
 * Respelling it is not merely repetitive, it is how guards go missing. There
 * is no interface for a route to be absent from, so nothing can detect an
 * omission — which is why eight state-changing routes verify CSRF but have no
 * limiter, two have a limiter but no CSRF, and one derives its identifier from
 * the client-controlled end of `x-forwarded-for`.
 *
 * The seam is the policy object. Callers declare what a route requires; this
 * module owns how each requirement is met, in one place, tested once.
 *
 * ```ts
 * export const POST = guard(
 *   { csrf: true, limiter: tagLimiter, body: createTagSchema },
 *   async ({ user, body }) => NextResponse.json(await createTag(user.id, body))
 * )
 * ```
 *
 * Three earlier attempts at this seam exist in the codebase and were all
 * abandoned: `withRateLimit` (zero production callers, mocked by six test
 * files), `withCsrfProtection` (three callers against sixty-one inline), and
 * `errors.ts` (zero importers, since deleted). Each covered one band of the
 * preamble, which is why none of them stuck: a route still had to hand-roll
 * the rest, so hand-rolling all of it stayed the path of least resistance.
 */

/** The user shape routes receive. Mirrors `getCurrentUser`, sans password hash. */
export type GuardedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

export interface RoutePolicy<TBody, TQuery = undefined> {
  /**
   * `"required"` (the default) resolves the user and 401s when absent.
   * `"optional"` resolves the user and passes `null` through, for routes that
   * serve both signed-in and anonymous callers.
   * `"none"` skips the lookup entirely — use it for webhooks and other
   * signature-verified entry points, never as a shortcut.
   * `"cron"` verifies the `Authorization` header against `CRON_SECRET` with a
   * timing-safe compare and answers 401 otherwise. There is no user.
   */
  auth?: "required" | "optional" | "none" | "cron"
  /**
   * Verify the double-submit CSRF token. Defaults to `true` for POST, PUT,
   * PATCH and DELETE and `false` otherwise, which is the rule the inline code
   * applied by hand. Set it explicitly to `false` only where the caller cannot
   * hold a cookie, and say why at the call site.
   */
  csrf?: boolean
  /** Rate limiter for this endpoint. Omit only where a route is genuinely unlimited. */
  limiter?: IRateLimiter
  /** Zod schema for the JSON body. When present, the parsed value reaches the handler. */
  body?: ZodType<TBody>
  /**
   * Zod schema for the query string, parsed from `searchParams`. The sibling
   * `body` never had: roughly twenty GETs hand-parse `new URL(request.url)`,
   * including `moderation/reports`, which does it *inside* an already-migrated
   * guard because there was no slot for it.
   */
  query?: ZodType<TQuery>
  /**
   * Hand the handler the raw request text instead of parsing JSON.
   *
   * Signature-verified entry points need the exact bytes: Stripe verifies
   * against `request.text()` and svix against the raw payload. `auth: "none"`
   * is offered for precisely these, and the body slot then made them unusable,
   * so every webhook stayed hand-rolled.
   */
  rawBody?: boolean
  /**
   * A second limiter, keyed on the authenticated user rather than the client
   * identifier, run after auth.
   *
   * The fixed order below runs the endpoint limiter first, and that ordering is
   * a security property, not an accident — an unauthenticated flood is rejected
   * before it costs a database round trip. But an identity-keyed limit cannot
   * run before the identity is known, so it gets its own stage rather than
   * displacing the first. `transcribe` and `profile` both reach past the guard
   * today for exactly this.
   */
  userLimiter?: IRateLimiter
}

export interface GuardedContext<TBody, TParams, TQuery = undefined> {
  request: NextRequest
  /** Non-null unless `auth` is `"optional"` or `"none"`. */
  user: GuardedUser
  /** The parsed body when a schema was declared, else `undefined`. */
  body: TBody
  /** The parsed query string when a schema was declared, else `undefined`. */
  query: TQuery
  /** The raw request text when `rawBody` was declared, else `undefined`. */
  rawBody: string
  /** Route params, already awaited. `{}` for static routes. */
  params: TParams
}

/**
 * Next's own route-handler contract for the second argument, which its
 * generated types check structurally: exactly `{ params: Promise<...> }`, and
 * required even on static routes. Typed to match, then guarded at runtime
 * because Next only actually passes it on dynamic segments.
 */
type RouteContext<TParams> = { params: Promise<TParams> }

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": "60" } }
  )
}

function invalidCsrf(): NextResponse {
  return NextResponse.json(
    { error: "Invalid CSRF token", code: "CSRF_TOKEN_INVALID" },
    { status: 403 }
  )
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

/**
 * Wraps a route handler in the declared policy.
 *
 * Order is deliberate and is the order the inline code already used: limiter,
 * then CSRF, then auth, then body. Cheapest and most hostile first, so an
 * unauthenticated flood is rejected before it costs a database round trip, and
 * a forged request is rejected before its body is read.
 */
export function guard<
  TBody = undefined,
  TParams extends Record<string, string | string[] | undefined> = Record<
    string,
    string | string[] | undefined
  >,
  TQuery = undefined,
>(
  policy: RoutePolicy<TBody, TQuery>,
  handler: (context: GuardedContext<TBody, TParams, TQuery>) => Promise<Response>
): (request: NextRequest, context: RouteContext<TParams>) => Promise<Response> {
  return async (request: NextRequest, context: RouteContext<TParams>): Promise<Response> => {
    try {
      if (policy.limiter) {
        const allowed = await policy.limiter.check(getClientIdentifier(request))
        if (!allowed) return tooManyRequests()
      }

      const csrfRequired = policy.csrf ?? MUTATING_METHODS.has(request.method)
      if (csrfRequired) {
        const headerToken = request.headers.get("X-CSRF-Token")
        const cookieToken = getCsrfTokenFromRequest(request)
        if (!verifyCsrfToken(headerToken, cookieToken)) return invalidCsrf()
      }

      const authMode = policy.auth ?? "required"

      // Four cron routes respelled this, and the fourth diverged: it answered
      // 500 when CRON_SECRET was unset where the others fell through to 401,
      // telling an unauthenticated caller something about the configuration.
      // `cron-auth.ts` keeps the timing-safe compare; this owns the response.
      if (authMode === "cron") {
        if (
          !isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)
        ) {
          apiLogger.warn(
            { path: new URL(request.url).pathname },
            "Unauthorized cron request attempt"
          )
          return unauthorized()
        }
      }

      let user: GuardedUser | null = null
      if (authMode !== "none" && authMode !== "cron") {
        user = await getCurrentUser()
        if (!user && authMode === "required") return unauthorized()
      }

      // Second stage, keyed on the identity rather than the client. It cannot
      // run before auth, which is why it is a separate stage rather than a
      // replacement for the first.
      if (policy.userLimiter && user) {
        const allowed = await policy.userLimiter.check(user.id)
        if (!allowed) return tooManyRequests()
      }

      let rawBody = undefined as unknown as string
      if (policy.rawBody) {
        rawBody = await request.text()
      }

      let query = undefined as TQuery
      if (policy.query) {
        const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries())
        const parsed = policy.query.safeParse(searchParams)
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
        }
        query = parsed.data
      }

      let body = undefined as TBody
      if (policy.body) {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
        }
        const parsed = policy.body.safeParse(raw)
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
        }
        body = parsed.data
      }

      // `context` is typed as required to satisfy Next's generated route types,
      // but Next only actually passes it on dynamic segments. Await optionally
      // and default, rather than testing the promise for truthiness.
      const params = ((await context?.params) ?? {}) as TParams

      return await handler({
        request,
        // Non-null by construction when auth is "required"; the cast keeps the
        // common case free of `user!` at every call site.
        user: user as GuardedUser,
        body,
        query,
        rawBody,
        params,
      })
    } catch (error: unknown) {
      apiLogger.error(
        { err: error, method: request.method, path: new URL(request.url).pathname },
        "Unhandled error in guarded route"
      )
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}
