/**
 * Assembling a Turn.
 *
 * CONTEXT.md defines a **Turn** as "one exchange: the input, everything
 * assembled around it (character, persona, scenario, memories, summary), and
 * the reply — the unit that must be assembled identically however it was
 * triggered." Four routes triggered one and each assembled it themselves, so
 * "identically" was not true of any two of them:
 *
 *  - `/api/ai/regenerate` read the **oldest** twenty messages rather than the
 *    newest — `createdAt < message.createdAt` with `orderBy: asc` and `take: 20`
 *    selects from the start of the conversation, not the end. Past twenty
 *    messages every Regeneration was assembled from the opening of the chat.
 *  - `/api/ai/chat` never fetched memories at all. The only structural
 *    difference between its assembly and `/api/ai/chat-stream`'s was a nine-line
 *    memory block.
 *  - `/api/ai/chat` and `/api/ai/chat-stream` fed soft-deleted messages to the
 *    model where `/api/ai/regenerate` filtered them.
 *
 * None of that was visible to the tests, because there was no interface for a
 * part of a Turn to be absent from — the same argument ADR-0003 makes for the
 * request preamble. The prompt eval suite covers the leaves
 * (`buildCharacterSystemPrompt`, `buildMemoryContext`, `getSystemPrompt`) and
 * could not cover their composition, because the composition was not a module.
 *
 * What stays with the caller is what genuinely varies: whether the reply is
 * streamed, where it is written (a new message, or a new variant on an existing
 * one), which event announces it, and the access and moderation decisions that
 * run before any of this.
 */

import type Anthropic from "@anthropic-ai/sdk"

import { buildMemoryContext, getRelevantMemories } from "@/app/lib/ai-memory"
import { buildAiConversationHistory } from "@/app/lib/ai-message-content"
import { getModelForUser } from "@/app/lib/ai-model-routing"
import {
  getDefaultPersonality,
  getSystemPrompt,
  isValidPersonality,
} from "@/app/lib/ai-personalities"
import { buildChatSystemBlocks, type SystemTextBlock } from "@/app/lib/ai-system-prompt"
import { buildCharacterSystemPrompt } from "@/app/lib/character-prompt"
import { renderSummaryForPrompt } from "@/app/lib/conversation-summary"
import { aiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

/**
 * How much recent history a Turn carries. The window is "the newest N", and
 * stating it once is the point: the three routes previously spelled the same
 * intent three ways and one of them selected the oldest N instead.
 */
export const TURN_HISTORY_LIMIT = 20

/**
 * What a Turn needs from the conversation row.
 *
 * Callers load the conversation anyway — to check it is an AI conversation, to
 * apply the mature-content gate, to title a push notification — so the module
 * takes the loaded row rather than re-reading it. This constant is what keeps
 * "the fields a Turn is assembled from" stated in one place; a caller that
 * loads less will not type-check.
 */
export const TURN_CONVERSATION_INCLUDE = {
  character: {
    select: {
      name: true,
      isNsfw: true,
      systemPrompt: true,
      scenario: true,
      exampleDialogues: true,
    },
  },
  persona: {
    select: {
      name: true,
      description: true,
      appearance: true,
      personalityTraits: true,
    },
  },
} as const

/** The conversation fields a Turn is assembled from. */
export interface TurnConversation {
  id: string
  aiModel: string | null
  aiPersonality: string | null
  aiSystemPrompt: string | null
  summary: string | null
  character: {
    name: string | null
    systemPrompt: string
    scenario: string | null
    exampleDialogues: string | null
  } | null
  persona: {
    name: string
    description: string | null
    appearance: string | null
    personalityTraits: string | null
  } | null
}

export interface AssembledTurn {
  /** The model this Turn is routed to, given the chatter's Tier. */
  model: string
  /** Anthropic `system` blocks, already split for prompt caching. */
  system: SystemTextBlock[]
  /** Recent history in chronological order, with the new input appended. */
  messages: Anthropic.Messages.MessageParam[]
}

export interface AssembleTurnArgs {
  conversation: TurnConversation
  /** The chatter, whose memories the Turn recalls. */
  userId: string
  /** Tier decides model reachability. */
  isPro: boolean
  /**
   * New chatter input to append. Omitted for a Regeneration, which "submits no
   * new input and does not lengthen the conversation".
   */
  input?: Anthropic.Messages.MessageParam["content"]
  /**
   * For a Regeneration: assemble history as it stood immediately before this
   * reply, so the model is asked the same question again rather than a
   * different one.
   */
  before?: Date
}

/**
 * Renders the chatter's Persona — who the chatter is inside the story, as
 * distinct from the Character they are talking to.
 *
 * Exported for the prompt eval suite. It was previously inlined verbatim in
 * three routes, which is a fact restated per call site rather than stated once.
 */
export function buildPersonaContext(persona: TurnConversation["persona"]): string {
  if (!persona) {
    return ""
  }

  const parts = [`\n\n[User Persona]\nThe user is roleplaying as: ${persona.name}`]
  if (persona.description) parts.push(`Description: ${persona.description}`)
  if (persona.appearance) parts.push(`Appearance: ${persona.appearance}`)
  if (persona.personalityTraits) parts.push(`Personality: ${persona.personalityTraits}`)
  parts.push("Address the user as this persona and react to their described traits naturally.")

  return parts.join("\n")
}

/**
 * The newest `TURN_HISTORY_LIMIT` messages of a conversation, oldest-first.
 *
 * Selecting the newest requires ordering descending and reversing; ordering
 * ascending with a `take` selects the *oldest*, which is the bug this replaces.
 * Soft-deleted messages are excluded — their body is nulled on delete, so they
 * would drop out of the Anthropic payload anyway, but excluding them here keeps
 * the window a window of twenty real messages rather than twenty rows.
 */
async function loadRecentHistory(
  conversationId: string,
  before?: Date
): Promise<Anthropic.Messages.MessageParam[]> {
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      isDeleted: false,
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: TURN_HISTORY_LIMIT,
    select: { isAI: true, body: true, image: true },
  })

  return buildAiConversationHistory(messages.slice().reverse())
}

