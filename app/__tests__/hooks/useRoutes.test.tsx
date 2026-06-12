import { renderHook } from "@testing-library/react"

import useRoutes from "@/app/(dashboard)/dashboard/hooks/useRoutes"

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/conversations",
}))

jest.mock("@/app/(dashboard)/dashboard/hooks/useConversation", () => ({
  __esModule: true,
  default: () => ({ conversationId: "", isOpen: false }),
}))

jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => ({ signOut: jest.fn() }),
}))

describe("useRoutes earnings gating", () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it("hides the Earnings nav item when creator payments are disabled (default)", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_CREATOR_PAYMENTS

    const { result } = renderHook(() => useRoutes())
    const labels = result.current.map((route) => route.label)

    expect(labels).toEqual(["Chat", "Characters", "Profile", "Logout"])
    expect(labels).not.toContain("Earnings")
  })

  it("shows the Earnings nav item when creator payments are enabled", () => {
    process.env.NEXT_PUBLIC_ENABLE_CREATOR_PAYMENTS = "true"

    const { result } = renderHook(() => useRoutes())
    const labels = result.current.map((route) => route.label)

    expect(labels).toEqual(["Chat", "Characters", "Profile", "Earnings", "Logout"])

    const earnings = result.current.find((route) => route.label === "Earnings")
    expect(earnings?.href).toBe("/dashboard/creator-earnings")
  })
})

export {}
