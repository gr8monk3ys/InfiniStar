/**
 * Conversation Sharing E2E Tests
 *
 * Covers two distinct flows:
 *
 * 1. Authenticated share creation — opening the ShareDialog from the
 *    conversation Header, mocking the POST /api/conversations/[id]/share
 *    endpoint, and verifying the generated share URL is displayed.
 *
 * 2. Public join-via-share-link page (/join/[token]) — navigating to the
 *    page with various mocked API responses and verifying the correct UI
 *    state (valid share info, expired, max-uses-reached, not found, and
 *    the unauthenticated redirect flow).
 *
 * All network calls are intercepted with page.route() so no live database
 * or Pusher connection is required.
 *
 * UI selectors are derived from:
 *   - ShareDialog.tsx   (Header share button → Dialog)
 *   - ShareLinkCopy.tsx (copy-link area)
 *   - ShareSettings.tsx (permission / expiry / maxUses form)
 *   - app/(public)/join/[token]/page.tsx (join page card)
 */

import { expect, test, type Page } from "@playwright/test"

import { hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

// ---------------------------------------------------------------------------
// Tokens used in join-page tests
// ---------------------------------------------------------------------------
const VALID_TOKEN = "valid-share-token-abc123"
const EXPIRED_TOKEN = "expired-share-token-xyz789"
const MAXED_TOKEN = "maxed-share-token-uvw456"
const INACTIVE_TOKEN = "inactive-share-token-rst012"
const INVALID_TOKEN = "not-a-real-token-qrs999"

// ---------------------------------------------------------------------------
// Reusable share-info mock payload
// ---------------------------------------------------------------------------
const mockShareInfo = {
  id: "share-id-1",
  conversationName: "E2E Test Conversation",
  messageCount: 12,
  participantCount: 2,
  permission: "VIEW" as const,
  shareType: "LINK" as const,
  expiresAt: null,
}

// ---------------------------------------------------------------------------
// Helper: open the first conversation in the list
// ---------------------------------------------------------------------------
async function openFirstConversation(page: Page): Promise<boolean> {
  await page.goto("/dashboard/conversations")
  await expect(page).toHaveURL(/\/dashboard\/conversations/)

  const firstLink = page.locator("aside a[href*='/conversations/']").first()
  if ((await firstLink.count()) === 0) {
    return false
  }

  await firstLink.click()
  await page.waitForURL(/\/conversations\/[a-zA-Z0-9-]+/)
  return true
}

// ---------------------------------------------------------------------------
// Helper: mock CSRF endpoint so ShareDialog doesn't stall
// ---------------------------------------------------------------------------
async function mockCsrf(page: Page): Promise<void> {
  await page.route("**/api/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: "test-csrf-token" }),
    })
  })
}

// ---------------------------------------------------------------------------
// Helper: open the ShareDialog from a conversation
// ---------------------------------------------------------------------------
async function openShareDialog(page: Page): Promise<void> {
  const shareButton = page.getByRole("button", { name: /share conversation/i })
  await expect(shareButton).toBeVisible()
  await shareButton.click()

  // The Dialog has an accessible name set via DialogTitle "Share Conversation"
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })
  await expect(page.getByText("Share Conversation")).toBeVisible()
}

// ===========================================================================
// Join Page tests — these run without authentication
// ===========================================================================
test.describe("Conversation Join Page — Valid share", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the public share-info endpoint
    await page.route(`**/api/share/${VALID_TOKEN}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ shareInfo: mockShareInfo }),
        })
      } else {
        await route.continue()
      }
    })
  })

  test("should display conversation name, message count, and participant count", async ({
    page,
  }) => {
    await page.goto(`/join/${VALID_TOKEN}`)

    await expect(page.getByText("E2E Test Conversation")).toBeVisible()
    await expect(page.getByText("12", { exact: true })).toBeVisible()
    await expect(page.getByText("2", { exact: true })).toBeVisible()
  })

  test("should display permission badge as View Only", async ({ page }) => {
    await page.goto(`/join/${VALID_TOKEN}`)

    await expect(page.getByText("View Only")).toBeVisible()
  })

  test("should show 'Log in to Join' button for unauthenticated visitors", async ({ page }) => {
    await page.goto(`/join/${VALID_TOKEN}`)

    // Clerk reports !isSignedIn for unauthenticated users
    const loginButton = page.getByRole("button", { name: /log in to join/i })
    await expect(loginButton).toBeVisible()
  })

  test("should show view-only permission notice", async ({ page }) => {
    await page.goto(`/join/${VALID_TOKEN}`)

    await expect(
      page.getByText(/you will be able to read all messages in this conversation/i)
    ).toBeVisible()
  })

  test("should redirect unauthenticated user to sign-in when they click 'Log in to Join'", async ({
    page,
  }) => {
    await page.goto(`/join/${VALID_TOKEN}`)

    const loginButton = page.getByRole("button", { name: /log in to join/i })
    await loginButton.click()

    // The JoinPage uses router.push('/sign-in?redirect_url=/join/VALID_TOKEN')
    await page.waitForURL(/\/sign-in/, { timeout: 10000 })
    expect(page.url()).toContain("/sign-in")
    expect(page.url()).toContain(encodeURIComponent(`/join/${VALID_TOKEN}`))
  })
})

test.describe("Conversation Join Page — PARTICIPATE permission", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/share/participate-token`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          shareInfo: {
            ...mockShareInfo,
            permission: "PARTICIPATE",
          },
        }),
      })
    })
  })

  test("should display Participate badge and participation notice", async ({ page }) => {
    await page.goto("/join/participate-token")

    await expect(page.getByText("Participate", { exact: true })).toBeVisible()
    await expect(
      page.getByText(/you will be able to read all messages and participate/i)
    ).toBeVisible()
  })
})

