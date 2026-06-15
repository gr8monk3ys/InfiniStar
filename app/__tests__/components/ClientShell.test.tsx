import "@testing-library/jest-dom"

import { render } from "@testing-library/react"

import { ATTRIBUTION_COOKIE_NAME, readAttributionCookie } from "@/app/lib/attribution"
import { ClientShell } from "@/app/components/providers/ClientShell"

// Stub the dynamically-imported children so the test focuses on ClientShell's own logic.
jest.mock("@/app/components/CookieBanner", () => ({ CookieBanner: () => null }))
jest.mock("@/app/components/pwa/ServiceWorkerRegister", () => ({
  ServiceWorkerRegister: () => null,
}))
jest.mock("@/app/context/ToasterContext", () => () => null)
jest.mock("@/app/components/providers/PostHogProvider", () => ({ PostHogProvider: () => null }))

describe("ClientShell", () => {
  let cookieJar = ""
  beforeEach(() => {
    cookieJar = ""
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => cookieJar,
      set: (value: string) => {
        cookieJar = value.split(";")[0]
      },
    })
  })

  it("writes a first-touch attribution cookie from the URL on first load", () => {
    window.history.replaceState({}, "", "/?utm_source=twitter&ref=alice")
    render(<ClientShell />)
    const payload = readAttributionCookie(document.cookie)
    expect(payload?.utmSource).toBe("twitter")
    expect(payload?.ref).toBe("alice")
  })

  it("does not overwrite an existing first-touch cookie", () => {
    cookieJar = `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify({ ref: "original", firstTouchAt: "2026-01-01T00:00:00.000Z" })
    )}`
    window.history.replaceState({}, "", "/?utm_source=twitter&ref=newer")
    render(<ClientShell />)
    expect(readAttributionCookie(document.cookie)?.ref).toBe("original")
  })

  it("renders without throwing when there are no attribution params", () => {
    window.history.replaceState({}, "", "/")
    expect(() => render(<ClientShell />)).not.toThrow()
  })
})
