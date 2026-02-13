/**
 * AI Chat E2E tests.
 *
 * Authenticated suites only register when E2E credentials are provided.
 * Live response tests are additionally gated by E2E_RUN_LIVE_AI=true.
 */

import { expect, test, type Page } from "@playwright/test"

import { hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

const runLiveAI = process.env.E2E_RUN_LIVE_AI === "true"

async function openConversationList(page: Page): Promise<void> {
  await page.goto("/dashboard/conversations")
  await expect(page).toHaveURL(/\/dashboard\/conversations/)
}

async function openAiCreationModal(page: Page): Promise<void> {
  await openConversationList(page)

  const aiButton = page
    .getByRole("button", { name: /start new ai chat/i })
    .or(page.locator('button[title="New AI Chat"]').first())

  await expect(aiButton.first()).toBeVisible()
  await aiButton.first().click()

  await expect(page.getByRole("heading", { name: /create ai conversation/i })).toBeVisible()
}

async function createAiConversation(page: Page): Promise<void> {
  await openAiCreationModal(page)

  await page.getByRole("button", { name: /create ai chat/i }).click()
  await page.waitForURL(/\/dashboard\/conversations\/[a-zA-Z0-9-]+/, { timeout: 20000 })
}

if (hasE2EAuthCredentials) {
  test.describe("AI Chat Feature", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "E2E AI chat tests require valid credentials")
    })

    test("should open AI creation modal from conversations", async ({ page }) => {
      await openAiCreationModal(page)
    })

    test("should allow choosing a model when creating AI chat", async ({ page }) => {
      await openAiCreationModal(page)

      const modelLabel = page.getByText(/AI Model/i).first()
      await expect(modelLabel).toBeVisible()
      await expect(page.getByText(/Recommended/i).first()).toBeVisible()
    })

    test("should create a new AI conversation", async ({ page }) => {
      await createAiConversation(page)

      const messageInput = page
        .locator('textarea[placeholder*="Ask me anything"], textarea[placeholder*="message"]')
        .first()
      await expect(messageInput).toBeVisible()
    })
  })
}

if (hasE2EAuthCredentials && runLiveAI) {
  test.describe("AI Chat Live Interaction", () => {
    test.beforeEach(async ({ page }) => {
      await requireLogin(page, "Live AI tests require valid credentials and runtime AI access")
    })

    test("should send a message and eventually render AI output", async ({ page }) => {
      await createAiConversation(page)

      const messageInput = page
        .locator('textarea[placeholder*="Ask me anything"], textarea[placeholder*="message"]')
        .first()
      await messageInput.fill("Respond with the exact phrase: e2e-live-ai-ok")
      await page.getByRole("button", { name: /send message to ai/i }).click()

      await expect(page.getByText(/e2e-live-ai-ok/i).first()).toBeVisible({ timeout: 45000 })
    })
  })
}
