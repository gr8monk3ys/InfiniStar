import React from "react"
import { act, render, screen } from "@testing-library/react"

import { HeaderActions } from "@/app/components/header-actions"

// The header lives in the root layout and must stay free of server auth so
// every route can prerender; these tests pin the client-side resolution.

jest.mock("@/app/components/theme-toggle", () => ({
  ThemeToggleCompact: () => null,
}))

function mockSession(isSignedIn: boolean) {
  let resolve: (value: unknown) => void = () => {}
  const pending = new Promise((r) => {
    resolve = r
  })
  global.fetch = jest.fn(() =>
    pending.then(() => ({
      ok: true,
      json: async () => ({ isSignedIn, authMode: isSignedIn ? "clerk" : null, user: null }),
    }))
  ) as unknown as typeof fetch
  return () => act(async () => resolve(undefined))
}

function setCookie(value: string) {
  Object.defineProperty(document, "cookie", { configurable: true, get: () => value })
}

describe("HeaderActions", () => {
  afterEach(() => {
    setCookie("")
    jest.restoreAllMocks()
  })

  it("renders the signed-out buttons before the session is known", () => {
    setCookie("")
    mockSession(false)
    render(<HeaderActions />)
    expect(screen.getByText("Sign In")).toBeInTheDocument()
    expect(screen.getByText("Create Account")).toBeInTheDocument()
    expect(screen.queryByText("Open App")).not.toBeInTheDocument()
  })

  it("uses Clerk's __client_uat cookie as a signed-in hint before the fetch resolves", () => {
    setCookie("__client_uat=1789527000; other=1")
    mockSession(true)
    render(<HeaderActions />)
    expect(screen.getByText("Open App")).toBeInTheDocument()
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument()
  })

  it("treats __client_uat=0 as signed out", () => {
    setCookie("__client_uat=0")
    mockSession(false)
    render(<HeaderActions />)
    expect(screen.getByText("Sign In")).toBeInTheDocument()
  })

  it("switches to Open App once /api/auth/session confirms a session with no hint (fallback auth)", async () => {
    setCookie("")
    const settle = mockSession(true)
    render(<HeaderActions />)
    expect(screen.getByText("Sign In")).toBeInTheDocument()
    await settle()
    expect(screen.getByText("Open App")).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ cache: "no-store", credentials: "include" })
    )
  })

  it("lets the session endpoint override a stale signed-in hint", async () => {
    setCookie("__client_uat=1789527000")
    const settle = mockSession(false)
    render(<HeaderActions />)
    expect(screen.getByText("Open App")).toBeInTheDocument()
    await settle()
    expect(screen.getByText("Sign In")).toBeInTheDocument()
    expect(screen.queryByText("Open App")).not.toBeInTheDocument()
  })
})
