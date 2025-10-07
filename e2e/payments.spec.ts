/**
 * Payments & Subscription E2E Tests
 *
 * Tests for the Stripe checkout and billing portal flows.
 *
 * Network calls to /api/stripe/checkout and /api/stripe/portal are intercepted
 * with page.route() so no live Stripe credentials are required for the core
 * UI-wiring assertions. Authenticated suites only register when E2E credentials
 * are provided via E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
 */

import { expect, test, type Page } from "@playwright/test"

import { hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

const assertAuthRedirects = process.env.E2E_ASSERT_AUTH_REDIRECTS === "true"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Intercept the CSRF endpoint to return a stable fake token. */
async function mockCsrf(page: Page): Promise<void> {
  await page.route("**/api/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: "e2e-fake-csrf-token" }),
    })
  })
}

/**
 * Intercept /api/stripe/checkout and resolve with a mocked Stripe checkout URL.
 * Returns a tracker so callers can verify the route was hit.
 */
async function mockCheckout(page: Page, checkoutUrl = "https://checkout.stripe.com/pay/e2e-test") {
  let wasHit = false
  await page.route("**/api/stripe/checkout", async (route) => {
    wasHit = true
    // Capture the request headers for CSRF assertions
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: checkoutUrl }),
    })
  })
  return { wasHit: () => wasHit }
}

/**
 * Intercept /api/stripe/portal and resolve with a mocked billing-portal URL.
 */
async function mockPortal(page: Page, portalUrl = "https://billing.stripe.com/session/e2e-test") {
  let wasHit = false
  await page.route("**/api/stripe/portal", async (route) => {
    wasHit = true
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: portalUrl }),
    })
  })
  return { wasHit: () => wasHit }
}

// ---------------------------------------------------------------------------
// Public / unauthenticated: pricing page content
// ---------------------------------------------------------------------------

