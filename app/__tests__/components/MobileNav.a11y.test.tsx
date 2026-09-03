import { render, screen } from "@testing-library/react"
import { HiChat, HiUser } from "react-icons/hi"

import MobileItem from "@/app/(dashboard)/dashboard/components/sidebar/MobileItem"

/**
 * The mobile bar is the ONLY navigation below the `lg` breakpoint, and the
 * product's stated primary context is a phone. It previously rendered each
 * route as an `aria-hidden` icon with no text and no `aria-label`, so a
 * screen reader announced four links with no name at all (WCAG 2.4.4 / 4.1.2)
 * — and sign-out was one of those unnamed glyphs, sitting next to Profile.
 *
 * These tests pin the accessible name, the visible label and `aria-current`
 * so that failure cannot come back silently.
 */
describe("MobileItem accessibility", () => {
  it("exposes an accessible name for the link", () => {
    render(<MobileItem label="Chat" href="/dashboard/conversations" icon={HiChat} />)

    expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument()
  })

  it("renders the label as visible text, not only for assistive tech", () => {
    render(<MobileItem label="Profile" href="/dashboard/profile" icon={HiUser} />)

    const label = screen.getByText("Profile")
    expect(label).toBeVisible()
    expect(label).not.toHaveClass("sr-only")
  })

  it("marks the active route with aria-current", () => {
    render(<MobileItem label="Chat" href="/dashboard/conversations" icon={HiChat} active />)

    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page")
  })

  it("leaves aria-current off inactive routes", () => {
    render(<MobileItem label="Chat" href="/dashboard/conversations" icon={HiChat} />)

    expect(screen.getByRole("link", { name: "Chat" })).not.toHaveAttribute("aria-current")
  })

  it("hides the decorative icon from the accessibility tree", () => {
    const { container } = render(
      <MobileItem label="Chat" href="/dashboard/conversations" icon={HiChat} />
    )

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })

  it("sets Logout apart from the navigation items with a hairline", () => {
    const { container } = render(
      <MobileItem label="Logout" href="#" icon={HiUser} separated onClick={() => {}} />
    )

    expect(container.querySelector("a")?.className).toContain("border-l")
  })

  it("keeps a visible focus ring for keyboard users", () => {
    const { container } = render(<MobileItem label="Chat" href="/x" icon={HiChat} />)

    expect(container.querySelector("a")?.className).toContain("focus-visible:ring-2")
  })
})
