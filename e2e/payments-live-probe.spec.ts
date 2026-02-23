import { expect, test } from "@playwright/test"

import { getMissingAuthCredentialNames, hasE2EAuthCredentials, requireLogin } from "./fixtures/auth"

test.describe("Payments Live Probe", () => {
  test.skip(
    !hasE2EAuthCredentials,
    `Missing auth credentials: ${getMissingAuthCredentialNames().join(", ")}`
  )

  test("checkout and portal endpoints respond as expected for authenticated user", async ({
    page,
  }) => {
    await requireLogin(page, "Live payments probe requires valid credentials")

    const result = await page.evaluate(async () => {
      const csrfRes = await fetch("/api/csrf")
      const csrfJson = (await csrfRes.json()) as { token?: string }
      const token = csrfJson.token ?? ""

      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: "{}",
      })
      const checkoutText = await checkoutRes.text()

      const portalRes = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: "{}",
      })
      const portalText = await portalRes.text()

      return {
        checkoutStatus: checkoutRes.status,
        checkoutBody: checkoutText,
        portalStatus: portalRes.status,
        portalBody: portalText,
      }
    })

    expect([200, 400]).toContain(result.checkoutStatus)
    expect([200, 400]).toContain(result.portalStatus)

    if (result.checkoutStatus === 200) {
      const checkoutJson = JSON.parse(result.checkoutBody) as { url?: string }
      expect(checkoutJson.url).toMatch(/^https:\/\/checkout\.stripe\.com\//)
    }

    if (result.portalStatus === 200) {
      const portalJson = JSON.parse(result.portalBody) as { url?: string }
      expect(portalJson.url).toMatch(/^https:\/\/billing\.stripe\.com\//)
    }
  })
})