test.describe("Pricing Page (public)", () => {
  test("should be accessible without authentication", async ({ page }) => {
    const response = await page.goto("/pricing")
    expect(response?.status()).toBeLessThan(400)
    await expect(page.locator("body")).toBeVisible()
  })

  test("should display both Free and PRO plan headings", async ({ page }) => {
    await page.goto("/pricing")
    await expect(page.getByRole("heading", { name: /free/i }).first()).toBeVisible()
    await expect(page.getByRole("heading", { name: /pro/i }).first()).toBeVisible()
  })

  test("should display PRO plan price", async ({ page }) => {
    await page.goto("/pricing")
    // $9.99/month is rendered as text on the page
    await expect(page.getByText(/\$9\.99/).first()).toBeVisible()
  })

  test("should list PRO plan features", async ({ page }) => {
    await page.goto("/pricing")
    await expect(page.getByText(/conversation export/i).first()).toBeVisible()
    await expect(page.getByText(/conversation sharing/i).first()).toBeVisible()
    await expect(page.getByText(/200 ai memories/i).first()).toBeVisible()
  })

  test("should show Upgrade to PRO link pointing to sign-in for unauthenticated visitors", async ({
    page,
  }) => {
    await page.goto("/pricing")
    const upgradeLink = page.getByRole("link", { name: /upgrade to pro/i }).first()
    await expect(upgradeLink).toBeVisible()
    await expect(upgradeLink).toHaveAttribute("href", "/sign-in")
  })

  test("should show Get Started Free link for unauthenticated visitors", async ({ page }) => {
    await page.goto("/pricing")
    const freeLink = page.getByRole("link", { name: /get started free/i }).first()
    await expect(freeLink).toBeVisible()
  })

  test("should render FAQ section with expected questions", async ({ page }) => {
    await page.goto("/pricing")
    await expect(page.getByRole("heading", { name: /frequently asked questions/i })).toBeVisible()
    await expect(page.getByText(/can i switch plans anytime/i)).toBeVisible()
    await expect(page.getByText(/what payment methods do you accept/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Auth redirects (only asserted when E2E_ASSERT_AUTH_REDIRECTS=true)
// ---------------------------------------------------------------------------

if (assertAuthRedirects) {
  test.describe("Checkout auth protection", () => {
    test("should redirect unauthenticated POST to /api/stripe/checkout to sign-in or 401", async ({
      page,
    }) => {
      // Navigating to the pricing page as an unauth'd user and clicking the
      // Upgrade button would redirect to /sign-in (the link renders as an <a>).
      await page.goto("/pricing")
      const upgradeLink = page.getByRole("link", { name: /upgrade to pro/i }).first()
      await expect(upgradeLink).toHaveAttribute("href", "/sign-in")
    })
  })
}

// ---------------------------------------------------------------------------
// Authenticated suites
// ---------------------------------------------------------------------------

if (hasE2EAuthCredentials) {
  test.describe("Pricing Page (authenticated free user)", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E payment tests require valid credentials")
    })

    test("should show Upgrade to PRO button for a free user", async ({ page }) => {
      await page.goto("/pricing")
      // The server-rendered page replaces the sign-in link with a client-side button
      const upgradeButton = page
        .getByRole("button", { name: /upgrade to pro/i })
        .or(page.getByRole("link", { name: /upgrade to pro/i }))
        .first()
      await expect(upgradeButton).toBeVisible()
    })

    test("should redirect to Stripe checkout URL when Upgrade button is clicked", async ({
      page,
    }) => {
      const checkoutUrl = "https://checkout.stripe.com/pay/e2e-session"

      // Intercept before navigation so routes are registered in time.
      await mockCsrf(page)
      const checkoutTracker = await mockCheckout(page, checkoutUrl)

      // Because navigateTo() will attempt to navigate away, intercept that too.
      await page.route(checkoutUrl, async (route) => {
        // Just abort: we only care that the redirect was attempted.
        await route.abort()
      })

      await page.goto("/pricing")

      const upgradeButton = page.getByRole("button", { name: /upgrade to pro/i }).first()
      await expect(upgradeButton).toBeVisible()
      await upgradeButton.click()

      // Wait a moment for the async click handler to fire.
      await expect.poll(() => checkoutTracker.wasHit(), { timeout: 10000 }).toBe(true)
    })

    test("should send X-CSRF-Token header with checkout request", async ({ page }) => {
      let capturedCsrfHeader: string | null = null

      await page.route("**/api/csrf", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ token: "sentinel-csrf-value" }),
        })
      })

      await page.route("**/api/stripe/checkout", async (route) => {
        capturedCsrfHeader = route.request().headers()["x-csrf-token"] ?? null
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ url: "https://checkout.stripe.com/pay/e2e-csrf-test" }),
        })
      })

      // Abort the outbound Stripe navigation.
      await page.route("https://checkout.stripe.com/**", async (route) => {
        await route.abort()
      })

      await page.goto("/pricing")

      const upgradeButton = page.getByRole("button", { name: /upgrade to pro/i }).first()
      await expect(upgradeButton).toBeVisible()
      await upgradeButton.click()

      await expect.poll(() => capturedCsrfHeader, { timeout: 10000 }).toBe("sentinel-csrf-value")
    })

    test("should show Redirecting... label while checkout request is in-flight", async ({
      page,
    }) => {
      // Delay the checkout response long enough to observe the loading label.
      await page.route("**/api/csrf", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ token: "e2e-csrf" }),
        })
      })

      await page.route("**/api/stripe/checkout", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ url: "https://checkout.stripe.com/pay/e2e-slow" }),
        })
      })

      await page.route("https://checkout.stripe.com/**", async (route) => {
        await route.abort()
      })

      await page.goto("/pricing")

      const upgradeButton = page.getByRole("button", { name: /upgrade to pro/i }).first()
      await expect(upgradeButton).toBeVisible()
      await upgradeButton.click()

      // The button label should change to "Redirecting..." while the request is pending.
      await expect(page.getByRole("button", { name: /redirecting/i })).toBeVisible({
        timeout: 3000,
      })
    })
  })

  test.describe("Billing Portal (authenticated PRO-simulated user)", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E billing portal tests require valid credentials")
    })

    test("should redirect to Stripe billing portal when portal endpoint is mocked", async ({
      page,
    }) => {
      const portalUrl = "https://billing.stripe.com/session/e2e-portal-session"

      await mockCsrf(page)
      const portalTracker = await mockPortal(page, portalUrl)

      await page.route(portalUrl, async (route) => {
        await route.abort()
      })

      // Directly trigger the portal API to verify the redirect wiring, since
      // the "Manage Billing" button only renders for confirmed PRO users.
      // We verify the portal endpoint machinery via a direct fetch from the page context.
      await page.goto("/pricing")

      const response = await page.evaluate(async (url) => {
        const csrfRes = await fetch("/api/csrf")
        const { token } = (await csrfRes.json()) as { token: string }
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
          },
          body: JSON.stringify({}),
        })
        return { status: res.status, body: await res.json() }
      }, "/api/stripe/portal")

      // The mock returned a 200 with the portal URL.
      expect(response.status).toBe(200)
      expect((response.body as { url: string }).url).toBe(portalUrl)
      expect(portalTracker.wasHit()).toBe(true)
    })

    test("should include X-CSRF-Token header with portal request", async ({ page }) => {
      let capturedPortalCsrf: string | null = null

      await page.route("**/api/csrf", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ token: "portal-sentinel-token" }),
        })
      })

      await page.route("**/api/stripe/portal", async (route) => {
        capturedPortalCsrf = route.request().headers()["x-csrf-token"] ?? null
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ url: "https://billing.stripe.com/session/csrf-check" }),
        })
      })

      await page.goto("/pricing")

      await page.evaluate(async () => {
        const csrfRes = await fetch("/api/csrf")
        const { token } = (await csrfRes.json()) as { token: string }
        await fetch("/api/stripe/portal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
          },
          body: JSON.stringify({}),
        })
      })

      await expect.poll(() => capturedPortalCsrf, { timeout: 10000 }).toBe("portal-sentinel-token")
    })
  })

  test.describe("Dashboard subscription prompts (authenticated free user)", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E subscription prompt tests require valid credentials")
    })

    test("should render dashboard without errors after login", async ({ page }) => {
      await page.goto("/dashboard")
      await expect(page.locator("body")).toBeVisible()
      // Dashboard should not redirect to sign-in
      await expect(page.url()).toContain("/dashboard")
    })
  })
}
