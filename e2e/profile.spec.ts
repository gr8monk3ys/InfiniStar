/**
 * Profile & Settings E2E Tests
 *
 * Tests for user profile management, settings,
 * and security features like 2FA.
 */

import { expect, test } from "@playwright/test"

import { hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

const assertAuthRedirects = process.env.E2E_ASSERT_AUTH_REDIRECTS === "true"

test.describe("Profile Page", () => {
  if (assertAuthRedirects) {
    test.describe("Unauthenticated access", () => {
      test("should redirect to sign-in when not authenticated", async ({ page }) => {
        await page.goto("/dashboard/profile")
        await expect(page.url()).toContain("/sign-in")
      })
    })
  }

  if (hasE2EAuthCredentials) {
    test.describe("Authenticated user", () => {
      test.beforeEach(async ({ page }) => {
        await requireLogin(page, "E2E profile tests require valid credentials")
      })

      test("should display profile page", async ({ page }) => {
        await page.goto("/dashboard/profile")

        // Should be on profile page
        await expect(page.url()).toContain("/profile")

        // Page should render
        await expect(page.locator("body")).toBeVisible()
      })

      test("should have profile tabs or sections", async ({ page }) => {
        await page.goto("/dashboard/profile")

        // Look for tabs: Profile, Security, Sessions, etc.
        const tabs = page.locator('[role="tablist"] button, [role="tab"]')
        const sections = page
          .locator("h2, h3")
          .filter({ hasText: /profile|security|sessions|password/i })

        const tabCount = await tabs.count()
        const sectionCount = await sections.count()

        // Should have some form of organization (tabs or sections)
        expect(tabCount + sectionCount).toBeGreaterThan(0)
      })

      test("should display user name in profile", async ({ page }) => {
        await page.goto("/dashboard/profile")

        // Look for name input or display
        const nameField = page.locator('input[name="name"], [data-testid="profile-name"]')
        const nameDisplay = page.locator("text=/name/i").first()

        const hasNameField = await nameField.isVisible().catch(() => false)
        const hasNameDisplay = await nameDisplay.isVisible().catch(() => false)

        expect(hasNameField || hasNameDisplay).toBe(true)
      })
    })
  }
})

if (hasE2EAuthCredentials) {
  test.describe("Profile Editing", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E profile editing tests require valid credentials")
    })

    test("should have editable profile fields", async ({ page }) => {
      await page.goto("/dashboard/profile")

      // Look for input fields
      const nameInput = page.locator('input[name="name"]')
      const bioInput = page.locator('textarea[name="bio"], input[name="bio"]')
      const locationInput = page.locator('input[name="location"]')
      const websiteInput = page.locator('input[name="website"]')

      // At least one field should be editable
      const hasEditableFields =
        (await nameInput.isVisible().catch(() => false)) ||
        (await bioInput.isVisible().catch(() => false)) ||
        (await locationInput.isVisible().catch(() => false)) ||
        (await websiteInput.isVisible().catch(() => false))

      expect(hasEditableFields).toBe(true)
    })

    test("should have save button for profile changes", async ({ page }) => {
      await page.goto("/dashboard/profile")

      const saveButton = page.locator(
        'button:has-text("Save"), button:has-text("Update"), button[type="submit"]'
      )
      await expect(saveButton.first()).toBeVisible()
    })
  })

  test.describe("Security Settings", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E security tests require valid credentials")
    })

    test("should have password change section", async ({ page }) => {
      await page.goto("/dashboard/profile")

      const securityTab = page.locator(
        '[role="tab"]:has-text("Security"), button:has-text("Security")'
      )
      if (await securityTab.isVisible()) {
        await securityTab.click()
      }

      const passwordSection = page.locator("text=/change.*password|password/i")
      const passwordInput = page.locator('input[type="password"]')
      const hasPasswordContent =
        (await passwordSection.count()) > 0 || (await passwordInput.count()) > 0

      expect(hasPasswordContent).toBe(true)
    })

    test("should have two-factor authentication section", async ({ page }) => {
      await page.goto("/dashboard/profile")

      const securityTab = page.locator(
        '[role="tab"]:has-text("Security"), button:has-text("Security")'
      )
      if (await securityTab.isVisible()) {
        await securityTab.click()
      }

      const twoFactorSection = page.locator("text=/two.?factor|2FA/i")
      expect(await twoFactorSection.count()).toBeGreaterThan(0)
    })
  })

  test.describe("Sessions Management", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E session tests require valid credentials")
    })

    test("should have sessions tab or section", async ({ page }) => {
      await page.goto("/dashboard/profile")

      const sessionsTab = page.locator(
        '[role="tab"]:has-text("Sessions"), button:has-text("Sessions")'
      )
      if (await sessionsTab.isVisible()) {
        await sessionsTab.click()
      }

      const sessionContent = page.locator("text=/session|device|browser/i")
      const sessionList = page.locator(
        '[data-testid="sessions-list"], ul:has(li:has-text("session"))'
      )
      const hasSessionContent =
        (await sessionContent.count()) > 0 || (await sessionList.count()) > 0

      expect(hasSessionContent).toBe(true)
    })

    test("should show current session indicator", async ({ page }) => {
      await page.goto("/dashboard/profile")

      const sessionsTab = page.locator(
        '[role="tab"]:has-text("Sessions"), button:has-text("Sessions")'
      )
      if (await sessionsTab.isVisible()) {
        await sessionsTab.click()
      }

      const currentSession = page.locator(
        'text=/current.*session|this.*session/i, [data-current-session="true"], [aria-label*="current session"]'
      )
      await expect(currentSession.first()).toBeVisible()
    })
  })
}
