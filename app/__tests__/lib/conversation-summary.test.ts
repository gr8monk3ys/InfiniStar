import { renderSummaryForPrompt } from "@/app/lib/conversation-summary"

describe("renderSummaryForPrompt", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(renderSummaryForPrompt(null)).toBe("")
    expect(renderSummaryForPrompt(undefined)).toBe("")
    expect(renderSummaryForPrompt("")).toBe("")
  })

  it("returns empty string for unparseable JSON", () => {
    expect(renderSummaryForPrompt("not json {{{")).toBe("")
  })

  it("returns empty string when overview is missing or blank", () => {
    expect(renderSummaryForPrompt(JSON.stringify({ keyTopics: ["a"] }))).toBe("")
    expect(renderSummaryForPrompt(JSON.stringify({ overview: "   " }))).toBe("")
  })

  it("renders the overview as a labeled prompt section, not raw JSON", () => {
    const stored = JSON.stringify({
      overview: "The hero entered the haunted manor and met the ghost librarian.",
      keyTopics: ["haunted manor", "ghost librarian"],
      decisions: [],
      participants: ["Hero", "Librarian"],
    })
    const rendered = renderSummaryForPrompt(stored)

    expect(rendered).toContain("[Earlier Conversation Summary]")
    expect(rendered).toContain("The hero entered the haunted manor")
    expect(rendered).toContain("haunted manor; ghost librarian")
    // never leaks the raw JSON braces into the prompt
    expect(rendered).not.toContain('"overview"')
    expect(rendered).not.toContain("{")
  })

  it("omits the key-topics line when there are none", () => {
    const rendered = renderSummaryForPrompt(
      JSON.stringify({ overview: "A short chat.", keyTopics: [] })
    )
    expect(rendered).toContain("A short chat.")
    expect(rendered).not.toContain("Key topics")
  })
})
