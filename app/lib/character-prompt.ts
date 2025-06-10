/**
 * Builds an enriched system prompt from character data.
 *
 * Combines the base system prompt with scenario context, example dialogues,
 * and roleplay guardrails to give the AI concrete behavioral anchors.
 */
export function buildCharacterSystemPrompt(character: {
  name?: string | null
  systemPrompt: string
  scenario?: string | null
  exampleDialogues?: string | null
}): string {
  const parts: string[] = [character.systemPrompt]

  if (character.scenario) {
    parts.push(`\n\n[Scenario]\n${character.scenario}`)
  }

  if (character.exampleDialogues) {
    parts.push(
      `\n\n[Example Dialogue]\nThe following examples show how this character speaks. Match their voice, tone, and style — do not copy the examples verbatim:\n\n${character.exampleDialogues}\n\n(End of examples. Respond only to the actual conversation below.)`
    )
  }

  const characterName = character.name?.trim()
  parts.push(
    `\n\n[Roleplay Rules]\n` +
      `- Stay fully in character${characterName ? ` as ${characterName}` : ""}. Do not mention being an AI or break the fourth wall unless the scenario calls for it.\n` +
      `- Never write actions, dialogue, or decisions for the user. Only portray your own character.\n` +
      `- Use *asterisks* for actions and expressions, e.g. *glances at the door*.\n` +
      `- Match the user's pacing: short messages get short replies; detailed messages can get detailed replies.\n` +
      `- If the user writes out of character (often marked with brackets or "OOC"), answer briefly out of character, then return to the scene.`
  )

  return parts.join("")
}
