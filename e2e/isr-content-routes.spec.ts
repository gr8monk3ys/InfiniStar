import { expect, test, type Page } from "@playwright/test"

/**
 * The public content routes are prerendered (ISR); the per-viewer parts are
 * resolved after hydration from `/api/auth/session`. These tests need a
 * database with a mature character and two fallback-auth users, so they run
 * only when the environment names them:
 *
 *   E2E_MATURE_CHARACTER_SLUG   a public character with isNsfw=true
 *   E2E_ADULT_EMAIL/PASSWORD    a user with isAdult + nsfwEnabled (fallback auth)
 *   E2E_PLAIN_EMAIL/PASSWORD    a user without the preference (fallback auth)
 *   E2E_MATURE_SENTINEL         text that appears only in the unlocked body
 *
 * The app must be started with ENABLE_FALLBACK_AUTH=1.
 */
const slug = process.env.E2E_MATURE_CHARACTER_SLUG
const sentinel = process.env.E2E_MATURE_SENTINEL
const adult = { email: process.env.E2E_ADULT_EMAIL, password: process.env.E2E_ADULT_PASSWORD }
const plain = { email: process.env.E2E_PLAIN_EMAIL, password: process.env.E2E_PLAIN_PASSWORD }

const configured = Boolean(slug && sentinel && adult.email && adult.password)

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error" && /react|hydrat|minified/i.test(message.text())) {
      errors.push(`console: ${message.text()}`)
    }
  })
  return errors
}

async function signInWithFallback(page: Page, email: string, password: string) {
  const csrf = await page.request.get("/api/csrf")
  expect(csrf.ok()).toBe(true)
  const { token } = (await csrf.json()) as { token: string }
  const response = await page.request.post("/api/auth/fallback/sign-in", {
    headers: { "X-CSRF-Token": token },
    data: { email, password },
  })
  expect(response.ok(), await response.text()).toBe(true)
}

/** Navigate and wait for the client's session fetch, armed before the navigation so a fast answer is not missed. */
async function gotoAndWaitForSession(page: Page, path: string) {
  const session = page.waitForResponse((r) => r.url().includes("/api/auth/session") && r.ok())
  await page.goto(path)
  await session
}

test.describe("prerendered mature character page", () => {
  test.skip(!configured, "needs a seeded mature character and fallback-auth users")

  test("shows the gate signed out; the document carries no mature content", async ({ page }) => {
    const errors = collectErrors(page)

    const raw = await page.request.get(`/characters/${slug}`)
    expect(raw.ok()).toBe(true)
    const html = await raw.text()
    expect(html).not.toContain(sentinel as string)
    // Served from the ISR cache: only prerendered routes carry this header. A
    // cold `next start` answers STALE (and omits Cache-Control) until the
    // background revalidation lands; a warm one answers HIT with s-maxage=3600.
    expect(raw.headers()["x-nextjs-cache"]).toMatch(/^(HIT|MISS|STALE)$/)

    await gotoAndWaitForSession(page, `/characters/${slug}`)

    const gate = page.getByTestId("mature-character-gate")
    await expect(gate).toBeVisible()
    await expect(gate.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/sign-in")
    await expect(page.getByText(sentinel as string)).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test("unlocks for a user with the preference, after hydration, without a navigation", async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await signInWithFallback(page, adult.email as string, adult.password as string)

    // Still no mature content in the cached document, even for this viewer.
    const raw = await page.request.get(`/characters/${slug}`)
    expect(await raw.text()).not.toContain(sentinel as string)

    await page.goto(`/characters/${slug}`)

    await expect(page.getByRole("heading", { level: 1, name: sentinel as string })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByTestId("mature-character-gate")).toHaveCount(0)
    // The unlocked body is interactive: the like button rendered by the server
    // action is hydrated and reports its state.
    await expect(page.getByRole("button", { name: /like character/i })).toBeVisible()
    expect(errors).toEqual([])
  })

  test("stays gated for a signed-in user without the preference", async ({ page }) => {
    test.skip(!plain.email || !plain.password, "needs a plain fallback-auth user")
    const errors = collectErrors(page)
    await signInWithFallback(page, plain.email as string, plain.password as string)

    await gotoAndWaitForSession(page, `/characters/${slug}`)

    const gate = page.getByTestId("mature-character-gate")
    await expect(gate).toBeVisible()
    await expect(gate.getByRole("link", { name: "Open Safety Settings" })).toHaveAttribute(
      "href",
      "/dashboard/profile"
    )
    await expect(page.getByText(sentinel as string)).toHaveCount(0)
    expect(errors).toEqual([])
  })
})

test.describe("prerendered creator page", () => {
  test.skip(!configured || !process.env.E2E_CREATOR_ID, "needs a seeded creator")
  const creatorId = process.env.E2E_CREATOR_ID as string

  test("lists SFW characters in the document and adds mature ones for a viewer with the preference", async ({
    page,
  }) => {
    const errors = collectErrors(page)

    const raw = await page.request.get(`/creators/${creatorId}`)
    expect(raw.ok()).toBe(true)
    expect(raw.headers()["x-nextjs-cache"]).toMatch(/^(HIT|MISS|STALE)$/)
    expect(await raw.text()).not.toContain(sentinel as string)

    await signInWithFallback(page, adult.email as string, adult.password as string)
    await page.goto(`/creators/${creatorId}`)

    await expect(page.getByRole("link", { name: new RegExp(sentinel as string) })).toBeVisible({
      timeout: 15000,
    })
    expect(errors).toEqual([])
  })
})

test.describe("prerendered pricing page", () => {
  test.skip(!configured, "needs fallback-auth users")

  test("resolves the account buttons for a signed-in user", async ({ page }) => {
    const errors = collectErrors(page)
    await signInWithFallback(page, adult.email as string, adult.password as string)

    const raw = await page.request.get("/pricing")
    expect(await raw.text()).toContain("Create Free Account")

    await page.goto("/pricing")

    await expect(page.getByRole("link", { name: "Go to Dashboard" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Upgrade to PRO" })).toBeEnabled()
    expect(errors).toEqual([])
  })
})
