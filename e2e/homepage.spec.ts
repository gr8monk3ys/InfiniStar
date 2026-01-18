import { expect, test } from "@playwright/test"

test.describe("Homepage", () => {
  test("should load successfully", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/InfiniStar/i)
  })

  test("should have main navigation", async ({ page }) => {
    await page.goto("/")

    // Check for main navigation elements
    const navigation = page.locator("nav").first()
    await expect(navigation).toBeVisible()
  })

  test("should have call-to-action buttons", async ({ page }) => {
    await page.goto("/")

    // Look for common CTA buttons
    const signInButton = page.getByRole("link", { name: /sign in|login/i }).first()
    await expect(signInButton).toBeVisible()
  })

  test("should be responsive on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone size
    await page.goto("/")

    // Page should load and be visible
    await expect(page.locator("body")).toBeVisible()
  })
})

test.describe("Navigation", () => {
  test("should navigate to pricing page", async ({ page }) => {
    await page.goto("/")

    const pricingLink = page.getByRole("link", { name: /pricing/i })
    if (await pricingLink.isVisible()) {
      await pricingLink.click()
      await expect(page.url()).toContain("/pricing")
    }
  })

  test("should navigate to explore page", async ({ page }) => {
    await page.goto("/")

    const exploreLink = page.getByRole("link", { name: /explore/i })
    if (await exploreLink.isVisible()) {
      await exploreLink.click()
      await expect(page.url()).toContain("/explore")
    }
  })
})
