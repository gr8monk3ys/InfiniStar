import { HISTORY_WINDOW, renderSummaryForPrompt } from "@/app/lib/conversation-summary"

describe("renderSummaryForPrompt history-window gate", () => {
  const stored = JSON.stringify({
    overview: "An early exchange of greetings.",
    keyTopics: ["greeting"],
  })

  it("does not inject when every summarized message is still in the live window", () => {
    // A manual summary at the 5-message minimum: all 5 source messages are
    // still sent verbatim in the last-20 window, so injecting is redundant.
    expect(renderSummaryForPrompt(stored, 5)).toBe("")
  })

  it("does not inject when the summarized count equals the window boundary", () => {
    expect(renderSummaryForPrompt(stored, HISTORY_WINDOW)).toBe("")
  })

  it("does not inject when the summarized count is missing", () => {
    expect(renderSummaryForPrompt(stored, null)).toBe("")
    expect(renderSummaryForPrompt(stored, undefined)).toBe("")
  })

  it("injects only when the summary covers more messages than the window", () => {
    const rendered = renderSummaryForPrompt(stored, HISTORY_WINDOW + 1)
    expect(rendered).toContain("[Earlier Conversation Summary]")
    expect(rendered).toContain("An early exchange of greetings.")
  })
})

describe("renderSummaryForPrompt", () => {
  // A count above the window so these exercise the rendering path, not the gate.
  const ABOVE_WINDOW = HISTORY_WINDOW + 5

  it("returns empty string for null/undefined/empty input", () => {
    expect(renderSummaryForPrompt(null, ABOVE_WINDOW)).toBe("")
    expect(renderSummaryForPrompt(undefined, ABOVE_WINDOW)).toBe("")
    expect(renderSummaryForPrompt("", ABOVE_WINDOW)).toBe("")
  })

  it("returns empty string for unparseable JSON", () => {
    expect(renderSummaryForPrompt("not json {{{", ABOVE_WINDOW)).toBe("")
  })

  it("returns empty string when overview is missing or blank", () => {
    expect(renderSummaryForPrompt(JSON.stringify({ keyTopics: ["a"] }), ABOVE_WINDOW)).toBe("")
    expect(renderSummaryForPrompt(JSON.stringify({ overview: "   " }), ABOVE_WINDOW)).toBe("")
  })

  it("renders the overview as a labeled prompt section, not raw JSON", () => {
    const stored = JSON.stringify({
      overview: "The hero entered the haunted manor and met the ghost librarian.",
      keyTopics: ["haunted manor", "ghost librarian"],
      decisions: [],
      participants: ["Hero", "Librarian"],
    })
    const rendered = renderSummaryForPrompt(stored, ABOVE_WINDOW)

    expect(rendered).toContain("[Earlier Conversation Summary]")
    expect(rendered).toContain("The hero entered the haunted manor")
    expect(rendered).toContain("haunted manor; ghost librarian")
    // never leaks the raw JSON braces into the prompt
    expect(rendered).not.toContain('"overview"')
    expect(rendered).not.toContain("{")
  })

  it("omits the key-topics line when there are none", () => {
    const rendered = renderSummaryForPrompt(
      JSON.stringify({ overview: "A short chat.", keyTopics: [] }),
      ABOVE_WINDOW
    )
    expect(rendered).toContain("A short chat.")
    expect(rendered).not.toContain("Key topics")
  })
})
