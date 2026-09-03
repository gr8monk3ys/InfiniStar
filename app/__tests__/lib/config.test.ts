/**
 * @jest-environment node
 */

import { config } from "@/app/lib/config"

/**
 * `app/lib/config.ts` exists because the same variable was answered differently
 * depending on which module asked. These tests pin the distinctions that
 * matter, all of which were live defects before it existed.
 *
 * They also demonstrate the reason it uses getters rather than constants:
 * mutating `process.env` here is enough, with no module reset, which is what
 * kept the existing CORS tests working when the inline reads moved.
 */

const ORIGINAL_ENV = process.env

function setEnv(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV, ...env }
}

afterEach(() => {
  process.env = ORIGINAL_ENV
  jest.restoreAllMocks()
})

describe("appUrl", () => {
  it("uses the configured value when set", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://infinistar.app" })
    expect(config.appUrl).toBe("https://infinistar.app")
  })

  it("falls back to localhost in development", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: undefined, NODE_ENV: "development" })
    expect(config.appUrl).toBe("http://localhost:3000")
  })

  it("re-reads the environment on each access", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://one.example.com" })
    expect(config.appUrl).toBe("https://one.example.com")

    setEnv({ NEXT_PUBLIC_APP_URL: "https://two.example.com" })
    expect(config.appUrl).toBe("https://two.example.com")
  })

  /**
   * The old behaviour hid a missing variable: robots.ts hardcoded the
   * production domain while getShareUrl handed users a localhost link, so the
   * same misconfiguration looked fine from one angle and broke sharing from
   * another.
   */
  it("complains loudly when it is missing in production", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {})
    setEnv({ NEXT_PUBLIC_APP_URL: undefined, NODE_ENV: "production" })

    expect(config.appUrl).toBe("http://localhost:3000")
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][0]).toContain("NEXT_PUBLIC_APP_URL")
  })

  it("stays quiet when it is set in production", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {})
    setEnv({ NEXT_PUBLIC_APP_URL: "https://infinistar.app", NODE_ENV: "production" })

    expect(config.appUrl).toBe("https://infinistar.app")
    expect(error).not.toHaveBeenCalled()
  })
})

describe("configuredAppUrl", () => {
  /**
   * The distinction that keeps CORS failing closed. Handing the allowlist the
   * dev fallback would allow http://localhost:3000 as a cross-origin caller on
   * a production deploy whose variable was unset, where the correct answer is
   * to allow nothing.
   */
  it("is undefined when unset, so callers can tell missing from defaulted", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: undefined, NODE_ENV: "development" })

    expect(config.configuredAppUrl).toBeUndefined()
    expect(config.appUrl).toBe("http://localhost:3000")
  })

  it("matches appUrl when set", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://infinistar.app" })
    expect(config.configuredAppUrl).toBe(config.appUrl)
  })
})

describe("posthog hosts", () => {
  /**
   * One variable was serving both. Setting it correctly for ingestion broke
   * dashboard links; setting it correctly for the dashboard posted server-side
   * events to an endpoint that does not ingest them.
   */
  it("keeps the ingestion host and the UI host apart by default", () => {
    setEnv({ NEXT_PUBLIC_POSTHOG_HOST: undefined, NEXT_PUBLIC_POSTHOG_UI_HOST: undefined })

    expect(config.posthog.ingestHost).toBe("https://us.i.posthog.com")
    expect(config.posthog.uiHost).toBe("https://us.posthog.com")
    expect(config.posthog.ingestHost).not.toBe(config.posthog.uiHost)
  })

  it("does not let the ingestion host leak into the UI host", () => {
    setEnv({
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      NEXT_PUBLIC_POSTHOG_UI_HOST: undefined,
    })

    expect(config.posthog.ingestHost).toBe("https://eu.i.posthog.com")
    expect(config.posthog.uiHost).toBe("https://us.posthog.com")
  })

  it("honours both when both are set, for self-hosted deployments", () => {
    setEnv({
      NEXT_PUBLIC_POSTHOG_HOST: "https://ingest.example.com",
      NEXT_PUBLIC_POSTHOG_UI_HOST: "https://analytics.example.com",
    })

    expect(config.posthog.ingestHost).toBe("https://ingest.example.com")
    expect(config.posthog.uiHost).toBe("https://analytics.example.com")
  })
})
