/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

describe("GET /api/ai/capabilities", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  async function callRoute(): Promise<Response> {
    const { GET } = await import("@/app/api/ai/capabilities/route")
    const request = new NextRequest("http://localhost:3000/api/ai/capabilities")
    return GET(request)
  }

  function setFullConfig() {
    process.env.OPENAI_API_KEY = "sk-test-openai-key"
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud"
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = "test-preset"
  }

  it("reports both capabilities when OpenAI and Cloudinary are configured", async () => {
    setFullConfig()

    const response = await callRoute()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({ imageGeneration: true, voiceTranscription: true })
  })

  it("reports both capabilities unavailable when OPENAI_API_KEY is missing", async () => {
    setFullConfig()
    delete process.env.OPENAI_API_KEY

    const response = await callRoute()
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({ imageGeneration: false, voiceTranscription: false })
  })

  it("reports capabilities unavailable when the Cloudinary cloud name is missing", async () => {
    setFullConfig()
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

    const payload = await (await callRoute()).json()
    expect(payload).toEqual({ imageGeneration: false, voiceTranscription: false })
  })

  it("reports capabilities unavailable when the Cloudinary upload preset is missing", async () => {
    setFullConfig()
    delete process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    const payload = await (await callRoute()).json()
    expect(payload).toEqual({ imageGeneration: false, voiceTranscription: false })
  })

  it("treats empty-string configuration as unconfigured", async () => {
    process.env.OPENAI_API_KEY = ""
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = ""
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = ""

    const payload = await (await callRoute()).json()
    expect(payload).toEqual({ imageGeneration: false, voiceTranscription: false })
  })

  it("never leaks configuration values in the response", async () => {
    const secret = "sk-super-secret-value-do-not-leak"
    process.env.OPENAI_API_KEY = secret
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "secret-cloud-name"
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = "secret-preset"

    const response = await callRoute()
    const text = await response.text()
    expect(text).not.toContain(secret)
    expect(text).not.toContain("secret-cloud-name")
    expect(text).not.toContain("secret-preset")
    // Only booleans should be present
    expect(JSON.parse(text)).toEqual({ imageGeneration: true, voiceTranscription: true })
  })

  it("marks the response as cacheable", async () => {
    setFullConfig()

    const response = await callRoute()
    const cacheControl = response.headers.get("Cache-Control")
    expect(cacheControl).toBeTruthy()
    expect(cacheControl).toContain("public")
    expect(cacheControl).toContain("max-age=300")
  })

  it("rate limits with apiLimiter (60/min) and returns 429 once exhausted", async () => {
    setFullConfig()

    // A single import shares one in-memory rate limiter across calls.
    const { GET } = await import("@/app/api/ai/capabilities/route")
    const call = () => GET(new NextRequest("http://localhost:3000/api/ai/capabilities"))

    for (let i = 0; i < 60; i++) {
      const response = await call()
      expect(response.status).toBe(200)
    }

    const blocked = await call()
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get("Retry-After")).toBe("60")
    const payload = await blocked.json()
    expect(payload.error).toMatch(/too many requests/i)
  })
})

export {}
