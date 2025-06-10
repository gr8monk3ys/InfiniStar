/**
 * Builds the Anthropic `system` blocks for a chat turn, split so that prompt
 * caching actually pays off.
 *
 * The character/persona prefix is stable across every turn of a conversation,
 * so it goes in the first block and carries the single `ephemeral` cache
 * breakpoint — that large prefix is what we want cached (~90% input-token
 * savings in roleplay). Volatile context (the regenerating conversation summary
 * and the user's evolving memories) goes in a SEPARATE trailing block with no
 * breakpoint. Anthropic caches the longest common prefix up to a breakpoint, so
 * keeping the volatile text after the breakpoint means regenerating the summary
 * or adding a memory no longer invalidates the cached character prompt.
 */
export interface SystemTextBlock {
  type: "text"
  text: string
  cache_control?: { type: "ephemeral" }
}

export function buildChatSystemBlocks(
  stablePrompt: string,
  volatileContext: string
): SystemTextBlock[] {
  const blocks: SystemTextBlock[] = [
    { type: "text", text: stablePrompt, cache_control: { type: "ephemeral" } },
  ]

  // Only append the trailing block when there is real content — Anthropic
  // rejects empty text blocks, and an empty block would serve no purpose.
  if (volatileContext.trim().length > 0) {
    blocks.push({ type: "text", text: volatileContext })
  }

  return blocks
}
