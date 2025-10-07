import { expect, test, type Page } from "@playwright/test"

import { hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

async function openFirstPublicCharacter(page: Page): Promise<boolean> {
  await page.goto("/explore")

  const firstCharacterLink = page.locator('a[href^="/characters/"]').first()
  if ((await firstCharacterLink.count()) === 0) {
    return false
  }

  await firstCharacterLink.click()
  await page.waitForURL(/\/characters\/[^/]+/, { timeout: 20000 })
  return true
}

test.describe("Character Comments (Public)", () => {
  test("should show comment section and sign-in CTA when signed out", async ({ page }) => {
    const opened = await openFirstPublicCharacter(page)
    if (!opened) {
      return
    }

    await expect(page.getByRole("heading", { name: /comments/i }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: /sign in to comment/i })).toBeVisible()
  })
})

if (hasE2EAuthCredentials) {
  test.describe("Character Comments (Authenticated)", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E character comment tests require valid credentials")
    })

    test("should post and delete a comment", async ({ page }) => {
      // Create a fresh public character so the test doesn't depend on pre-seeded data.
      await page.goto("/dashboard/characters/new")
      await page
        .waitForResponse((res) => res.url().includes("/api/csrf") && res.status() === 200, {
          timeout: 10000,
        })
        .catch(() => {})

      const charName = `E2E Comment Character ${Date.now()}`
      await page.locator("input#name").fill(charName)
      await page
        .locator("textarea#systemPrompt")
        .fill("You are a helpful character created by an end-to-end test.")
      await page.getByText(/make character public/i).click()

      await page.getByRole("button", { name: /create character/i }).click()
      await page.waitForURL(/\/characters\/[^/]+/, { timeout: 20000 })

      await expect(page.getByRole("heading", { name: /comments/i }).first()).toBeVisible()

      const commentText = `e2e comment ${Date.now()}`
      const commentInput = page.getByPlaceholder("Share your thoughts...")
      await expect(commentInput).toBeVisible()
      await commentInput.fill(commentText)

      const postButton = page.getByRole("button", { name: /post comment/i })
      await expect(postButton).toBeEnabled()
      await postButton.click()

      const posted = page.getByText(commentText).first()
      await expect(posted).toBeVisible({ timeout: 15000 })

      const postedArticle = page.locator("article", { hasText: commentText }).first()
      const deleteButton = postedArticle.getByRole("button", { name: /delete comment/i })
      await expect(deleteButton).toBeVisible()
      await deleteButton.click()

      await expect(page.getByText(commentText)).toHaveCount(0, { timeout: 15000 })
    })
  })
}
