import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  hasAnalyticsConsent,
  setAnalyticsConsent,
} from "@/app/lib/analytics-consent"

describe("analytics consent", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("exposes the storage key", () => {
    expect(ANALYTICS_CONSENT_STORAGE_KEY).toBe("infinistar_analytics_consent")
  })

  it("defaults to no consent", () => {
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it("returns true only after consent is granted", () => {
    setAnalyticsConsent(true)
    expect(hasAnalyticsConsent()).toBe(true)
  })

  it("can revoke consent", () => {
    setAnalyticsConsent(true)
    setAnalyticsConsent(false)
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it("does not throw when localStorage is unavailable", () => {
    const original = window.localStorage
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked")
      },
    })
    expect(() => hasAnalyticsConsent()).not.toThrow()
    expect(hasAnalyticsConsent()).toBe(false)
    Object.defineProperty(window, "localStorage", { configurable: true, value: original })
  })
})
