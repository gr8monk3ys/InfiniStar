import { expect, type Page } from "@playwright/test"

// Test user credentials - configure via environment or use test account
const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL,
  password: process.env.E2E_TEST_PASSWORD,
}

export const hasE2EAuthCredentials = Boolean(TEST_USER.email && TEST_USER.password)

/**
 * Login to the application
 */
export async function login(
  page: Page,
  email: string | undefined = TEST_USER.email,
  password: string | undefined = TEST_USER.password
): Promise<boolean> {
  if (!email || !password) {
    return false
  }

  try {
    await page.goto("/sign-in?redirect_url=%2Fdashboard%2Fconversations")

    // Clerk can run either a one-step email+password form or a two-step flow
    // that asks for identifier first and password second.
    const identifierInput = page
      .locator(
        'input[name="identifier"]:visible, input[name="emailAddress"]:visible, input[type="email"]:visible'
      )
      .first()
    await identifierInput.waitFor({ timeout: 7000 })
    await identifierInput.fill(email)

    const continueButton = page.getByRole("button", { name: /^continue$/i }).first()
    await continueButton.click()

    const passwordInput = page
      .locator('input[name="password"]:visible, input[type="password"]:visible')
      .first()
    await passwordInput.waitFor({ timeout: 7000 })
    await passwordInput.fill(password)
    await continueButton.click()

    // Wait for redirect to dashboard (or error)
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 15000 })

    return true
  } catch {
    return false
  }
}

export async function requireLogin(page: Page, reason = "E2E login failed"): Promise<void> {
  const success = await login(page)
  expect(success, reason).toBe(true)
}

export function getMissingAuthCredentialNames(): string[] {
  const missing: string[] = []
  if (!TEST_USER.email) {
    missing.push("E2E_TEST_EMAIL")
  }
  if (!TEST_USER.password) {
    missing.push("E2E_TEST_PASSWORD")
  }
  return missing
}
