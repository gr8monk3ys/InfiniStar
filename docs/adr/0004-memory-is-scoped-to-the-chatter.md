# Memory is scoped to the chatter, not to the character

`CONTEXT.md` defined a **Memory** as "a fact extracted from a conversation and
kept against the character", while `ai-memory.ts` said it "allows the AI to
remember important information across conversations" — and the schema, which has
no `characterId` on `AIMemory`, implements the second reading. Elara knows what
you told Bram.

An architecture review flagged the disagreement, and the reasonable-looking fix
is to scope Memory per Character. That is the wrong way round: the glossary is
what is out of date, not the code.

The shipped product treats memories as the chatter's own. There is one Memory
manager, in settings, listing every memory with an importance and a category;
the chatter edits and deletes them there. Nothing in that surface is
per-character, and the `@@unique([userId, key])` constraint means a key like
`favorite_color` is one fact about the person, not one fact per relationship.
Scoping per Character would turn one list into N lists, require a migration that
assigns every existing memory to a character it was never attached to, and make
`canCreateMemory`'s tier limits (50 free, 200 PRO) mean something different.
That is a product change, and no one has asked for it.

`CONTEXT.md` is updated to say what the code does. The line about a relationship
accumulating rather than resetting still holds — it accumulates across every
conversation the chatter has, which is more than the per-character reading would
give them, not less.

## Considered options

**Scoping Memory per Character** was rejected for the reasons above. If it is
ever wanted, it is a feature with a migration and a UI, not a refactor.

**Leaving the `_context` parameter in place** was rejected. `getRelevantMemories`
took `_context?: string`, never read it, and carried a comment about future
semantic matching. An unused parameter that implies a scope the function does not
have is worse than no parameter: it reads as a seam, and a seam with no adapter
behind it is a hypothetical. It is removed; the function takes the chatter.

## Consequences

Every Character a chatter talks to draws on the same set of memories. That is
intended. If two characters should not share what they know, that is a product
decision to make deliberately, and this ADR is the thing to revisit.
