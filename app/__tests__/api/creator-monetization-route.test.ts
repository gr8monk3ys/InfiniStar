/**
 * @jest-environment node
 */

/**
 * API Route Tests: Creator Monetization — Tips and Subscriptions
 *
 * Tests:
 *   POST /api/creators/[creatorId]/tips         — create a tip checkout session
 *   GET  /api/creators/[creatorId]/subscription — get current subscription
 *   POST /api/creators/[creatorId]/subscription — start/upsert a subscription
 *   DELETE /api/creators/[creatorId]/subscription — cancel a subscription
 *
 * Both tip and subscription routes:
 *   - require an authenticated current user
 *   - apply rate limiting (creatorPaymentLimiter)
 *   - require CSRF token on mutating methods
 *   - resolve the current user through the shared auth helper
 *   - look up the creator via prisma.user.findUnique({ id: creatorId })
 *   - create a Stripe checkout session
 *   - persist tip / subscription record to the database
 */

import { NextRequest } from "next/server"

// ------------------------------------------------------------------
// Mock declarations
// ------------------------------------------------------------------

const mockAuth = jest.fn()
const mockGetCurrentUser = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockUserFindUnique = jest.fn()
const mockUserUpdate = jest.fn()
const mockCreatorTipCreate = jest.fn()
const mockCreatorSubscriptionFindUnique = jest.fn()
const mockCreatorSubscriptionUpsert = jest.fn()
const mockCreatorSubscriptionUpdate = jest.fn()
const mockStripeCustomersCreate = jest.fn()
const mockStripeCheckoutSessionsCreate = jest.fn()
const mockStripeSubscriptionsUpdate = jest.fn()
const mockCreatorPaymentLimiterCheck = jest.fn()
const mockGetClientIdentifier = jest.fn()
const mockIsValidTipAmount = jest.fn()
const mockIsValidSubscriptionPlan = jest.fn()

jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}))

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetCurrentUser(...args),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: (...args: unknown[]) => mockGetCsrfTokenFromRequest(...args),
}))

// Mock the full rate-limit module — all limiters not under test return true by default.
// Including all exported names prevents ESM static import validation errors when
// this test file runs alongside tests that import shareLimiter / shareJoinLimiter.
jest.mock("@/app/lib/rate-limit", () => {
  const passthrough = { check: () => true, reset: () => {}, cleanup: () => {} }
  return {
    apiLimiter: passthrough,
    authLimiter: passthrough,
    aiChatLimiter: passthrough,
    aiTranscribeLimiter: passthrough,
    accountDeletionLimiter: passthrough,
    twoFactorLimiter: passthrough,
    tagLimiter: passthrough,
    memoryLimiter: passthrough,
    memoryExtractLimiter: passthrough,
    templateLimiter: passthrough,
    shareLimiter: passthrough,
    shareJoinLimiter: passthrough,
    csrfLimiter: passthrough,
    creatorPaymentLimiter: {
      check: (...args: unknown[]) => mockCreatorPaymentLimiterCheck(...args),
      reset: () => {},
      cleanup: () => {},
    },
    getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
    withRateLimit: () => {},
    createRateLimiter: () => passthrough,
  }
})

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    creatorTip: {
      create: (...args: unknown[]) => mockCreatorTipCreate(...args),
    },
    creatorSubscription: {
      findUnique: (...args: unknown[]) => mockCreatorSubscriptionFindUnique(...args),
      upsert: (...args: unknown[]) => mockCreatorSubscriptionUpsert(...args),
      update: (...args: unknown[]) => mockCreatorSubscriptionUpdate(...args),
    },
  },
}))

jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    customers: {
      create: (...args: unknown[]) => mockStripeCustomersCreate(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeCheckoutSessionsCreate(...args),
      },
    },
    subscriptions: {
      update: (...args: unknown[]) => mockStripeSubscriptionsUpdate(...args),
    },
  },
}))

jest.mock("@/app/lib/creator-monetization", () => ({
  isValidTipAmount: (...args: unknown[]) => mockIsValidTipAmount(...args),
  isValidSubscriptionPlan: (...args: unknown[]) => mockIsValidSubscriptionPlan(...args),
}))

jest.mock("@/app/lib/sanitize", () => ({
  sanitizePlainText: (v: string) => v,
}))

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const SUPPORTER: {
  id: string
  email: string
  name: string
  stripeCustomerId: string | null
} = {
  id: "supporter-db-1",
  email: "supporter@example.com",
  name: "Alice Supporter",
  stripeCustomerId: null,
}

