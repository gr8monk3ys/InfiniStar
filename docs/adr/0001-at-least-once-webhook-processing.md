# At-least-once webhook processing, claimed in Postgres

Stripe retries a webhook until it gets a 2xx, and our tip and subscription
handlers are not naturally idempotent, so a duplicate delivery could take a
payment effect twice. The guard that prevented this was a Redis `SET NX`
wrapped in `if (redis)`, with no `else` — and `REDIS_URL` is optional, so on any
deploy without Redis the protection silently vanished with no error and a
correct-looking 200. The claim now lives in Postgres, which is always present.

## Considered options

**Read-then-write** (check for a prior row, then insert) was rejected because
two concurrent retries both read nothing and both proceed. The claim is
therefore an insert guarded by a unique constraint, and a duplicate is detected
by the constraint violation rather than by a prior read.

**At-most-once** (claim, run, never release) was rejected because a handler that
throws would leave the event marked processed and the work undone. Dropping a
paid tip is worse than repeating an upsert keyed on a Stripe id.

**Keeping Redis as a fast path in front of Postgres** was rejected because the
two stores would need invalidating in lockstep: a failed handler releases the
Postgres claim, and a surviving Redis key would then short-circuit the retry
and lose the work permanently. One saved insert is not worth that.

## Consequences

The claim commits _before_ the side effects, and a thrown handler releases it so
the error propagates as a non-2xx and Stripe retries. Handlers must therefore be
safe to run twice; they are, being upserts keyed on Stripe identifiers.

A hard process kill between the claim and the release leaves an unreleased
claim, and that event will be skipped. No in-process scheme covers this; it
would need a lease with an expiry.

The ledger is durable, so unlike the Redis key it does not expire. A daily cron
prunes claims older than 30 days, which is well clear of Stripe's three-day
retry window.
