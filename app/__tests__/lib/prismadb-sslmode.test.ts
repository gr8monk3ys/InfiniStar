import { withExplicitSslMode } from "@/app/lib/prismadb"

describe("withExplicitSslMode", () => {
  it("upgrades an implicit require to verify-full", () => {
    expect(withExplicitSslMode("postgresql://u:p@host/db?sslmode=require")).toBe(
      "postgresql://u:p@host/db?sslmode=verify-full"
    )
  })

  it("upgrades prefer and verify-ca the same way", () => {
    for (const mode of ["prefer", "verify-ca"]) {
      expect(withExplicitSslMode(`postgresql://u:p@host/db?sslmode=${mode}`)).toBe(
        "postgresql://u:p@host/db?sslmode=verify-full"
      )
    }
  })

  it("leaves an already-explicit verify-full alone", () => {
    const url = "postgresql://u:p@host/db?sslmode=verify-full"
    expect(withExplicitSslMode(url)).toBe(url)
  })

  it("leaves disable alone — a local database has no certificate to verify", () => {
    const url = "postgresql://u:p@localhost:5432/db?sslmode=disable"
    expect(withExplicitSslMode(url)).toBe(url)
  })

  it("adds nothing when no sslmode is present", () => {
    const url = "postgresql://u:p@host/db"
    expect(withExplicitSslMode(url)).toBe(url)
  })

  it("preserves other query parameters", () => {
    expect(withExplicitSslMode("postgresql://u:p@host/db?sslmode=require&connection_limit=5")).toBe(
      "postgresql://u:p@host/db?sslmode=verify-full&connection_limit=5"
    )
  })

  it("returns a malformed url unchanged rather than throwing", () => {
    expect(withExplicitSslMode("not a url")).toBe("not a url")
  })
})