const CREATOR = {
  id: "creator-db-1",
  name: "Bob Creator",
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeTipRequest(creatorId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/creators/${creatorId}/tips`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
    body: JSON.stringify(body),
  })
}

function makeSubRequest(
  creatorId: string,
  method: "POST" | "DELETE" | "GET",
  body?: unknown
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/creators/${creatorId}/subscription`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

// ------------------------------------------------------------------
// Helpers — reset the user findUnique mock to a known state each test
// ------------------------------------------------------------------

/**
 * Sets up the creator lookup for the tips route. The current user now comes
 * from the shared auth helper, so prisma only resolves the creator here.
 */
function setupUserMocksForTip(
  currentUser: typeof SUPPORTER | null = SUPPORTER,
  creator: typeof CREATOR | null = CREATOR
) {
  mockGetCurrentUser.mockResolvedValue(currentUser)
  mockUserFindUnique.mockReset()
  mockUserFindUnique.mockResolvedValueOnce(creator)
}

function setupUserMocksForSub(
  currentUser: typeof SUPPORTER | null = SUPPORTER,
  creator: typeof CREATOR | null = CREATOR
) {
  mockGetCurrentUser.mockResolvedValue(currentUser ? { id: currentUser.id } : null)
  mockUserFindUnique.mockReset()
  mockUserFindUnique.mockResolvedValueOnce(currentUser).mockResolvedValueOnce(creator)
}

// ------------------------------------------------------------------
// Tests — Tips
// ------------------------------------------------------------------

describe("POST /api/creators/[creatorId]/tips", () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ creatorId: string }> }) => Promise<Response>

  beforeAll(async () => {
    const mod = await import("@/app/api/creators/[creatorId]/tips/route")
    POST = mod.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
    // Also reset the mock queue (clearAllMocks clears call history but
    // not queued Once values in some runtimes — mockReset is called
    // inside setupUserMocks* per-test, but we reset other mocks here)
    mockUserUpdate.mockReset()
    mockCreatorTipCreate.mockReset()
    mockStripeCustomersCreate.mockReset()
    mockStripeCheckoutSessionsCreate.mockReset()

    mockGetCurrentUser.mockResolvedValue(SUPPORTER)
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    mockCreatorPaymentLimiterCheck.mockReturnValue(true)
    mockGetClientIdentifier.mockReturnValue("127.0.0.1")
    mockIsValidTipAmount.mockReturnValue(true)
    mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new" })
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/session_tip",
    })
    mockCreatorTipCreate.mockResolvedValue({
      id: "tip-1",
      supporterId: SUPPORTER.id,
      creatorId: CREATOR.id,
      amountCents: 500,
      status: "PENDING",
    })
    mockUserUpdate.mockResolvedValue({})
    // Default: supporter + creator for normal happy-path tests
    setupUserMocksForTip()
  })

  async function callTip(creatorId: string, body: unknown) {
    return POST(makeTipRequest(creatorId, body), {
      params: Promise.resolve({ creatorId }),
    })
  }

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    mockUserFindUnique.mockReset()
    const res = await callTip(CREATOR.id, { amountCents: 500 })
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockCreatorPaymentLimiterCheck.mockReturnValue(false)
    const res = await callTip(CREATOR.id, { amountCents: 500 })
    expect(res.status).toBe(429)
  })

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await callTip(CREATOR.id, { amountCents: 500 })
    expect(res.status).toBe(403)
  })

  it("returns 404 when creator is not found", async () => {
    setupUserMocksForTip(SUPPORTER, null)
    const res = await callTip("nonexistent-creator", { amountCents: 500 })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toMatch(/creator not found/i)
  })

  it("returns 400 when user tries to tip themselves", async () => {
    setupUserMocksForTip(SUPPORTER, { ...CREATOR, id: SUPPORTER.id })
    const res = await callTip(SUPPORTER.id, { amountCents: 500 })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/cannot tip yourself/i)
  })

  it("returns 400 for missing amountCents in request body", async () => {
    const res = await callTip(CREATOR.id, { note: "Great work" })
    expect(res.status).toBe(400)
  })

  it("returns 400 for an invalid (unsupported) tip amount", async () => {
    mockIsValidTipAmount.mockReturnValue(false)
    const res = await callTip(CREATOR.id, { amountCents: 1 })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/unsupported tip amount/i)
  })

  it("creates a Stripe customer when supporter has no stripeCustomerId", async () => {
    // SUPPORTER already has stripeCustomerId: null (set in fixture)
    setupUserMocksForTip(SUPPORTER, CREATOR)
    const res = await callTip(CREATOR.id, { amountCents: 500 })
    expect(res.status).toBe(201)
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: SUPPORTER.email })
    )
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripeCustomerId: "cus_new" } })
    )
  })

  it("reuses existing Stripe customer and does not call customers.create", async () => {
    setupUserMocksForTip({ ...SUPPORTER, stripeCustomerId: "cus_existing" }, CREATOR)
    const res = await callTip(CREATOR.id, { amountCents: 500 })
    expect(res.status).toBe(201)
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled()
  })

  it("creates a tip checkout session with payment mode and correct amount", async () => {
    setupUserMocksForTip()
    await callTip(CREATOR.id, { amountCents: 500 })
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 500 }),
          }),
        ],
      })
    )
  })

  it("persists the tip record and returns 201 with the checkout url", async () => {
    setupUserMocksForTip()
    const res = await callTip(CREATOR.id, { amountCents: 500 })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.tip).toBeDefined()
    expect(data.url).toBe("https://checkout.stripe.com/session_tip")
    expect(mockCreatorTipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supporterId: SUPPORTER.id,
          creatorId: CREATOR.id,
          amountCents: 500,
          status: "PENDING",
        }),
      })
    )
  })

  // NOTE: The tips route does not have a global try/catch, so Stripe errors
  // propagate as unhandled rejections rather than HTTP 500 responses in the
  // test environment. A 500 test is intentionally omitted here; adding a
  // try/catch wrapper to the route is tracked as a hardening task.
})

