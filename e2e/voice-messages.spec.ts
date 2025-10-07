/**
 * Voice message E2E tests.
 *
 * These tests use browser-side stubs for MediaRecorder and mock network calls for:
 * - Cloudinary upload
 * - OpenAI transcription endpoint
 * - AI chat streaming endpoint
 *
 * They validate that the UI wiring works end-to-end without requiring live AI credentials.
 */

import { expect, test, type Page } from "@playwright/test"

import { hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

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
  test.describe("Voice Messages", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        const fakeTrack = { stop: () => {} }
        const fakeStream = { getTracks: () => [fakeTrack] }

        // Provide a predictable mediaDevices implementation.
        const mediaDevices = {
          getUserMedia: async () => fakeStream,
        }

        Object.defineProperty(navigator, "mediaDevices", {
          value: mediaDevices,
          configurable: true,
        })

        class FakeMediaRecorder {
          stream: unknown
          mimeType = "audio/webm"
          ondataavailable: ((event: { data: Blob }) => void) | null = null
          onstop: (() => void) | null = null

          constructor(stream: unknown) {
            this.stream = stream
          }

          start() {
            // Emit a single chunk >1KB so the app accepts it as a valid voice message.
            setTimeout(() => {
              const bytes = new Uint8Array(2048)
              const blob = new Blob([bytes], { type: this.mimeType })
              this.ondataavailable?.({ data: blob })
            }, 50)
          }

          stop() {
            setTimeout(() => {
              this.onstop?.()
            }, 50)
          }
        }

        Object.defineProperty(window, "MediaRecorder", {
          value: FakeMediaRecorder,
          configurable: true,
        })
      })

      await requireLogin(page, "E2E voice message tests require valid credentials")
    })

    test("should record and send a voice message (mocked)", async ({ page }) => {
      let cloudinaryHit = false
      let transcribeHit = false
      let chatStreamHit = false

      await page.route("https://api.cloudinary.com/**/video/upload", async (route) => {
        cloudinaryHit = true
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            secure_url:
              "https://res.cloudinary.com/demo/video/upload/v123/infinistar/voice/voice-message.webm",
          }),
        })
      })

      await page.route("**/api/ai/transcribe", async (route) => {
        transcribeHit = true
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ transcript: "e2e voice transcript ok" }),
        })
      })

      await page.route("**/api/ai/chat-stream", async (route) => {
        chatStreamHit = true
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body: `data: ${JSON.stringify({ type: "done", messageId: "msg-1" })}\n\n`,
        })
      })

      await createAiConversation(page)

      // Best-effort: ensure CSRF token fetch has had a chance to resolve.
      await page
        .waitForResponse((res) => res.url().includes("/api/csrf") && res.status() === 200, {
          timeout: 10000,
        })
        .catch(() => {})

      const recordButton = page.getByRole("button", { name: /record voice message/i })
      await expect(recordButton).toBeVisible()
      await recordButton.click()

      const stopButton = page.getByRole("button", { name: /stop voice message recording/i })
      await expect(stopButton).toBeVisible()

      // Allow time for the fake recorder to emit a chunk.
      await page.waitForTimeout(150)
      await stopButton.click()

      // Verify network wiring occurred.
      await expect.poll(() => cloudinaryHit).toBe(true)
      await expect.poll(() => transcribeHit).toBe(true)
      await expect.poll(() => chatStreamHit).toBe(true)
    })
  })
}
