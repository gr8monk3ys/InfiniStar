import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { hasAnalyticsConsent } from "@/app/lib/analytics-consent"
import { CookieBanner } from "@/app/components/CookieBanner"

describe("CookieBanner", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("grants analytics consent when dismissed", async () => {
    render(<CookieBanner />)
    expect(hasAnalyticsConsent()).toBe(false)

    await userEvent.click(screen.getByRole("button", { name: /got it/i }))

    expect(hasAnalyticsConsent()).toBe(true)
  })
})
