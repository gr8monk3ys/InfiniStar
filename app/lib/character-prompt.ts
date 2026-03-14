/**
 * Builds an enriched system prompt from character data.
 *
 * Combines the base system prompt with scenario context and example dialogues
 * to give the AI concrete behavioral anchors for roleplay.
 */
export function buildCharacterSystemPrompt(character: {
  systemPrompt: string
  scenario?: string | null
  exampleDialogues?: string | null
}): string {
  const parts: string[] = [character.systemPrompt]

  if (character.scenario) {
    parts.push(`\n\n[Scenario]\n${character.scenario}`)
  }

  if (character.exampleDialogues) {
    parts.push(`\n\n[Example Dialogue]\n${character.exampleDialogues}`)
  }

  return parts.join("")
}
