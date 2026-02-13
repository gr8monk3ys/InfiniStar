import { render, waitFor } from "@testing-library/react"

import { AdSenseUnit } from "@/app/components/monetization/AdSenseUnit"

jest.mock("next/script", () => ({
  __esModule: true,
  default: ({ id, src, ...props }: { id?: string; src?: string }) => (
    <div id={id} data-testid={id || "mock-script"} data-src={src} {...props} />
  ),
}))

jest.mock("@/app/lib/monetization", () => ({
  monetizationConfig: {
    enableAffiliateLinks: false,
    enableAdSense: false,
    adSenseClientId: "",
    adSenseSlots: {
      homeInline: "",
      pricingInline: "",
    },
  },
}))

describe("AdSenseUnit", () => {
  function getMonetizationConfigMock() {
    return (
      jest.requireMock("@/app/lib/monetization") as {
        monetizationConfig: {
          enableAffiliateLinks: boolean
          enableAdSense: boolean
          adSenseClientId: string
          adSenseSlots: { homeInline: string; pricingInline: string }
        }
      }
    ).monetizationConfig
  }

  beforeEach(() => {
    const monetizationConfigMock = getMonetizationConfigMock()
    monetizationConfigMock.enableAdSense = false
    monetizationConfigMock.adSenseClientId = ""
    monetizationConfigMock.adSenseSlots = {
      homeInline: "",
      pricingInline: "",
    }
    delete window.adsbygoogle
  })

  it("renders nothing when AdSense feature flag is disabled", () => {
    const monetizationConfigMock = getMonetizationConfigMock()
    monetizationConfigMock.enableAdSense = false
    monetizationConfigMock.adSenseClientId = "ca-pub-123456"

    const { container } = render(<AdSenseUnit slot="slot-1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when client ID or slot is missing", () => {
    const monetizationConfigMock = getMonetizationConfigMock()
    monetizationConfigMock.enableAdSense = true
    monetizationConfigMock.adSenseClientId = ""

    const { container: noClientContainer } = render(<AdSenseUnit slot="slot-1" />)
    expect(noClientContainer).toBeEmptyDOMElement()

    monetizationConfigMock.adSenseClientId = "ca-pub-123456"
    const { container: noSlotContainer } = render(<AdSenseUnit slot="" />)
    expect(noSlotContainer).toBeEmptyDOMElement()
  })

  it("renders script and ad unit attributes when enabled", async () => {
    const monetizationConfigMock = getMonetizationConfigMock()
    monetizationConfigMock.enableAdSense = true
    monetizationConfigMock.adSenseClientId = "ca-pub-123456"

    const pushSpy = jest.fn()
    window.adsbygoogle = { push: pushSpy } as unknown as Array<Record<string, unknown>>

    const { container, getByTestId } = render(<AdSenseUnit slot="slot-42" />)

    const script = getByTestId("adsense-script")
    expect(script).toHaveAttribute(
      "data-src",
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123456"
    )

    const adElement = container.querySelector("ins.adsbygoogle")
    expect(adElement).toBeInTheDocument()
    expect(adElement).toHaveAttribute("data-ad-client", "ca-pub-123456")
    expect(adElement).toHaveAttribute("data-ad-slot", "slot-42")

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith({})
    })
  })

  it("pushes to adsbygoogle only once when rerendering with the same slot", async () => {
    const monetizationConfigMock = getMonetizationConfigMock()
    monetizationConfigMock.enableAdSense = true
    monetizationConfigMock.adSenseClientId = "ca-pub-123456"

    const pushSpy = jest.fn()
    window.adsbygoogle = { push: pushSpy } as unknown as Array<Record<string, unknown>>

    const { rerender } = render(<AdSenseUnit slot="slot-42" />)
    rerender(<AdSenseUnit slot="slot-42" />)

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledTimes(1)
    })
  })
})

export {}
