import { expect, test } from "@playwright/test"

test.describe("Pricing Page", () => {
  test("should load public pricing content", async ({ page }) => {
    await page.goto("/pricing")

    await expect(page).toHaveTitle(/pricing|infinistar/i)
    await expect(page.getByRole("heading", { name: /simple, transparent pricing/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /free/i }).first()).toBeVisible()
    await expect(page.getByRole("heading", { name: /pro/i }).first()).toBeVisible()
  })

  test("should show signed-out upgrade CTA links to sign-in", async ({ page }) => {
    await page.goto("/pricing")

    const upgradeLink = page.getByRole("link", { name: /upgrade to pro/i }).first()
    await expect(upgradeLink).toBeVisible()
    await expect(upgradeLink).toHaveAttribute("href", "/sign-in")
  })

  test("should render FAQ section", async ({ page }) => {
    await page.goto("/pricing")

    await expect(page.getByRole("heading", { name: /frequently asked questions/i })).toBeVisible()
    await expect(page.getByText(/can i switch plans anytime/i)).toBeVisible()
  })
})

test.describe("Homepage to Pricing Navigation", () => {
  test("should navigate to pricing from homepage", async ({ page }) => {
    await page.goto("/")

    const pricingLink = page.locator('a[href="/pricing"]:visible').first()
    await expect(pricingLink).toBeVisible()
    await pricingLink.click()

    await expect(page).toHaveURL(/\/pricing$/)
    await expect(page.getByRole("heading", { name: /simple, transparent pricing/i })).toBeVisible()
  })
})