// ------------------------------------------------------------------
// Tests — Creator Subscriptions
// ------------------------------------------------------------------

describe("POST /api/creators/[creatorId]/subscription", () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ creatorId: string }> }) => Promise<Response>

  // Valid plan that satisfies isValidSubscriptionPlan (mocked to return true)
  const VALID_PLAN_BODY = {
    tierName: "Supporter",
    amountCents: 900,
    interval: "MONTHLY",
  }

  const SUBSCRIPTION_RECORD = {
    id: "sub-1",
    supporterId: SUPPORTER.id,
    creatorId: CREATOR.id,
    tierName: "Supporter",
    amountCents: 900,
    interval: "MONTHLY",
    status: "PAUSED",
  }

  beforeAll(async () => {
    const mod = await import("@/app/api/creators/[creatorId]/subscription/route")
    POST = mod.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUnique.mockReset()
    mockUserUpdate.mockReset()
    mockStripeCustomersCreate.mockReset()
    mockStripeCheckoutSessionsCreate.mockReset()
    mockCreatorSubscriptionUpsert.mockReset()

    mockGetCurrentUser.mockResolvedValue({ id: SUPPORTER.id })
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    mockCreatorPaymentLimiterCheck.mockReturnValue(true)
    mockGetClientIdentifier.mockReturnValue("127.0.0.1")
    mockIsValidSubscriptionPlan.mockReturnValue(true)
    mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new" })
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_sub_test",
      url: "https://checkout.stripe.com/session_sub",
    })
    mockCreatorSubscriptionUpsert.mockResolvedValue(SUBSCRIPTION_RECORD)
    mockUserUpdate.mockResolvedValue({})
    // Default: supporter + creator for normal happy-path tests
    setupUserMocksForSub()
  })

  async function callSubPost(creatorId: string, body: unknown) {
    return POST(makeSubRequest(creatorId, "POST", body), {
      params: Promise.resolve({ creatorId }),
    })
  }

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    mockUserFindUnique.mockReset()
    mockUserFindUnique.mockResolvedValue(null)
    const res = await callSubPost(CREATOR.id, VALID_PLAN_BODY)
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockCreatorPaymentLimiterCheck.mockReturnValue(false)
    const res = await callSubPost(CREATOR.id, VALID_PLAN_BODY)
    expect(res.status).toBe(429)
  })

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await callSubPost(CREATOR.id, VALID_PLAN_BODY)
    expect(res.status).toBe(403)
  })

  it("returns 400 when user tries to subscribe to themselves", async () => {
    // The route checks creatorId === supporter.id before the creator DB lookup
    setupUserMocksForSub({ ...SUPPORTER, id: "same-id" }, CREATOR)
    const res = await callSubPost("same-id", VALID_PLAN_BODY)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/cannot subscribe to yourself/i)
  })

  it("returns 404 when creator is not found", async () => {
    setupUserMocksForSub(SUPPORTER, null)
    const res = await callSubPost("nonexistent", VALID_PLAN_BODY)
    expect(res.status).toBe(404)
  })

  it("returns 400 when the subscription plan is invalid", async () => {
    mockIsValidSubscriptionPlan.mockReturnValue(false)
    const res = await callSubPost(CREATOR.id, VALID_PLAN_BODY)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/unsupported subscription plan/i)
  })

  it("returns 400 when required fields are missing from request body", async () => {
    const res = await callSubPost(CREATOR.id, { tierName: "Supporter" })
    expect(res.status).toBe(400)
  })

  it("creates Stripe checkout session in subscription mode", async () => {
    setupUserMocksForSub()
    const res = await callSubPost(CREATOR.id, VALID_PLAN_BODY)
    expect(res.status).toBe(201)
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription" })
    )
  })

  it("upserts subscription record and returns 201 with checkout url", async () => {
    setupUserMocksForSub()
    const res = await callSubPost(CREATOR.id, VALID_PLAN_BODY)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.subscription).toBeDefined()
    expect(data.url).toBe("https://checkout.stripe.com/session_sub")
    expect(mockCreatorSubscriptionUpsert).toHaveBeenCalled()
  })

  it("creates a Stripe customer when supporter has no stripeCustomerId", async () => {
    // SUPPORTER has stripeCustomerId: null — default setup
    setupUserMocksForSub()
    const res = await callSubPost(CREATOR.id, VALID_PLAN_BODY)
    expect(res.status).toBe(201)
    expect(mockStripeCustomersCreate).toHaveBeenCalledTimes(1)
    expect(mockUserUpdate).toHaveBeenCalled()
  })

  it("does not create a new Stripe customer when one already exists", async () => {
    setupUserMocksForSub({ ...SUPPORTER, stripeCustomerId: "cus_existing" }, CREATOR)
    const res = await callSubPost(CREATOR.id, VALID_PLAN_BODY)
    expect(res.status).toBe(201)
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/creators/[creatorId]/subscription", () => {
  let DELETE: (
    req: NextRequest,
    ctx: { params: Promise<{ creatorId: string }> }
  ) => Promise<Response>

  const ACTIVE_SUBSCRIPTION = {
    id: "sub-active",
    supporterId: SUPPORTER.id,
    creatorId: CREATOR.id,
    status: "ACTIVE",
    stripeSubscriptionId: "sub_stripe_abc",
  }

  beforeAll(async () => {
    const mod = await import("@/app/api/creators/[creatorId]/subscription/route")
    DELETE = mod.DELETE
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUnique.mockReset()
    mockCreatorSubscriptionFindUnique.mockReset()
    mockStripeSubscriptionsUpdate.mockReset()
    mockCreatorSubscriptionUpdate.mockReset()

    mockGetCurrentUser.mockResolvedValue({ id: SUPPORTER.id })
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    mockUserFindUnique.mockResolvedValueOnce(SUPPORTER)
    mockCreatorSubscriptionFindUnique.mockResolvedValue(ACTIVE_SUBSCRIPTION)
    mockStripeSubscriptionsUpdate.mockResolvedValue({})
    mockCreatorSubscriptionUpdate.mockResolvedValue({ ...ACTIVE_SUBSCRIPTION, status: "CANCELED" })
  })

  async function callSubDelete(creatorId: string) {
    return DELETE(makeSubRequest(creatorId, "DELETE"), {
      params: Promise.resolve({ creatorId }),
    })
  }

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue(null)
    const res = await callSubDelete(CREATOR.id)
    expect(res.status).toBe(401)
  })

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await callSubDelete(CREATOR.id)
    expect(res.status).toBe(403)
  })

  it("returns 404 when no subscription exists between supporter and creator", async () => {
    mockCreatorSubscriptionFindUnique.mockResolvedValue(null)
    const res = await callSubDelete(CREATOR.id)
    expect(res.status).toBe(404)
  })

  it("cancels subscription at period end on Stripe and marks status CANCELED", async () => {
    const res = await callSubDelete(CREATOR.id)
    expect(res.status).toBe(200)
    expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith("sub_stripe_abc", {
      cancel_at_period_end: true,
    })
    expect(mockCreatorSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELED" }),
      })
    )
  })

  it("skips Stripe call when subscription has no stripeSubscriptionId", async () => {
    mockCreatorSubscriptionFindUnique.mockResolvedValue({
      ...ACTIVE_SUBSCRIPTION,
      stripeSubscriptionId: null,
    })
    const res = await callSubDelete(CREATOR.id)
    expect(res.status).toBe(200)
    expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled()
  })

  it("returns the canceled subscription in the response", async () => {
    const res = await callSubDelete(CREATOR.id)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.subscription).toBeDefined()
    expect(data.subscription.status).toBe("CANCELED")
  })
})

export {}
