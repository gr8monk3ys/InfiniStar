import { expect, test } from "@playwright/test"

const hasAuthUiEnvironment = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
const assertAuthRedirects = process.env.E2E_ASSERT_AUTH_REDIRECTS === "true"

if (hasAuthUiEnvironment) {
  test.describe("Authentication", () => {
    test("should display sign-in page", async ({ page }) => {
      await page.goto("/sign-in")
      await expect(page).toHaveURL(/\/sign-in/)
      await expect(page.locator("body")).toBeVisible()
    })

    test("should render auth page shell", async ({ page }) => {
      await page.goto("/sign-in")
      await expect(page.locator("main, body")).toBeVisible()
    })

    test("should display sign-up page", async ({ page }) => {
      await page.goto("/sign-up")
      await expect(page).toHaveURL(/\/sign-up/)
    })
  })
}

if (assertAuthRedirects) {
  test.describe("Protected Routes", () => {
    test("should redirect to sign-in when accessing dashboard without auth", async ({ page }) => {
      await page.goto("/dashboard")
      await expect(page.url()).toContain("/sign-in")
    })

    test("should redirect to sign-in when accessing conversations without auth", async ({
      page,
    }) => {
      await page.goto("/dashboard/conversations")
      await expect(page.url()).toContain("/sign-in")
    })
  })
}
