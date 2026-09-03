# InfiniStar

A platform for chatting with AI characters that hold their voice across long
relationships, and for creators to publish characters other people can find and
support. This glossary fixes the words the codebase uses, because several of
them are overloaded elsewhere in the category.

## Language

### The people

**Chatter**:
Someone who talks to characters. The primary audience.
_Avoid_: end user, consumer

**Creator**:
Someone who publishes a character other people can find. A chatter and a
creator are the same account in different roles, never separate records.
_Avoid_: author, owner, publisher

**Participant**:
A person attached to a conversation, seen from another person's point of view.
Distinct from the account: a participant is only ever the small safe projection
of a user, never the whole record.
_Avoid_: member, user (when you mean somebody else in a conversation)

### The fiction

**Character**:
A published fiction with a voice: its own prompt, scenario and example
dialogues. What a chatter talks to.
_Avoid_: bot, agent, assistant, AI

**Personality**:
One of the fixed preset voices the product ships. Not a character, and not
authored by anyone. The two are separate concepts that pricing copy has
confused before.
_Avoid_: persona, character preset

**Persona**:
Who the _chatter_ is inside a story. Belongs to the chatter, not the character,
and one chatter may hold several.
_Avoid_: profile, alter, personality

**Scenario**:
The situation a conversation opens in, authored on the character.

**Memory**:
A fact extracted from a conversation and kept against the character, so a later
turn can refer back to it. What makes a relationship accumulate rather than
reset.
_Avoid_: note, fact, context

**Scene**:
A conversation holding several characters at once.
_Avoid_: group chat (that is the human-to-human kind)

**Remix**:
A fork of an existing character into a new one owned by the forker.
_Avoid_: copy, clone, duplicate

### Talking

**Turn**:
One exchange: the input, everything assembled around it (character, persona,
scenario, memories, summary), and the reply. The unit that must be assembled
identically however it was triggered.
_Avoid_: request, generation, completion

**Regeneration**:
Replacing the most recent reply of an existing turn. It submits no new input
and does not lengthen the conversation, which is why several things that apply
to a new turn deliberately do not apply to it.
_Avoid_: retry, re-roll

**Wire format**:
The shape a message takes once it leaves the database: in a response, in a
server-rendered payload, or broadcast to a channel. Distinct from the stored
row, and deliberately narrower.
_Avoid_: DTO, payload shape

### Money and limits

**Tier**:
Free or PRO. Determines the monthly message allowance and which models are
reachable.
_Avoid_: plan (that is Stripe's word for its own object), subscription

**Allowance**:
How many AI messages a tier grants per calendar month.
_Avoid_: quota, credits, limit

**Claim**:
A durable record that a provider's webhook event has been taken, written before
any side effect runs so that a retry cannot double-process it.
_Avoid_: lock, idempotency key

### Safety

**Mature content**:
Content behind the age gate. Reachable only by an account that has confirmed
adulthood _and_ opted in; the two are separate facts and both are required.
_Avoid_: NSFW (still the column name, but not the word to reason with)
