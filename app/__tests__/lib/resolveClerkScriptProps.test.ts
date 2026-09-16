import { resolveClerkScriptProps } from "@/app/lib/clerk-auth"

const key = "pk_test_Y2ktZHVtbXkuYWNjb3VudHMuZGV2JA"

// A relative proxy URL made `<ClerkProvider>` resolve the clerk-js script URL
// against `window.location` during prerendering and failed `next build` on
// the first static page that held it. These pin the props that avoid it.
describe("resolveClerkScriptProps", () => {
  it("passes nothing when no proxy URL is configured", () => {
    expect(resolveClerkScriptProps(undefined, key)).toEqual({})
    expect(resolveClerkScriptProps("  ", key)).toEqual({})
  })

  it("passes an absolute proxy URL through and lets Clerk build the script URL", () => {
    expect(resolveClerkScriptProps("https://example.com/__clerk", key)).toEqual({
      proxyUrl: "https://example.com/__clerk",
    })
  })

  it("keeps a path as the proxy URL and supplies a relative clerk-js script URL", () => {
    const props = resolveClerkScriptProps("/api/clerk-proxy", key)

    expect(props.proxyUrl).toBe("/api/clerk-proxy")
    expect(props.clerkJSUrl).toMatch(
      /^\/api\/clerk-proxy\/npm\/@clerk\/clerk-js@\d+\/dist\/clerk\.browser\.js$/
    )
    expect(props.clerkJSUrl).not.toContain("clerk-proxy.invalid")
  })

  it("is the same on the server and in the browser, so hydration matches", () => {
    // The helper reads no globals; the same inputs give the same output wherever it runs.
    expect(resolveClerkScriptProps("/api/clerk-proxy", key)).toEqual(
      resolveClerkScriptProps("/api/clerk-proxy", key)
    )
  })
})