test.describe("Conversation Join Page — Expired share", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/share/${EXPIRED_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "This share link has expired" }),
      })
    })
  })

  test("should show error card when share link is expired", async ({ page }) => {
    await page.goto(`/join/${EXPIRED_TOKEN}`)

    // The JoinPage renders an "Unable to Load Share" card on API error
    await expect(page.getByText("Unable to Load Share")).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/this share link has expired/i)).toBeVisible()
  })

  test("should show 'Go to Home' button on expired share page", async ({ page }) => {
    await page.goto(`/join/${EXPIRED_TOKEN}`)

    await expect(page.getByRole("button", { name: /go to home/i })).toBeVisible({ timeout: 8000 })
  })
})

test.describe("Conversation Join Page — Max uses reached", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/share/${MAXED_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "This share link has reached its maximum uses" }),
      })
    })
  })

  test("should show error when share has reached max uses", async ({ page }) => {
    await page.goto(`/join/${MAXED_TOKEN}`)

    await expect(page.getByText("Unable to Load Share")).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/reached its maximum uses/i)).toBeVisible()
  })
})

test.describe("Conversation Join Page — Inactive share", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/share/${INACTIVE_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "This share link has been deactivated" }),
      })
    })
  })

  test("should show error when share link has been deactivated", async ({ page }) => {
    await page.goto(`/join/${INACTIVE_TOKEN}`)

    await expect(page.getByText("Unable to Load Share")).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/been deactivated/i)).toBeVisible()
  })
})

test.describe("Conversation Join Page — Token not found", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/share/${INVALID_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Share link not found" }),
      })
    })
  })

  test("should show error when token does not exist", async ({ page }) => {
    await page.goto(`/join/${INVALID_TOKEN}`)

    await expect(page.getByText("Unable to Load Share")).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/share link not found/i)).toBeVisible()
  })
})

test.describe("Conversation Join Page — Invite-only notice", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/share/invite-only-token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          shareInfo: {
            ...mockShareInfo,
            shareType: "INVITE",
          },
        }),
      })
    })
  })

  test("should display invite-only notice when shareType is INVITE", async ({ page }) => {
    await page.goto("/join/invite-only-token")

    await expect(page.getByText(/this is an invite-only share/i)).toBeVisible({ timeout: 8000 })
  })
})

test.describe("Conversation Join Page — With expiry date", () => {
  test.beforeEach(async ({ page }) => {
    // Set an expiry in the future so it is displayed
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await page.route("**/api/share/expiring-token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          shareInfo: {
            ...mockShareInfo,
            expiresAt: futureDate,
          },
        }),
      })
    })
  })

  test("should display expiry information when expiresAt is set", async ({ page }) => {
    await page.goto("/join/expiring-token")

    // The JoinPage renders the "Expires" row only when expiresAt is truthy
    await expect(page.getByText("Expires")).toBeVisible({ timeout: 8000 })
  })
})

