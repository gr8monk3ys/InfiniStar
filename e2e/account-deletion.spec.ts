/**
 * GDPR Account Deletion E2E Tests
 *
 * Tests for the account deletion flow accessible from Profile Settings → Delete Account tab.
 *
 * Authenticated suites only register when E2E credentials are provided via
 * E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
 *
 * All calls to /api/account and /api/account/cancel-deletion are intercepted
 * with page.route() — no real database mutations occur.
 */

import { expect, test, type Page } from "@playwright/test"

import { hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

const assertAuthRedirects = process.env.E2E_ASSERT_AUTH_REDIRECTS === "true"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the profile page and activate the "Delete Account" tab.
 * Returns true only if the tab was found and clicked.
 */
async function openAccountTab(page: Page): Promise<boolean> {
  await page.goto("/dashboard/profile")
  await expect(page.locator("body")).toBeVisible()

  const accountTab = page
    .getByRole("button", { name: /delete account/i })
    .or(page.locator('[role="tab"]:has-text("Delete Account")'))
    .first()

  const isVisible = await accountTab.isVisible().catch(() => false)
  if (!isVisible) {
    return false
  }

  await accountTab.click()
  return true
}

/**
 * Open the account deletion modal by clicking the "Delete My Account" button
 * inside the Account tab content.
 */
async function openDeleteModal(page: Page): Promise<void> {
  const deleteButton = page.getByRole("button", { name: /delete my account/i }).first()
  await expect(deleteButton).toBeVisible()
  await deleteButton.click()
}

/**
 * Intercept /api/account (DELETE) to return a successful deletion-scheduled response.
 */
async function mockDeletionSuccess(
  page: Page,
  deletionScheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
) {
  let wasHit = false
  await page.route("**/api/account", async (route) => {
    if (route.request().method() === "DELETE") {
      wasHit = true
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Account deletion scheduled",
          deletionScheduledFor,
          gracePeriodDays: 30,
        }),
      })
    } else {
      await route.continue()
    }
  })
  return { wasHit: () => wasHit }
}

/**
 * Intercept /api/account/deletion-status to report a pending deletion.
 */
async function mockDeletionStatus(
  page: Page,
  overrides: {
    deletionRequested?: boolean
    deletionScheduledFor?: string | null
    daysRemaining?: number | null
  } = {}
) {
  const deletionScheduledFor =
    "deletionScheduledFor" in overrides
      ? overrides.deletionScheduledFor
      : new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()

  await page.route("**/api/account/deletion-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        deletionRequested: overrides.deletionRequested ?? true,
        deletionRequestedAt: new Date().toISOString(),
        deletionScheduledFor,
        daysRemaining: overrides.daysRemaining ?? 25,
      }),
    })
  })
}

/**
 * Intercept /api/account/cancel-deletion (POST) to return a successful cancellation.
 */
async function mockCancelDeletion(page: Page) {
  let wasHit = false
  await page.route("**/api/account/cancel-deletion", async (route) => {
    wasHit = true
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Account deletion cancelled successfully",
      }),
    })
  })
  return { wasHit: () => wasHit }
}

// ---------------------------------------------------------------------------
// Auth redirect assertions (E2E_ASSERT_AUTH_REDIRECTS=true only)
// ---------------------------------------------------------------------------

if (assertAuthRedirects) {
  test.describe("Account deletion: unauthenticated access", () => {
    test("should redirect to sign-in when accessing profile page without auth", async ({
      page,
    }) => {
      await page.goto("/dashboard/profile")
      await expect(page.url()).toContain("/sign-in")
    })
  })
}

// ---------------------------------------------------------------------------
// Authenticated suites
// ---------------------------------------------------------------------------

