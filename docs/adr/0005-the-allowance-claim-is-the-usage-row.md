# The Allowance Claim is the usage row, taken under an advisory lock

`getAiAccessDecision` counted a chatter's messages for the month and
`trackAiUsage` wrote the row, and nothing reserved anything in between. Two
turns at 49 of 50 both counted 49 and both proceeded. `aiChatLimiter` allows
20 requests a minute, which is the size of the overshoot.

ADR-0001 already has the word for the fix — a **Claim**, "written before any
side effect runs" — and this is the same shape with one difference. A webhook
claim is keyed on the provider's event id and enforced by a unique constraint.
An Allowance has no such id: the thing being claimed is "one of this month's
fifty", which is a count, not a name. So the serialisation comes from a
transaction-scoped Postgres advisory lock keyed on the chatter
(`pg_advisory_xact_lock(hashtext(userId))`) rather than from a constraint. Two
turns from one account queue; turns from different accounts never contend, and
the lock is released when the transaction ends, including on rollback.

## Considered options

**A separate reservations table** was rejected. It would be a second answer to
"how many messages has this chatter sent this month", and this codebase has
already been bitten by exactly that: the displayed Allowance and the enforced
Allowance drifted apart because the month was counted in two places, with the
dashboard omitting the `summary-auto` exclusion. A third counter is a third
chance to drift. The Claim is the `AiUsage` row itself, written with zero
tokens and filled in when the reply lands, so there is still one place a month
is counted.

**Holding the lock across the provider call** was rejected outright: it would
keep a database transaction open for the whole of a streamed response.

**A `Serializable` transaction** would also close the race, by making the two
count-then-insert transactions conflict. It was rejected because it needs retry
handling at every call site for a conflict that an advisory lock simply avoids,
and because it serialises against unrelated writers rather than only against
the same chatter's other turns.

## Consequences

A turn now costs one extra write: the reservation, then an update. That is the
price of the guarantee, and it is paid on the counted conversational turns
only — image generation, transcription, suggestions and summaries still write
once, because their limits are low-volume feature counts rather than a
high-concurrency message allowance.

A Claim is released **only** when the turn produced nothing. Once
`trackAiUsage` has filled the row in there is real usage on it, and releasing
would hand back a slot that was genuinely spent — a free message. The routes
track this with a `usageRecorded` flag, and a test asserts that removing the
check gives the message away.

A Claim can outlive its turn if the process dies between reserving and
finalising. Such a row keeps `model: "pending"` and zero tokens, and it counts
against the chatter's month. That is the safe direction to fail in — it costs
one message rather than giving one away — but it means a persistent `"pending"`
row is a signal worth watching, not noise.
