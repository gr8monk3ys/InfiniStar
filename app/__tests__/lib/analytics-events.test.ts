/**
 * @jest-environment node
 */

import { isFirstHumanMessage } from "@/app/lib/analytics-events"

describe("isFirstHumanMessage", () => {
  it("returns true when the user has exactly zero prior human messages", async () => {
    const countFn = jest.fn().mockResolvedValue(0)
    await expect(isFirstHumanMessage("user-1", countFn)).resolves.toBe(true)
    expect(countFn).toHaveBeenCalledWith("user-1")
  })

  it("returns false when the user already has prior human messages", async () => {
    const countFn = jest.fn().mockResolvedValue(3)
    await expect(isFirstHumanMessage("user-1", countFn)).resolves.toBe(false)
  })

  it("returns false (fails closed) when the counter throws", async () => {
    const countFn = jest.fn().mockRejectedValue(new Error("db down"))
    await expect(isFirstHumanMessage("user-1", countFn)).resolves.toBe(false)
  })
})
