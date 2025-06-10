/**
 * @jest-environment node
 *
 * Tests the timing-safe cron authorization helper.
 */
import { isAuthorizedCronRequest } from "@/app/lib/cron-auth"

describe("isAuthorizedCronRequest", () => {
  const SECRET = "super-secret-cron-token"

  it("accepts a matching Bearer header", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it("rejects a wrong secret", () => {
    expect(isAuthorizedCronRequest("Bearer wrong-secret", SECRET)).toBe(false)
  })

  it("rejects a non-Bearer scheme", () => {
    expect(isAuthorizedCronRequest(`Basic ${SECRET}`, SECRET)).toBe(false)
  })

  it("rejects a missing header", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false)
  })

  it("rejects when the secret is not configured", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, undefined)).toBe(false)
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, "")).toBe(false)
  })

  it("rejects values of different lengths without throwing", () => {
    expect(isAuthorizedCronRequest("Bearer x", SECRET)).toBe(false)
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}extra`, SECRET)).toBe(false)
  })
})

export {}
