import { buildChatSystemBlocks } from "@/app/lib/ai-system-prompt"

/**
 * The chat system prompt is split into a STABLE block (character + persona),
 * which carries the ephemeral cache breakpoint, and a VOLATILE trailing block
 * (summary + memories), which does not. This keeps the large character prompt
 * cached even when the summary regenerates or a memory is added.
 */
describe("buildChatSystemBlocks", () => {
  const stable = "You are Aria, a witty bard with a long, detailed character sheet."

  it("keeps the cached stable block byte-identical when volatile content changes", () => {
    const a = buildChatSystemBlocks(
      stable,
      "\n\n[Earlier Conversation Summary]\nMet at the tavern."
    )
    const b = buildChatSystemBlocks(
      stable,
      "\n\n[Earlier Conversation Summary]\nFought the dragon."
    )
    expect(a[0]).toEqual(b[0])
    expect(a[0].text).toBe(stable)
    expect(a[0].cache_control).toEqual({ type: "ephemeral" })
  })

  it("places volatile content in a separate trailing block with no cache breakpoint", () => {
    const blocks = buildChatSystemBlocks(stable, "\n\n[Earlier Conversation Summary]\nfoo")
    expect(blocks).toHaveLength(2)
    expect(blocks[1].text).toContain("Earlier Conversation Summary")
    expect(blocks[1].cache_control).toBeUndefined()
  })

  it("returns only the single cached block when there is no volatile content", () => {
    expect(buildChatSystemBlocks(stable, "")).toHaveLength(1)
    expect(buildChatSystemBlocks(stable, "   \n  ")).toHaveLength(1)
  })
})
