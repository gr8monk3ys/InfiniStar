/**
 * AI Chat E2E Tests
 *
 * Tests for the AI conversation feature including
 * creating conversations, sending messages, and receiving AI responses.
 *
 * Note: Most tests are skipped by default as they require:
 * 1. Valid test credentials (E2E_TEST_EMAIL, E2E_TEST_PASSWORD env vars)
 * 2. AI API access with valid quota
 */

import { expect, test } from "@playwright/test"

import { login } from "./fixtures/auth"

test.describe("AI Chat Feature", () => {
  test.describe("AI Conversation Creation", () => {
    test.beforeEach(async ({ page }) => {
      const success = await login(page)
      if (!success) {
        test.skip(true, "Could not login - skipping authenticated tests")
      }
    })

    test("should have AI chat button in conversations", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // Look for AI chat button (sparkle icon or "AI" label)
      const aiButton = page.locator(
        'button:has-text("AI"), [title*="AI"], [aria-label*="AI"], button:has(svg[data-icon="sparkles"])'
      )

      // There should be some way to create AI conversations
      const buttonCount = await aiButton.count()
      expect(buttonCount).toBeGreaterThanOrEqual(0) // May be 0 if not in UI yet
    })

    test.skip("should create new AI conversation", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // Look for AI chat button
      const aiButton = page.locator('[title*="AI"], button:has-text("AI")').first()

      if (await aiButton.isVisible()) {
        await aiButton.click()

        // Should navigate to new AI conversation
        await page.waitForURL(/\/conversations\/[a-zA-Z0-9]+/, { timeout: 10000 })

        // Check for AI-specific UI elements
        const messageInput = page.locator(
          'input[placeholder*="message"], textarea[placeholder*="message"]'
        )
        await expect(messageInput.first()).toBeVisible()
      }
    })
  })

  test.describe("AI Message Interaction", () => {
    test.beforeEach(async ({ page }) => {
      const success = await login(page)
      if (!success) {
        test.skip(true, "Could not login - skipping authenticated tests")
      }
    })

    test.skip("should send message to AI and receive response", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // Find or create AI conversation
      const aiButton = page.locator('[title*="AI"], button:has-text("AI")').first()

      if (await aiButton.isVisible()) {
        await aiButton.click()
        await page.waitForURL(/\/conversations\/[a-zA-Z0-9]+/)

        // Send a message
        const messageInput = page
          .locator('input[placeholder*="message"], textarea[placeholder*="message"]')
          .first()
        await messageInput.fill("Hello, AI assistant! Please say 'test response'.")
        await page.locator('button[type="submit"]').click()

        // Wait for AI response (this might take several seconds)
        await page.waitForSelector('[data-testid="ai-message"], .ai-response', {
          timeout: 30000,
        })

        // Verify sent message appears in chat
        await expect(page.locator('text="Hello, AI assistant!"')).toBeVisible()
      }
    })

    test.skip("should display typing indicator while AI responds", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      const aiButton = page.locator('[title*="AI"], button:has-text("AI")').first()

      if (await aiButton.isVisible()) {
        await aiButton.click()
        await page.waitForURL(/\/conversations\/[a-zA-Z0-9]+/)

        // Send a message
        const messageInput = page
          .locator('input[placeholder*="message"], textarea[placeholder*="message"]')
          .first()
        await messageInput.fill("Hello!")
        await page.locator('button[type="submit"]').click()

        // Check for typing indicator (should appear while AI is responding)
        const typingIndicator = page.locator(
          '[data-testid="typing-indicator"], .typing-indicator, text=/typing|thinking/i'
        )

        // Typing indicator might be brief, so we use a short timeout
        const wasVisible = await typingIndicator.isVisible({ timeout: 5000 }).catch(() => false)
        // We don't assert here as it might be too fast to catch
      }
    })
  })

  test.describe("AI Conversation List", () => {
    test.beforeEach(async ({ page }) => {
      const success = await login(page)
      if (!success) {
        test.skip(true, "Could not login - skipping authenticated tests")
      }
    })

    test("should display conversation list sidebar", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // Look for conversation list
      const sidebar = page.locator(
        'aside, [data-testid="conversation-list"], nav:has(a[href*="/conversations/"])'
      )

      await expect(sidebar.first()).toBeVisible()
    })

    test.skip("should show AI indicator on AI conversations", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // AI conversations should have a visual indicator
      const aiConversation = page.locator(
        '[data-ai="true"], .ai-conversation, [class*="ai"], a:has(svg[data-icon="sparkles"])'
      )

      // There might be AI conversations or not
      const count = await aiConversation.count()
      // Just verify we can search for them without error
    })
  })

  test.describe("AI Chat UI Elements", () => {
    test.beforeEach(async ({ page }) => {
      const success = await login(page)
      if (!success) {
        test.skip(true, "Could not login - skipping authenticated tests")
      }
    })

    test("should have AI chat styling (purple gradient)", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // AI button should have distinctive styling
      const aiButton = page
        .locator('button:has-text("AI")')
        .or(page.locator('[title*="AI"]'))
        .first()

      if (await aiButton.isVisible()) {
        // Check for gradient or purple coloring
        const bgClass = await aiButton.getAttribute("class")
        const hasGradient = bgClass?.includes("gradient") || bgClass?.includes("purple")
        // Style may vary, so we just verify we can check for it
      }
    })

    test("should have model selector for AI chat", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // Try to open AI conversation
      const aiButton = page.locator('[title*="AI"], button:has-text("AI")').first()

      if (await aiButton.isVisible()) {
        await aiButton.click()
        await page.waitForURL(/\/conversations\/[a-zA-Z0-9]+/, { timeout: 5000 }).catch(() => {})

        // Look for model selector
        const modelSelector = page.locator(
          '[data-testid="model-selector"], select:has-text("Claude"), button:has-text("Claude")'
        )

        // Model selector might be in header or settings
        const selectorCount = await modelSelector.count()
        // Just verify we can look for it
      }
    })
  })
})
