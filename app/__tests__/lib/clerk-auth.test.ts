import {
  getClerkSignInUrl,
  getClerkSignUpUrl,
  getSafePostAuthPath,
  isClerkSatellite,
} from "@/app/lib/clerk-auth"

const originalEnv = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...originalEnv }
})

afterAll(() => {
  process.env = originalEnv
})

describe("clerk auth helpers", () => {
  it("treats the satellite flag as opt-in", () => {
    delete process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE
    expect(isClerkSatellite()).toBe(false)

    process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE = "true"
    expect(isClerkSatellite()).toBe(true)
  })

  it("uses local auth paths by default", () => {
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL

    expect(getClerkSignInUrl()).toBe("/sign-in")
    expect(getClerkSignUpUrl()).toBe("/sign-up")
  })

  it("keeps only safe same-app redirect paths", () => {
    expect(getSafePostAuthPath("/characters/hero")).toBe("/characters/hero")
    expect(getSafePostAuthPath("https://evil.example.com")).toBe("/dashboard")
    expect(getSafePostAuthPath("//evil.example.com")).toBe("/dashboard")
    expect(getSafePostAuthPath(undefined, "/feed")).toBe("/feed")
  })
})
