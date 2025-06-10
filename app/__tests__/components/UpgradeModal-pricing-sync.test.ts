/**
 * Guards against pricing/feature drift between the client-safe constants in
 * UpgradeModal (which cannot import config/subscriptions.ts — it reads
 * server-only env at module init) and the canonical PRO plan definition.
 */
import { proPlan } from "@/config/subscriptions"
import { PRO_HIGHLIGHTS, PRO_PRICE_PER_MONTH } from "@/app/components/modals/UpgradeModal"

describe("UpgradeModal pricing sync", () => {
  it("shows the canonical PRO price", () => {
    expect(PRO_PRICE_PER_MONTH).toBe(`$${proPlan.price.toFixed(2)}/month`)
  })

  it("only lists highlights that exist in the PRO plan features", () => {
    for (const highlight of PRO_HIGHLIGHTS) {
      expect(proPlan.features).toContain(highlight)
    }
  })
})
