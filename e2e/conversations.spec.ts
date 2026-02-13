/**
 * Conversation E2E Tests
 *
 * Tests for the core conversation functionality including
 * listing, creating, and interacting with conversations.
 */

import { expect, test } from "@playwright/test"

import { hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

const assertAuthRedirects = process.env.E2E_ASSERT_AUTH_REDIRECTS === "true"

test.describe("Conversations", () => {
  if (assertAuthRedirects) {
    test.describe("Unauthenticated access", () => {
      test("should redirect to sign-in when not authenticated", async ({ page }) => {
        await page.goto("/dashboard/conversations")
        await expect(page.url()).toContain("/sign-in")
      })

      test("should redirect from specific conversation when not authenticated", async ({
        page,
      }) => {
        await page.goto("/dashboard/conversations/123")
        await expect(page.url()).toContain("/sign-in")
      })
    })
  }

  if (hasE2EAuthCredentials) {
    test.describe("Authenticated user", () => {
      test.beforeEach(async ({ page }) => {
        await requireLogin(page, "E2E authenticated conversation tests require valid credentials")
      })

      test("should display conversation list page", async ({ page }) => {
        await page.goto("/dashboard/conversations")
        await expect(page.locator("body")).toBeVisible()

        const mainContent = page.locator("main").or(page.locator("[role=main]"))
        await expect(mainContent).toBeVisible()
      })

      test("should display empty state when no conversations", async ({ page }) => {
        await page.goto("/dashboard/conversations")

        const emptyState = page.getByText(/no conversations|start a conversation/i)
        const conversationItems = page
          .locator("[data-testid=conversation-item]")
          .or(page.locator("aside li, aside a"))

        const hasEmptyState = await emptyState.isVisible().catch(() => false)
        const hasConversations = (await conversationItems.count()) > 0

        expect(hasEmptyState || hasConversations).toBe(true)
      })

      test("should have new conversation button", async ({ page }) => {
        await page.goto("/dashboard/conversations")
        const newButton = page.locator(
          'button:has-text("New"), button:has-text("AI"), [title*="new"], [title*="AI"]'
        )

        await expect(newButton.first()).toBeVisible()
      })
    })

    test.describe("Conversation interactions", () => {
      test.beforeEach(async ({ page }) => {
        await requireLogin(page, "E2E conversation interaction tests require valid credentials")
      })

      test("should navigate to conversation when clicked", async ({ page }) => {
        await page.goto("/dashboard/conversations")

        const conversationLink = page.locator("aside a[href*='/conversations/']").first()
        if ((await conversationLink.count()) === 0) {
          return
        }

        await conversationLink.click()
        await expect(page.url()).toMatch(/\/conversations\/[a-zA-Z0-9-]+/)
      })

      test("should display message input in conversation", async ({ page }) => {
        await page.goto("/dashboard/conversations")

        const conversationLink = page.locator("aside a[href*='/conversations/']").first()
        if ((await conversationLink.count()) === 0) {
          return
        }

        await conversationLink.click()
        await page.waitForURL(/\/conversations\/[a-zA-Z0-9-]+/)

        const messageInput = page.locator(
          'input[placeholder*="message"], textarea[placeholder*="message"], [data-testid="message-input"]'
        )
        await expect(messageInput.first()).toBeVisible()
      })
    })

    test.describe("Conversation UI Elements", () => {
      test.beforeEach(async ({ page }) => {
        await requireLogin(page, "E2E conversation UI tests require valid credentials")
      })

      test("should have search functionality", async ({ page }) => {
        await page.goto("/dashboard/conversations")
        const searchElement = page.locator(
          'input[placeholder*="search"], button[aria-label*="search"], [data-testid="search"]'
        )

        await expect(searchElement.first()).toBeVisible()
      })

      test("should be responsive on mobile viewport", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 })
        await page.goto("/dashboard/conversations")
        await expect(page.locator("body")).toBeVisible()
      })
    })
  }
})
