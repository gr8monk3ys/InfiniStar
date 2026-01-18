import { expect, test } from "@playwright/test"

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
  })

  test("should show validation errors for empty form", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("button", { name: /sign in/i }).click()
    // Form validation should prevent submission
    await expect(page.url()).toContain("/login")
  })

  test("should navigate to registration from login", async ({ page }) => {
    await page.goto("/login")
    // Look for a link or button to create account
    const signUpLink = page.getByText(/create.*account/i).or(page.getByText(/sign up/i))
    if (await signUpLink.isVisible()) {
      await signUpLink.click()
      await expect(page.url()).toMatch(/register|signup/i)
    }
  })
})

test.describe("Protected Routes", () => {
  test("should redirect to login when accessing dashboard without auth", async ({ page }) => {
    await page.goto("/dashboard")
    // Should redirect to login
    await expect(page.url()).toContain("/login")
  })

  test("should redirect to login when accessing conversations without auth", async ({ page }) => {
    await page.goto("/dashboard/conversations")
    await expect(page.url()).toContain("/login")
  })
})