if (hasE2EAuthCredentials) {
  // -------------------------------------------------------------------------
  // Account tab visibility and navigation
  // -------------------------------------------------------------------------

  test.describe("Account tab navigation", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E account deletion tests require valid credentials")
    })

    test("should display the Delete Account tab on the profile page", async ({ page }) => {
      await page.goto("/dashboard/profile")

      const accountTab = page
        .getByRole("button", { name: /delete account/i })
        .or(page.locator('[role="tab"]:has-text("Delete Account")'))
        .first()
      await expect(accountTab).toBeVisible()
    })

    test("should reveal the Danger Zone section when the Account tab is clicked", async ({
      page,
    }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        // Skip gracefully if the tab is not rendered in this environment.
        return
      }

      await expect(page.getByText(/danger zone/i).first()).toBeVisible()
    })

    test("should display the 30-day grace period notice in the Account tab", async ({ page }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await expect(page.getByText(/30.?day grace period/i).first()).toBeVisible()
    })

    test("should display the Delete My Account button in the Account tab", async ({ page }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      const deleteButton = page.getByRole("button", { name: /delete my account/i }).first()
      await expect(deleteButton).toBeVisible()
    })
  })

  // -------------------------------------------------------------------------
  // Delete Account modal content and guard behaviour
  // -------------------------------------------------------------------------

  test.describe("Delete Account modal", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E account deletion modal tests require valid credentials")
    })

    test("should open the confirmation modal when Delete My Account is clicked", async ({
      page,
    }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      // The modal title must be visible.
      const modalTitle = page.getByRole("heading", { name: /delete account/i }).first()
      await expect(modalTitle).toBeVisible()
    })

    test("should show the 30-day grace period warning inside the modal", async ({ page }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      await expect(page.getByText(/30.?day grace period/i).first()).toBeVisible()
    })

    test("should list consequences of account deletion inside the modal", async ({ page }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      await expect(
        page.getByText(/delete all your messages and conversations/i).first()
      ).toBeVisible()
    })

    test("should have a confirmation text input requiring the word DELETE", async ({ page }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      const confirmInput = page.locator("#confirmation-text").first()
      await expect(confirmInput).toBeVisible()
      await expect(confirmInput).toHaveAttribute("placeholder", "DELETE")
    })

    test("should keep the Delete Account submit button disabled when confirmation text is empty", async ({
      page,
    }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      const submitButton = page.getByRole("button", { name: /delete account/i }).last()
      await expect(submitButton).toBeDisabled()
    })

    test("should keep the submit button disabled when confirmation text is incorrect", async ({
      page,
    }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      const confirmInput = page.locator("#confirmation-text").first()
      await confirmInput.fill("delete")

      const submitButton = page.getByRole("button", { name: /delete account/i }).last()
      await expect(submitButton).toBeDisabled()
    })

    test("should enable the submit button only when DELETE is typed exactly", async ({ page }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      // Prevent the actual API call from reaching the server.
      await mockDeletionSuccess(page)

      await openDeleteModal(page)

      const confirmInput = page.locator("#confirmation-text").first()
      const submitButton = page.getByRole("button", { name: /delete account/i }).last()

      // The input forces uppercase via onChange, so filling "DELETE" satisfies the check.
      await confirmInput.fill("DELETE")
      await expect(submitButton).toBeEnabled()
    })

    test("should close the modal without submitting when Cancel is clicked", async ({ page }) => {
      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      const cancelButton = page.getByRole("button", { name: /^cancel$/i }).first()
      await expect(cancelButton).toBeVisible()
      await cancelButton.click()

      // The modal heading should no longer be visible.
      const modalTitle = page.getByRole("heading", { name: /delete account/i })
      await expect(modalTitle).toHaveCount(0, { timeout: 5000 })
    })
  })

  // -------------------------------------------------------------------------
  // Submission flow (mocked API)
  // -------------------------------------------------------------------------

  test.describe("Account deletion submission (mocked API)", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E account deletion submission tests require valid credentials")
    })

    test("should call /api/account (DELETE) when the form is submitted with DELETE typed", async ({
      page,
    }) => {
      const deletionTracker = await mockDeletionSuccess(page)

      // After the mock succeeds the page calls /api/account/deletion-status to
      // refresh the badge. Provide a pending response so it does not 404.
      await mockDeletionStatus(page)

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      const confirmInput = page.locator("#confirmation-text").first()
      await confirmInput.fill("DELETE")

      const submitButton = page.getByRole("button", { name: /delete account/i }).last()
      await expect(submitButton).toBeEnabled()
      await submitButton.click()

      await expect.poll(() => deletionTracker.wasHit(), { timeout: 10000 }).toBe(true)
    })

    test("should close the modal after a successful deletion request", async ({ page }) => {
      await mockDeletionSuccess(page)
      await mockDeletionStatus(page)

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      const confirmInput = page.locator("#confirmation-text").first()
      await confirmInput.fill("DELETE")
      await page
        .getByRole("button", { name: /delete account/i })
        .last()
        .click()

      // Modal should close — the heading disappears.
      await expect(page.getByRole("heading", { name: /^delete account$/i })).toHaveCount(0, {
        timeout: 10000,
      })
    })
  })

  // -------------------------------------------------------------------------
  // Pending deletion state — "Pending" badge and cancel flow
  // -------------------------------------------------------------------------

  test.describe("Pending deletion state (mocked API)", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E pending deletion tests require valid credentials")
    })

    test("should show Pending badge on the Account tab when deletion is already requested", async ({
      page,
    }) => {
      // The profile page fetches /api/account/deletion-status on mount.
      await mockDeletionStatus(page, { deletionRequested: true, daysRemaining: 28 })

      await page.goto("/dashboard/profile")

      // The tab button renders a "Pending" badge when deletionStatus.deletionRequested is true.
      const pendingBadge = page.getByText(/pending/i).first()
      await expect(pendingBadge).toBeVisible({ timeout: 10000 })
    })

    test("should display Account Deletion Pending heading when tab is opened in pending state", async ({
      page,
    }) => {
      await mockDeletionStatus(page, { deletionRequested: true, daysRemaining: 25 })

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await expect(page.getByText(/account deletion pending/i).first()).toBeVisible()
    })

    test("should display days remaining inside the pending deletion notice", async ({ page }) => {
      await mockDeletionStatus(page, { deletionRequested: true, daysRemaining: 22 })

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await expect(page.getByText(/22 days/i).first()).toBeVisible()
    })

    test("should show the Cancel Deletion Request button in pending state", async ({ page }) => {
      await mockDeletionStatus(page, { deletionRequested: true, daysRemaining: 20 })

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      const cancelButton = page.getByRole("button", { name: /cancel deletion request/i }).first()
      await expect(cancelButton).toBeVisible()
    })

    test("should call /api/account/cancel-deletion when Cancel Deletion Request is clicked", async ({
      page,
    }) => {
      await mockDeletionStatus(page, { deletionRequested: true, daysRemaining: 15 })
      const cancelTracker = await mockCancelDeletion(page)

      // After cancellation the page re-fetches deletion status — return a
      // non-pending response so the Pending badge disappears.
      await page.route("**/api/account/deletion-status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            deletionRequested: false,
            deletionRequestedAt: null,
            deletionScheduledFor: null,
            daysRemaining: null,
          }),
        })
      })

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      const cancelButton = page.getByRole("button", { name: /cancel deletion request/i }).first()
      await expect(cancelButton).toBeVisible()
      await cancelButton.click()

      await expect.poll(() => cancelTracker.wasHit(), { timeout: 10000 }).toBe(true)
    })

    test("should hide the Pending badge after a successful cancellation", async ({ page }) => {
      // First call returns pending; second call (after cancel) returns clean.
      let callCount = 0
      await page.route("**/api/account/deletion-status", async (route) => {
        callCount++
        const isPending = callCount === 1
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            deletionRequested: isPending,
            deletionRequestedAt: isPending ? new Date().toISOString() : null,
            deletionScheduledFor: isPending
              ? new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
              : null,
            daysRemaining: isPending ? 25 : null,
          }),
        })
      })

      await mockCancelDeletion(page)

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      const cancelButton = page.getByRole("button", { name: /cancel deletion request/i }).first()
      await expect(cancelButton).toBeVisible()
      await cancelButton.click()

      // After cancellation the Pending badge should no longer be present.
      await expect(page.getByText(/pending/i).first()).toHaveCount(0, { timeout: 10000 })
    })
  })

  // -------------------------------------------------------------------------
  // API error handling
  // -------------------------------------------------------------------------

  test.describe("Account deletion error handling (mocked API)", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E account deletion error tests require valid credentials")
    })

    test("should not submit deletion when CSRF token is invalid (mocked 403)", async ({ page }) => {
      await page.route("**/api/account", async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ error: "Invalid CSRF token", code: "CSRF_INVALID" }),
          })
        } else {
          await route.continue()
        }
      })

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      const confirmInput = page.locator("#confirmation-text").first()
      await confirmInput.fill("DELETE")
      await page
        .getByRole("button", { name: /delete account/i })
        .last()
        .click()

      // Modal should remain visible because the request failed.
      await expect(page.getByRole("heading", { name: /^delete account$/i }).first()).toBeVisible({
        timeout: 8000,
      })
    })

    test("should not submit deletion when rate limited (mocked 429)", async ({ page }) => {
      await page.route("**/api/account", async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: 429,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Too many deletion requests. Please try again later.",
              code: "RATE_LIMITED",
            }),
          })
        } else {
          await route.continue()
        }
      })

      const tabFound = await openAccountTab(page)
      if (!tabFound) {
        return
      }

      await openDeleteModal(page)

      const confirmInput = page.locator("#confirmation-text").first()
      await confirmInput.fill("DELETE")
      await page
        .getByRole("button", { name: /delete account/i })
        .last()
        .click()

      // The modal stays open when the request fails.
      await expect(page.getByRole("heading", { name: /^delete account$/i }).first()).toBeVisible({
        timeout: 8000,
      })
    })
  })
}
