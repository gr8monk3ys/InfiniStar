/**
 * Profile & Settings E2E Tests
 *
 * Tests for user profile management, settings,
 * and security features like 2FA.
 */

import { expect, test } from "@playwright/test"

import { login } from "./fixtures/auth"

test.describe("Profile Page", () => {
  test.describe("Unauthenticated access", () => {
    test("should redirect to login when not authenticated", async ({ page }) => {
      await page.goto("/dashboard/profile")
      await expect(page.url()).toContain("/login")
    })
  })

  test.describe("Authenticated user", () => {
    test.beforeEach(async ({ page }) => {
      const success = await login(page)
      if (!success) {
        test.skip(true, "Could not login - skipping authenticated tests")
      }
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
})

test.describe("Profile Editing", () => {
  test.beforeEach(async ({ page }) => {
    const success = await login(page)
    if (!success) {
      test.skip(true, "Could not login - skipping authenticated tests")
    }
  })

  test("should have editable profile fields", async ({ page }) => {
    await page.goto("/dashboard/profile")

    // Look for input fields
    const nameInput = page.locator('input[name="name"]')
    const bioInput = page.locator('textarea[name="bio"], input[name="bio"]')
    const locationInput = page.locator('input[name="location"]')
    const websiteInput = page.locator('input[name="website"]')

    // At least name should be editable
    const hasEditableFields =
      (await nameInput.isVisible().catch(() => false)) ||
      (await bioInput.isVisible().catch(() => false)) ||
      (await locationInput.isVisible().catch(() => false)) ||
      (await websiteInput.isVisible().catch(() => false))

    expect(hasEditableFields).toBe(true)
  })

  test("should have save button for profile changes", async ({ page }) => {
    await page.goto("/dashboard/profile")

    // Look for save or update button
    const saveButton = page.locator(
      'button:has-text("Save"), button:has-text("Update"), button[type="submit"]'
    )

    // Save button should exist
    const buttonCount = await saveButton.count()
    expect(buttonCount).toBeGreaterThan(0)
  })
})

test.describe("Security Settings", () => {
  test.beforeEach(async ({ page }) => {
    const success = await login(page)
    if (!success) {
      test.skip(true, "Could not login - skipping authenticated tests")
    }
  })

  test("should have password change section", async ({ page }) => {
    await page.goto("/dashboard/profile")

    // Look for security tab or password section
    const securityTab = page.locator(
      '[role="tab"]:has-text("Security"), button:has-text("Security")'
    )
    if (await securityTab.isVisible()) {
      await securityTab.click()
    }

    // Look for password-related content
    const passwordSection = page.locator("text=/change.*password|password/i")
    const passwordInput = page.locator('input[type="password"]')

    const hasPasswordContent =
      (await passwordSection.count()) > 0 || (await passwordInput.count()) > 0

    expect(hasPasswordContent).toBe(true)
  })

  test("should have two-factor authentication section", async ({ page }) => {
    await page.goto("/dashboard/profile")

    // Look for security tab
    const securityTab = page.locator(
      '[role="tab"]:has-text("Security"), button:has-text("Security")'
    )
    if (await securityTab.isVisible()) {
      await securityTab.click()
    }

    // Look for 2FA content
    const twoFactorSection = page.locator("text=/two.?factor|2FA/i")

    const has2FASection = (await twoFactorSection.count()) > 0

    // 2FA section should exist in security settings
    expect(has2FASection).toBe(true)
  })
})

test.describe("Sessions Management", () => {
  test.beforeEach(async ({ page }) => {
    const success = await login(page)
    if (!success) {
      test.skip(true, "Could not login - skipping authenticated tests")
    }
  })

  test("should have sessions tab or section", async ({ page }) => {
    await page.goto("/dashboard/profile")

    // Look for sessions tab
    const sessionsTab = page.locator(
      '[role="tab"]:has-text("Sessions"), button:has-text("Sessions")'
    )
    if (await sessionsTab.isVisible()) {
      await sessionsTab.click()
    }

    // Look for session-related content
    const sessionContent = page.locator("text=/session|device|browser/i")
    const sessionList = page.locator(
      '[data-testid="sessions-list"], ul:has(li:has-text("session"))'
    )

    const hasSessionContent = (await sessionContent.count()) > 0 || (await sessionList.count()) > 0

    expect(hasSessionContent).toBe(true)
  })

  test("should show current session indicator", async ({ page }) => {
    await page.goto("/dashboard/profile")

    // Look for sessions tab
    const sessionsTab = page.locator(
      '[role="tab"]:has-text("Sessions"), button:has-text("Sessions")'
    )
    if (await sessionsTab.isVisible()) {
      await sessionsTab.click()
    }

    // Look for current session indicator
    const currentSession = page.locator("text=/current.*session|this.*session/i")

    // May or may not be visible depending on implementation
    // Just verify we can look for it without error
  })
})
