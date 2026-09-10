import { deliver } from "@/app/lib/email-delivery"

/**
 * @jest-environment node
 */

/**
 * `email.ts` had no tests, which is how production ran for months with a
 * Postmark token the API rejects and an `SMTP_FROM` of `@example.com`: every
 * send returned `false` and nothing said so above `logger.error`. These pin
 * the provider choice and the failure contract.
 */

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), child: jest.fn() },
  apiLogger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const MESSAGE = {
  to: "someone@example.test",
  from: "noreply@send.lscaturchio.xyz",
  subject: "Your account is scheduled for deletion",
  htmlBody: "<p>hi</p>",
  textBody: "hi",
}

const ORIGINAL_ENV = process.env
const originalFetch = globalThis.fetch

function mockFetch(response: { ok: boolean; status?: number; text?: string }) {
  const fn = jest.fn(async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 422),
    text: async () => response.text ?? "",
  }))
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

afterEach(() => {
  process.env = ORIGINAL_ENV
  globalThis.fetch = originalFetch
})

describe("deliver", () => {
  it("sends through Resend when its key is set", async () => {
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test" }
    delete process.env.POSTMARK_API_TOKEN
    const fetchMock = mockFetch({ ok: true })

    expect(await deliver(MESSAGE)).toBe(true)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.resend.com/emails")
    expect(JSON.parse(init.body as string)).toEqual({
      from: MESSAGE.from,
      to: [MESSAGE.to],
      subject: MESSAGE.subject,
      html: MESSAGE.htmlBody,
      text: MESSAGE.textBody,
    })
  })

  it("prefers Resend over Postmark when both are set", async () => {
    // Resend is the one with verified DNS. A leftover Postmark token must not
    // win — that is the exact state production was in.
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", POSTMARK_API_TOKEN: "stale" }
    const fetchMock = mockFetch({ ok: true })

    await deliver(MESSAGE)

    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe("https://api.resend.com/emails")
  })

  it("falls back to Postmark when only its token is set", async () => {
    process.env = { ...ORIGINAL_ENV, POSTMARK_API_TOKEN: "pm_test" }
    delete process.env.RESEND_API_KEY
    const fetchMock = mockFetch({ ok: true })

    expect(await deliver(MESSAGE)).toBe(true)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.postmarkapp.com/email")
    expect(JSON.parse(init.body as string).From).toBe(MESSAGE.from)
  })

  it("returns false, without throwing, when the provider rejects the message", async () => {
    // An unverified `from` domain looks like this, and it must not take down
    // the account deletion that triggered the notification.
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test" }
    mockFetch({ ok: false, status: 403, text: '{"message":"domain is not verified"}' })

    expect(await deliver(MESSAGE)).toBe(false)
  })

  it("returns false, without throwing, when the provider is unreachable", async () => {
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test" }
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED")
    }) as unknown as typeof fetch

    expect(await deliver(MESSAGE)).toBe(false)
  })

  it("returns false when no provider is configured", async () => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.RESEND_API_KEY
    delete process.env.POSTMARK_API_TOKEN
    const fetchMock = mockFetch({ ok: true })

    expect(await deliver(MESSAGE)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