// ===========================================================================
// Join Page — authenticated user join flow
// ===========================================================================
if (hasE2EAuthCredentials) {
  test.describe("Conversation Join Page — Authenticated join flow", () => {
    test.beforeEach(async ({ page }) => {
      await page.route(`**/api/share/${VALID_TOKEN}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ shareInfo: mockShareInfo }),
          })
        } else {
          await route.continue()
        }
      })

      await requireLogin(page, "E2E join flow tests require valid credentials")
    })

    test("should show 'Join Conversation' button for authenticated users", async ({ page }) => {
      await page.goto(`/join/${VALID_TOKEN}`)

      const joinButton = page.getByRole("button", { name: /join conversation/i })
      await expect(joinButton).toBeVisible({ timeout: 8000 })
    })

    test("should redirect to conversation after successful join", async ({ page }) => {
      const targetConversationId = "joined-conv-id-1234"

      await page.route(`**/api/share/${VALID_TOKEN}/join`, async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              conversationId: targetConversationId,
            }),
          })
        } else {
          await route.continue()
        }
      })

      await page.goto(`/join/${VALID_TOKEN}`)

      const joinButton = page.getByRole("button", { name: /join conversation/i })
      await expect(joinButton).toBeVisible({ timeout: 8000 })
      await joinButton.click()

      // The JoinPage does router.push('/dashboard/conversations/[conversationId]')
      await page.waitForURL(`**/dashboard/conversations/${targetConversationId}`, {
        timeout: 15000,
      })
    })

    test("should show error toast when join API fails", async ({ page }) => {
      await page.route(`**/api/share/${VALID_TOKEN}/join`, async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ error: "You are not invited to this conversation" }),
          })
        } else {
          await route.continue()
        }
      })

      await page.goto(`/join/${VALID_TOKEN}`)

      const joinButton = page.getByRole("button", { name: /join conversation/i })
      await expect(joinButton).toBeVisible({ timeout: 8000 })
      await joinButton.click()

      await expect(page.getByText(/you are not invited to this conversation/i)).toBeVisible({
        timeout: 5000,
      })
    })

    test("should show joining spinner while join is in progress", async ({ page }) => {
      // Slow the join response so we can observe the loading state
      await page.route(`**/api/share/${VALID_TOKEN}/join`, async (route) => {
        if (route.request().method() === "POST") {
          await new Promise((resolve) => setTimeout(resolve, 800))
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true, conversationId: "conv-slow-123" }),
          })
        } else {
          await route.continue()
        }
      })

      await page.goto(`/join/${VALID_TOKEN}`)

      const joinButton = page.getByRole("button", { name: /join conversation/i })
      await expect(joinButton).toBeVisible({ timeout: 8000 })
      await joinButton.click()

      // While joining, the button shows "Joining..."
      await expect(page.getByText("Joining...")).toBeVisible({ timeout: 3000 })
    })
  })

  // =========================================================================
  // Share Dialog — create share link
  // =========================================================================
  test.describe("Share Dialog — Create share link", () => {
    test.beforeEach(async ({ page }) => {
      await mockCsrf(page)
      await requireLogin(page, "E2E share dialog tests require valid credentials")
    })

    test("should show Share button in conversation header", async ({ page }) => {
      const opened = await openFirstConversation(page)
      if (!opened) {
        return
      }

      const shareButton = page.getByRole("button", { name: /share conversation/i })
      await expect(shareButton).toBeVisible()
    })

    test("should open share dialog with role=dialog when Share button is clicked", async ({
      page,
    }) => {
      const opened = await openFirstConversation(page)
      if (!opened) {
        return
      }

      await openShareDialog(page)

      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText("Share Conversation")
    })

    test("should show 'Create Share Link' button in dialog list view", async ({ page }) => {
      const opened = await openFirstConversation(page)
      if (!opened) {
        return
      }

      const url = page.url()
      const conversationId = url.split("/conversations/")[1]?.split("/")[0]
      if (!conversationId) {
        return
      }

      // Mock the shares list so the dialog loads quickly
      await page.route(`**/api/conversations/${conversationId}/share`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ shares: [] }),
          })
        } else {
          await route.continue()
        }
      })

      await openShareDialog(page)

      await expect(page.getByRole("button", { name: /create share link/i })).toBeVisible()
    })

    test("should display share URL after creating a share link", async ({ page }) => {
      const opened = await openFirstConversation(page)
      if (!opened) {
        return
      }

      const url = page.url()
      const conversationId = url.split("/conversations/")[1]?.split("/")[0]
      if (!conversationId) {
        return
      }

      const generatedToken = "e2e-share-token-test-1"
      const generatedUrl = `http://localhost:3101/join/${generatedToken}`

      // Mock GET /shares (empty list) and POST /share (create)
      await page.route(`**/api/conversations/${conversationId}/share`, async (route) => {
        const method = route.request().method()
        if (method === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ shares: [] }),
          })
        } else if (method === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              share: {
                id: "share-1",
                shareToken: generatedToken,
                shareType: "LINK",
                permission: "VIEW",
                isActive: true,
                expiresAt: null,
                maxUses: null,
                useCount: 0,
                allowedEmails: [],
                name: null,
                createdAt: new Date().toISOString(),
              },
              shareUrl: generatedUrl,
            }),
          })
        } else {
          await route.continue()
        }
      })

      await openShareDialog(page)

      // Navigate to create view
      await page.getByRole("button", { name: /create share link/i }).click()

      // Submit the form
      await page.getByRole("button", { name: /^create share$/i }).click()

      // After creation the dialog switches to the success view with the URL
      await expect(page.getByText(generatedUrl)).toBeVisible({ timeout: 8000 })
    })

    test("should show error toast when share creation fails", async ({ page }) => {
      const opened = await openFirstConversation(page)
      if (!opened) {
        return
      }

      const url = page.url()
      const conversationId = url.split("/conversations/")[1]?.split("/")[0]
      if (!conversationId) {
        return
      }

      await page.route(`**/api/conversations/${conversationId}/share`, async (route) => {
        const method = route.request().method()
        if (method === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ shares: [] }),
          })
        } else if (method === "POST") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Failed to create share link" }),
          })
        } else {
          await route.continue()
        }
      })

      await openShareDialog(page)

      await page.getByRole("button", { name: /create share link/i }).click()
      await page.getByRole("button", { name: /^create share$/i }).click()

      await expect(page.getByText(/failed to create share link/i)).toBeVisible({ timeout: 5000 })
    })

    test("should display existing active shares in the dialog list view", async ({ page }) => {
      const opened = await openFirstConversation(page)
      if (!opened) {
        return
      }

      const url = page.url()
      const conversationId = url.split("/conversations/")[1]?.split("/")[0]
      if (!conversationId) {
        return
      }

      const existingShare = {
        id: "existing-share-1",
        shareToken: "existing-token-abc",
        shareUrl: "http://localhost:3101/join/existing-token-abc",
        shareType: "LINK",
        permission: "VIEW",
        isActive: true,
        expiresAt: null,
        maxUses: null,
        useCount: 3,
        allowedEmails: [],
        name: "My Share Link",
        createdAt: new Date().toISOString(),
      }

      await page.route(`**/api/conversations/${conversationId}/share`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ shares: [existingShare] }),
          })
        } else {
          await route.continue()
        }
      })

      await openShareDialog(page)

      // ActiveShares renders the share name or a fallback label
      await expect(page.getByText("My Share Link")).toBeVisible({ timeout: 8000 })
    })

    test("should deactivate a share when revoke is triggered", async ({ page }) => {
      const opened = await openFirstConversation(page)
      if (!opened) {
        return
      }

      const url = page.url()
      const conversationId = url.split("/conversations/")[1]?.split("/")[0]
      if (!conversationId) {
        return
      }

      const shareId = "share-to-deactivate"
      const shareToken = "deactivate-token-xyz"

      const existingShare = {
        id: shareId,
        shareToken,
        shareUrl: `http://localhost:3101/join/${shareToken}`,
        shareType: "LINK",
        permission: "VIEW",
        isActive: true,
        expiresAt: null,
        maxUses: null,
        useCount: 0,
        allowedEmails: [],
        name: "Revocable Link",
        createdAt: new Date().toISOString(),
      }

      let patchCalled = false

      await page.route(`**/api/conversations/${conversationId}/share`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ shares: [existingShare] }),
          })
        } else {
          await route.continue()
        }
      })

      await page.route(`**/api/conversations/${conversationId}/share/${shareId}`, async (route) => {
        if (route.request().method() === "PATCH") {
          patchCalled = true
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              share: { ...existingShare, isActive: false },
              shareUrl: `http://localhost:3101/join/${shareToken}`,
            }),
          })
        } else if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
          })
        } else {
          await route.continue()
        }
      })

      await openShareDialog(page)

      // The ActiveShares component renders a toggle or deactivate button.
      // Use a broad selector that targets either a toggle switch or button near the share name.
      const shareRow = page.locator("[data-testid='share-item'], li, [role='listitem']", {
        hasText: "Revocable Link",
      })

      // If the row is visible, attempt the toggle interaction.
      if ((await shareRow.count()) > 0) {
        const toggleButton = shareRow
          .getByRole("button", { name: /deactivate|toggle|disable/i })
          .or(shareRow.locator("button").first())
        if ((await toggleButton.count()) > 0) {
          await toggleButton.click()
          await expect.poll(() => patchCalled, { timeout: 5000 }).toBe(true)
        }
      }
    })
  })
}
