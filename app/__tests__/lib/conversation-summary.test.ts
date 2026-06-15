import { HISTORY_WINDOW, renderSummaryForPrompt } from "@/app/lib/conversation-summary"

describe("renderSummaryForPrompt history-window gate", () => {
  const stored = JSON.stringify({
    overview: "An early exchange of greetings.",
    keyTopics: ["greeting"],
  })

  // The second arg is the conversation's CURRENT total message count: the
  // summary is only injected once the conversation outgrows the live take:20
  // window, regardless of when the summary itself was generated.
  it("does not inject when the whole conversation still fits in the live window", () => {
    // Only 5 messages exist total — all are still sent verbatim, so injecting
    // the summary would be redundant.
    expect(renderSummaryForPrompt(stored, 5)).toBe("")
  })

  it("does not inject when the message count equals the window boundary", () => {
    expect(renderSummaryForPrompt(stored, HISTORY_WINDOW)).toBe("")
  })

  it("does not inject when the message count is missing", () => {
    expect(renderSummaryForPrompt(stored, null)).toBe("")
    expect(renderSummaryForPrompt(stored, undefined)).toBe("")
  })

  it("injects once the conversation holds more messages than the window", () => {
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
