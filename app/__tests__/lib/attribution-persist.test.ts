/**
 * @jest-environment node
 */
import { captureServerEvent } from "@/app/lib/analytics"
import { persistAttributionForUser } from "@/app/lib/attribution-persist"
import prisma from "@/app/lib/prismadb"

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      update: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/analytics", () => ({
  __esModule: true,
  captureServerEvent: jest.fn(),
}))

jest.mock("@/app/lib/logger", () => {
  const child = jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }))
  return {
    __esModule: true,
    default: { child },
    apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    authLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    aiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }
})

const USER_ID = "11111111-1111-4111-8111-111111111111"

const COOKIE = JSON.stringify({
  utmSource: "twitter",
  utmMedium: "social",
  utmCampaign: "launch",
  ref: "alice",
  firstTouchAt: "2026-06-01T00:00:00.000Z",
})

const unattributed = {
  id: USER_ID,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  referralSource: null,
  firstTouchAt: null,
}

describe("persistAttributionForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})
  })

  it("writes resolved columns and fires signup_completed with the source", async () => {
    await persistAttributionForUser(unattributed, COOKIE)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        utmSource: "twitter",
        utmMedium: "social",
        utmCampaign: "launch",
        referralSource: "alice",
        firstTouchAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    })

    expect(captureServerEvent).toHaveBeenCalledWith(USER_ID, "signup_completed", {
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
      referralSource: "alice",
    })
  })

  it("does nothing when the user is already attributed", async () => {
    await persistAttributionForUser(
      { ...unattributed, firstTouchAt: new Date("2026-05-01T00:00:00.000Z") },
      COOKIE
    )
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(captureServerEvent).not.toHaveBeenCalled()
  })

  it("does nothing when there is no cookie", async () => {
    await persistAttributionForUser(unattributed, undefined)
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(captureServerEvent).not.toHaveBeenCalled()
  })

  it("swallows DB errors and never throws into the caller", async () => {
    ;(prisma.user.update as jest.Mock).mockRejectedValue(new Error("db down"))
    await expect(persistAttributionForUser(unattributed, COOKIE)).resolves.toBeUndefined()
  })
})

export {}
