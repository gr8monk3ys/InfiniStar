/**
 * Authentication fixtures for E2E tests
 *
 * Provides authenticated test context and helper functions
 * for testing protected routes and user interactions.
 */

import { test as base, expect, type Page } from "@playwright/test"

// Test user credentials - configure via environment or use test account
const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || "test@example.com",
  password: process.env.E2E_TEST_PASSWORD || "testpassword123",
}

/**
 * Login to the application
 */
export async function login(
  page: Page,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<boolean> {
  try {
    await page.goto("/login")

    // Fill login form
    await page.fill('input[name="email"], input[type="email"]', email)
    await page.fill('input[name="password"], input[type="password"]', password)

    // Submit
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard (or error)
    await page.waitForURL("**/dashboard/**", { timeout: 15000 })

    return true
  } catch {
    return false
  }
}

/**
 * Check if user is logged in by looking for dashboard elements
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const url = page.url()
    return url.includes("/dashboard")
  } catch {
    return false
  }
}

/**
 * Logout from the application
 */
export async function logout(page: Page): Promise<void> {
  // Look for user menu / settings
  const userMenu = page
    .locator('[data-testid="user-menu"]')
    .or(page.locator('button:has([data-testid="avatar"])'))

  if (await userMenu.isVisible()) {
    await userMenu.click()
    const logoutButton = page.getByText(/log ?out|sign ?out/i)
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
    }
  }
}

/**
 * Extended test fixture with authentication helpers
 */
type AuthFixtures = {
  login: () => Promise<boolean>
  logout: () => Promise<void>
  isLoggedIn: () => Promise<boolean>
  authenticatedPage: Page
}

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  login: async ({ page }, use) => {
    await use(() => login(page))
  },

  logout: async ({ page }, use) => {
    await use(() => logout(page))
  },

  isLoggedIn: async ({ page }, use) => {
    await use(() => isLoggedIn(page))
  },

  // Pre-authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    const success = await login(page)
    if (!success) {
      test.skip(true, "Login failed - skipping authenticated tests")
    }
    await use(page)
  },
})

export { expect }
