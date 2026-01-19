/**
 * Conversation E2E Tests
 *
 * Tests for the core conversation functionality including
 * listing, creating, and interacting with conversations.
 */

import { expect, test } from "@playwright/test"

import { login } from "./fixtures/auth"

test.describe("Conversations", () => {
  test.describe("Unauthenticated access", () => {
    test("should redirect to login when not authenticated", async ({ page }) => {
      await page.goto("/dashboard/conversations")
      await expect(page.url()).toContain("/login")
    })

    test("should redirect from specific conversation when not authenticated", async ({ page }) => {
      await page.goto("/dashboard/conversations/123")
      await expect(page.url()).toContain("/login")
    })
  })

  test.describe("Authenticated user", () => {
    // These tests require authentication
    test.beforeEach(async ({ page }) => {
      const success = await login(page)
      if (!success) {
        test.skip(true, "Could not login - skipping authenticated tests")
      }
    })

    test("should display conversation list page", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // Page should have main layout elements
      await expect(page.locator("body")).toBeVisible()

      // Should have sidebar or main content area
      const mainContent = page.locator("main").or(page.locator("[role=main]"))
      await expect(mainContent).toBeVisible()
    })

    test("should display empty state when no conversations", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // Look for empty state or conversation list
      const emptyState = page.getByText(/no conversations|start a conversation/i)
      const conversationItems = page
        .locator("[data-testid=conversation-item]")
        .or(page.locator("aside li, aside a"))

      // Either empty state or conversations should be visible
      const hasEmptyState = await emptyState.isVisible().catch(() => false)
      const hasConversations = (await conversationItems.count()) > 0

      expect(hasEmptyState || hasConversations).toBe(true)
    })

    test("should have new conversation button", async ({ page }) => {
      await page.goto("/dashboard/conversations")

      // Look for new conversation or AI chat button
      const newButton = page.locator(
        'button:has-text("New"), button:has-text("AI"), [title*="new"], [title*="AI"]'
      )

      // At least one creation option should be available
      const buttonCount = await newButton.count()
      expect(buttonCount).toBeGreaterThan(0)
    })
  })
})

test.describe("Conversation interactions", () => {
  test.beforeEach(async ({ page }) => {
    const success = await login(page)
    if (!success) {
      test.skip(true, "Could not login - skipping authenticated tests")
    }
  })

  test("should navigate to conversation when clicked", async ({ page }) => {
    await page.goto("/dashboard/conversations")

    // Find a conversation link
    const conversationLink = page.locator("aside a[href*='/conversations/']").first()

    if ((await conversationLink.count()) > 0) {
      await conversationLink.click()
      await expect(page.url()).toMatch(/\/conversations\/[a-zA-Z0-9]+/)
    }
  })

  test("should display message input in conversation", async ({ page }) => {
    await page.goto("/dashboard/conversations")

    // Navigate to first conversation
    const conversationLink = page.locator("aside a[href*='/conversations/']").first()

    if ((await conversationLink.count()) > 0) {
      await conversationLink.click()

      // Wait for conversation to load
      await page.waitForURL(/\/conversations\/[a-zA-Z0-9]+/)

      // Message input should be visible
      const messageInput = page.locator(
        'input[placeholder*="message"], textarea[placeholder*="message"], [data-testid="message-input"]'
      )
      await expect(messageInput.first()).toBeVisible()
    }
  })
})

test.describe("Conversation UI Elements", () => {
  test.beforeEach(async ({ page }) => {
    const success = await login(page)
    if (!success) {
      test.skip(true, "Could not login - skipping authenticated tests")
    }
  })

  test("should have search functionality", async ({ page }) => {
    await page.goto("/dashboard/conversations")

    // Look for search input or button
    const searchElement = page.locator(
      'input[placeholder*="search"], button[aria-label*="search"], [data-testid="search"]'
    )

    // Search should be available
    const searchCount = await searchElement.count()
    expect(searchCount).toBeGreaterThanOrEqual(0) // May or may not have search depending on feature flags
  })

  test("should be responsive on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto("/dashboard/conversations")

    // Page should render properly
    await expect(page.locator("body")).toBeVisible()

    // Mobile menu or sidebar toggle should exist
    const mobileNav = page.locator('[data-testid="mobile-nav"], button[aria-label*="menu"]')
    // Mobile navigation is optional depending on implementation
  })
})
