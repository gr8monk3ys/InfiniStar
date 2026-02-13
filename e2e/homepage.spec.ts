import { expect, test } from "@playwright/test"

test.describe("Homepage", () => {
  test("should load successfully", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Infinistar/i)
  })

  test("should have main navigation", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("link", { name: /pricing/i }).first()).toBeVisible()
  })

  test("should have call-to-action buttons", async ({ page }) => {
    await page.goto("/")

    const ctaButton = page
      .getByRole("link", { name: /start chatting free|get started free|explore characters/i })
      .first()
    await expect(ctaButton).toBeVisible()
  })

  test("should be responsive on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone size
    await page.goto("/")

    // Page should load and be visible
    await expect(page.locator("body")).toBeVisible()
  })
})

test.describe("Navigation", () => {
  test("should expose pricing link", async ({ page }) => {
    await page.goto("/")

    const pricingLink = page.locator('a[href="/pricing"]:visible').first()
    await expect(pricingLink).toBeVisible()
    await expect(pricingLink).toHaveAttribute("href", "/pricing")
  })

  test("should expose explore link", async ({ page }) => {
    await page.goto("/")

    const exploreLink = page.locator('a[href="/explore"]:visible').first()
    await expect(exploreLink).toBeVisible()
    await expect(exploreLink).toHaveAttribute("href", "/explore")
  })
})
