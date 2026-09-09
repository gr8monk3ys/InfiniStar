import "@testing-library/jest-dom"

import { fireEvent, render, screen } from "@testing-library/react"

import { config } from "@/app/lib/config"
import UpgradeModal from "@/app/components/modals/UpgradeModal"

describe("UpgradeModal", () => {
  it("renders nothing when closed", () => {
    render(<UpgradeModal isOpen={false} onClose={jest.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("derives the headline message count from the limits payload", () => {
    render(
      <UpgradeModal
        isOpen={true}
        onClose={jest.fn()}
        reason="FREE_TIER_MESSAGE_LIMIT_REACHED"
        limits={{ isPro: false, monthlyMessageLimit: 50, remainingMessages: 0 }}
      />
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("You've used all 50 free messages this month")).toBeInTheDocument()
  })

  it("falls back to generic headline when limits payload is missing", () => {
    render(<UpgradeModal isOpen={true} onClose={jest.fn()} />)

    expect(screen.getByText("You've used all your free messages this month")).toBeInTheDocument()
  })

  it("shows PRO benefits and a pricing CTA for the free-tier limit", () => {
    render(
      <UpgradeModal
        isOpen={true}
        onClose={jest.fn()}
        reason="FREE_TIER_MESSAGE_LIMIT_REACHED"
        limits={{ monthlyMessageLimit: 50 }}
      />
    )

    expect(screen.getByText("High monthly limits (fair use cap applies)")).toBeInTheDocument()
    const cta = screen.getByRole("link", { name: /upgrade to pro/i })
    expect(cta).toHaveAttribute("href", "/pricing")
  })

  it("shows a contact-support CTA without pricing link for the PRO cost cap", () => {
    render(<UpgradeModal isOpen={true} onClose={jest.fn()} reason="PRO_TIER_COST_CAP_REACHED" />)

    expect(screen.getByText("You've reached this month's fair-use cap")).toBeInTheDocument()
    const supportLink = screen.getByRole("link", { name: /contact support/i })
    // Read from config rather than pinned to a literal: the address is now one
    // environment variable, and hardcoding it here is what let fourteen copies
    // of a dead address drift apart in the first place.
    expect(supportLink).toHaveAttribute("href", `mailto:${config.supportEmail}`)
    expect(screen.queryByRole("link", { name: /upgrade to pro/i })).not.toBeInTheDocument()
  })

  it("calls onClose when 'Maybe later' is clicked", () => {
    const onClose = jest.fn()
    render(<UpgradeModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByRole("button", { name: /maybe later/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
