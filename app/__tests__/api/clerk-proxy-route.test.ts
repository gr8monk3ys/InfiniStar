/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

import { getClerkFrontendApiOrigin } from "@/app/lib/clerk-proxy"
import { GET } from "@/app/api/clerk-proxy/[[...path]]/route"

const originalEnv = process.env
const originalFetch = global.fetch

function makePublishableKey(frontendApi: string) {
  return `pk_live_${Buffer.from(`${frontendApi}$`).toString("base64url")}`
}

function makeRequest(url: string) {
  return new NextRequest(url, {
    method: "GET",
    headers: {
      "x-forwarded-for": "203.0.113.10",
      host: "infini-star.vercel.app",
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env = {
    ...originalEnv,
    CLERK_SECRET_KEY: "sk_live_test_secret",
  }
})

afterAll(() => {
  process.env = originalEnv
  global.fetch = originalFetch
})

describe("Clerk proxy route", () => {
  it("derives a custom frontend API origin from the publishable key", () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = makePublishableKey("betedges.com/__clerk")

    expect(getClerkFrontendApiOrigin()).toBe("https://betedges.com/__clerk")
  })

  it("falls back to Clerk's default frontend API origin when the key is invalid", () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "not-a-clerk-key"

    expect(getClerkFrontendApiOrigin()).toBe("https://frontend-api.clerk.dev")
  })

  it("forwards requests to the frontend API origin encoded in the publishable key", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = makePublishableKey("betedges.com/__clerk")
    const fetchMock = jest.fn().mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: {
          "content-type": "text/plain",
          "content-encoding": "gzip",
          "content-length": "2",
          "x-upstream": "yes",
        },
      })
    )
    global.fetch = fetchMock as typeof global.fetch

    const response = await GET(
      makeRequest("https://infini-star.vercel.app/api/clerk-proxy/v1/client?foo=bar"),
      {
        params: Promise.resolve({ path: ["v1", "client"] }),
      }
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [upstreamUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(upstreamUrl.toString()).toBe("https://betedges.com/__clerk/v1/client?foo=bar")
    expect(init.method).toBe("GET")
    expect((init.headers as Headers).get("Clerk-Proxy-Url")).toBe(
      "https://infini-star.vercel.app/api/clerk-proxy"
    )
    expect((init.headers as Headers).get("Clerk-Secret-Key")).toBe("sk_live_test_secret")
    expect((init.headers as Headers).get("X-Forwarded-For")).toBe("203.0.113.10")
    expect((init.headers as Headers).get("host")).toBeNull()
    expect(response.headers.get("content-encoding")).toBeNull()
    expect(response.headers.get("content-length")).toBeNull()
    expect(response.headers.get("x-upstream")).toBe("yes")
  })

  it("rewrites upstream redirect locations back to the local proxy path", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = makePublishableKey("betedges.com/__clerk")
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: {
          location:
            "https://betedges.com/__clerk/npm/@clerk/clerk-js@5.125.4/dist/clerk.browser.js",
        },
      })
    )
    global.fetch = fetchMock as typeof global.fetch

    const response = await GET(
      makeRequest(
        "https://infini-star.vercel.app/api/clerk-proxy/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
      ),
      {
        params: Promise.resolve({
          path: ["npm", "@clerk", "clerk-js@5", "dist", "clerk.browser.js"],
        }),
      }
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://infini-star.vercel.app/api/clerk-proxy/npm/@clerk/clerk-js@5.125.4/dist/clerk.browser.js"
    )
  })
})

export {}
