# One guard for the whole request preamble, not a wrapper per concern

Every route module opened with some subset of: derive a client identifier and
check a limiter, compare the CSRF header against the cookie, resolve the current
user, parse the body, and close with a catch that logs and 500s. That subset was
about a fifth of all route text, respelled across 88 modules. Routes now declare
a policy and `guard` in `app/lib/guarded-route.ts` owns how each requirement is
met.

The reason this is worth a decision rather than a refactor note: repetition was
not the real cost. Because there was no interface for a route to be absent from,
nothing could detect an omission — and guards had gone missing. Eight
state-changing routes verified CSRF but had no limiter, two had a limiter but no
CSRF, and one derived its rate-limit identifier from the client-controlled end
of `x-forwarded-for`, defeating its own limit with a header.

## Considered options

**A wrapper per concern** was the obvious path and had already been tried three
times in this codebase, and abandoned three times. `withRateLimit` ended with
zero production callers while six test files mocked it. `withCsrfProtection`
reached three callers against sixty-one inline. `errors.ts` reached zero
importers and was deleted. Each covered one band of the preamble, so a route
still had to hand-roll the rest, and hand-rolling all of it stayed the path of
least resistance. Partial coverage is why they did not stick, so the guard
covers the whole preamble or it is not worth building.

**Middleware** was rejected because it cannot hand a typed user and a parsed
body to the handler, which is most of the benefit.

## Consequences

Order is part of the interface and is fixed: limiter, then CSRF, then auth, then
body. Cheapest and most hostile first, so a flood is rejected before it costs a
database round trip and a forged request before its body is read. Tests assert
this ordering, because changing it changes the security properties.

`csrf` defaults to true for POST, PUT, PATCH and DELETE, matching the rule the
inline code applied by hand. Turning it off is explicit and wants a reason at the
call site.

The 401 body is standardised to `{ error: "Unauthorized" }`. Routes previously
split 84 to 49 between that and `"User not found"`, which was wrong for a 401
anyway.

Migration is deliberately in batches rather than one sweep of 88 modules. The
existing route tests are thin — roughly a third of their lines are mocks of the
very preamble being replaced — so the safety net is weakest exactly where the
change lands.
