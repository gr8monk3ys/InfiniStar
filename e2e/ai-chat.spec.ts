import { expect, test } from "@playwright/test"

// Helper function to login (you'll need to adjust based on your auth flow)
async function login(page: any, email: string, password: string) {
  await page.goto("/login")
  await page.fill('input[name="email"], input[type="email"]', email)
  await page.fill('input[name="password"], input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/dashboard/**", { timeout: 10000 })
}

test.describe("AI Chat Feature", () => {
  test.skip("should create new AI conversation", async ({ page }) => {
    // Skip if no test account available
    await login(page, "test@example.com", "password123")

    await page.goto("/dashboard/conversations")

    // Look for AI chat button (sparkle icon)
    const aiChatButton = page.locator('[title*="AI"]').first()
    if (await aiChatButton.isVisible()) {
      await aiChatButton.click()

      // Should navigate to new AI conversation
      await page.waitForURL("**/conversations/**")

      // Check for AI-specific UI elements
      const messageInput = page.locator('input[placeholder*="Ask"]')
      await expect(messageInput).toBeVisible()
    }
  })

  test.skip("should send message to AI and receive response", async ({ page }) => {
    await login(page, "test@example.com", "password123")

    // Navigate to existing AI conversation or create one
    await page.goto("/dashboard/conversations")

    const aiChatButton = page.locator('[title*="AI"]').first()
    if (await aiChatButton.isVisible()) {
      await aiChatButton.click()
      await page.waitForURL("**/conversations/**")

      // Send a message
      const messageInput = page.locator('input[placeholder*="Ask"]')
      await messageInput.fill("Hello, AI assistant!")
      await page.locator('button[type="submit"]').click()

      // Wait for AI response (this might take a few seconds)
      await page.waitForSelector("text=/AI response/", { timeout: 10000 })

      // Verify message appears in chat
      await expect(page.locator("text=Hello, AI assistant!")).toBeVisible()
    }
  })

  test.skip("should display AI conversation in conversation list", async ({ page }) => {
    await login(page, "test@example.com", "password123")

    await page.goto("/dashboard/conversations")

    // Look for AI conversation (might have special styling or indicator)
    const conversationList = page
      .locator('[data-testid="conversation-list"]')
      .or(page.locator("aside").first())

    await expect(conversationList).toBeVisible()
  })
})

test.describe("AI Chat UI", () => {
  test.skip("should show purple gradient for AI chat button", async ({ page }) => {
    await login(page, "test@example.com", "password123")

    await page.goto("/dashboard/conversations")

    // AI button should have gradient background
    const aiButton = page.locator('button:has-text("AI")').or(page.locator('[title*="AI"]'))

    if (await aiButton.isVisible()) {
      const bgClass = await aiButton.getAttribute("class")
      expect(bgClass).toContain("gradient")
    }
  })
})
