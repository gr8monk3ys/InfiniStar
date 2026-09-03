# Regenerations are logged as `chat`, not as their own request type

A regeneration is its own kind of turn, and logging it under a shared label
makes it invisible in usage analytics. It is still logged as `chat`, and that is
deliberate rather than an oversight.

`AiRequestType` has no regenerate variant, and adding one is not free: both the
access decision in `ai-access.ts` and the usage dashboard count a month's
messages with `requestType: { in: ["chat", "chat-stream"] }`. A new value would
fall outside both filters, so regenerations would stop counting against the free
allowance and a free chatter could regenerate past it indefinitely. The value is
load-bearing for billing, not just descriptive.

It previously logged as `chat-stream`, which was worse: it claimed the row came
from the send endpoint. `chat` at least does not lie about the origin, and stays
inside the counted pair.

## Consequences

Regenerations are not distinguishable from ordinary chat turns in `AiUsage`.
Making them so means adding `"regenerate"` to the type _and_ to both `in: [...]`
filters _and_ to the schema comment, together, in one change. That is an
accounting decision, not a rename, which is why it was not slipped in alongside
a bug fix.
