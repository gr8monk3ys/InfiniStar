import "@testing-library/jest-dom"

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import UpgradeModal from "@/app/components/modals/UpgradeModal"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { capture: jest.fn() },
}))

const posthog = require("posthog-js").default

describe("UpgradeModal analytics", () => {
  beforeEach(() => jest.clearAllMocks())

  it("fires upgrade_modal_viewed when opened (free-tier reason)", () => {
    render(
      <UpgradeModal isOpen={true} onClose={jest.fn()} reason="FREE_TIER_MESSAGE_LIMIT_REACHED" />
    )

    expect(posthog.capture).toHaveBeenCalledWith("upgrade_modal_viewed", {
      reason: "FREE_TIER_MESSAGE_LIMIT_REACHED",
    })
  })

  it("does NOT fire upgrade_modal_viewed while closed", () => {
    render(<UpgradeModal isOpen={false} onClose={jest.fn()} />)
    expect(posthog.capture).not.toHaveBeenCalledWith("upgrade_modal_viewed", expect.anything())
  })

  it("fires upgrade_cta_clicked when the PRO pricing CTA is clicked", () => {
    render(
      <UpgradeModal isOpen={true} onClose={jest.fn()} reason="FREE_TIER_MESSAGE_LIMIT_REACHED" />
    )

    fireEvent.click(screen.getByRole("link", { name: /upgrade to pro/i }))
    expect(posthog.capture).toHaveBeenCalledWith("upgrade_cta_clicked", {
      reason: "FREE_TIER_MESSAGE_LIMIT_REACHED",
      cta: "pricing",
    })
  })

  it("fires upgrade_cta_clicked when the contact-support CTA is clicked (cost cap)", () => {
    render(<UpgradeModal isOpen={true} onClose={jest.fn()} reason="PRO_TIER_COST_CAP_REACHED" />)

    fireEvent.click(screen.getByRole("link", { name: /contact support/i }))
    expect(posthog.capture).toHaveBeenCalledWith("upgrade_cta_clicked", {
      reason: "PRO_TIER_COST_CAP_REACHED",
      cta: "contact_support",
    })
  })
})