/**
 * Assembles everything the model is asked with, for one Turn.
 *
 * The system prompt is split for prompt caching: the character-and-persona
 * prefix is stable across every Turn of a conversation and carries the cache
 * breakpoint, while the summary and memories are volatile and go in a separate
 * trailing block, so refreshing a summary or adding a Memory does not bust the
 * cached prefix. `buildChatSystemBlocks` owns that split; this module's job is
 * to put the right text on each side of it.
 */
export async function assembleTurn({
  conversation,
  userId,
  isPro,
  input,
  before,
}: AssembleTurnArgs): Promise<AssembledTurn> {
  const model = getModelForUser({
    isPro,
    requestedModelId: conversation.aiModel,
  })

  // A Character conversation rebuilds its prompt from the character row on
  // every Turn, so edits to a Character — and the roleplay guardrails — reach
  // conversations that already exist instead of being frozen at creation.
  const personalityType =
    conversation.aiPersonality && isValidPersonality(conversation.aiPersonality)
      ? conversation.aiPersonality
      : getDefaultPersonality()

  const basePrompt = conversation.character?.systemPrompt
    ? buildCharacterSystemPrompt(conversation.character)
    : getSystemPrompt(personalityType, conversation.aiSystemPrompt || undefined)

  const stablePrompt = basePrompt + buildPersonaContext(conversation.persona)

  let volatileContext = renderSummaryForPrompt(conversation.summary)

  // Memory is what makes a relationship accumulate rather than reset, so a
  // failure to read it degrades the Turn rather than failing it.
  try {
    const memories = await getRelevantMemories(userId)
    if (memories.length > 0) {
      volatileContext = volatileContext + "\n" + buildMemoryContext(memories)
    }
  } catch (error) {
    aiLogger.warn({ err: error, conversationId: conversation.id }, "Failed to fetch memories")
  }

  const messages = await loadRecentHistory(conversation.id, before)
  if (input) {
    messages.push({ role: "user", content: input })
  }

  return {
    model,
    system: buildChatSystemBlocks(stablePrompt, volatileContext),
    messages,
  }
}
