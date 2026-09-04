# Production readiness: closing the nine-axis gap

Status: approved 2026-09-03. Supersedes nothing.

## Why

An audit on 2026-09-03 ran the full gate — lint, typecheck, 1180 unit tests, a
production build, live probes against the deployment, and seven days of Vercel
runtime logs. The code graded well and the operations around it did not.

The verified state:

| Check                                 | Result                                       |
| ------------------------------------- | -------------------------------------------- |
| `bun run lint`                        | exit 0                                       |
| `bun run typecheck`                   | clean                                        |
| `bun run test --runInBand`            | 1180 pass / 0 fail, 108 suites               |
| `SKIP_ENV_VALIDATION=1 bun run build` | exit 0                                       |
| Vercel runtime errors, 7d             | 1 group, 52 events, all one `pg` SSL warning |
| 10 public routes                      | all 200, p95 under 1s                        |
| Open Dependabot alerts                | 0                                            |
| `as any` / `@ts-ignore` in app code   | 0                                            |
| Statement coverage                    | 29.16%                                       |

The grades that follow, and the work below, come from that run.

| Axis                             | Now | Target |
| -------------------------------- | --- | ------ |
| Code quality and type safety     | A−  | A      |
| Security architecture (design)   | A−  | A      |
| Security architecture (adoption) | C+  | A      |
| Domain docs and ADRs             | A−  | A      |
| Test depth                       | C   | A      |
| CI gating                        | C   | A      |
| Observability and alerting       | C−  | A      |
| Production operations            | D+  | A      |
| Launch readiness                 | D   | A      |

## Decisions taken

Four questions were settled before design:

1. **Distributed state** — move to Upstash with `@upstash/redis`, rather than
   repairing the `ioredis` URL or dropping Redis for Postgres.
2. **Canonical domain** — `infini-star.vercel.app`. `infinistar.app` is
   NXDOMAIN and will not be registered.
3. **Coverage bar** — tiered floors enforced in CI: `app/lib` and `app/api` at
   80%, global at 60%. Not a uniform 80%.
4. **Execution** — everything that does not require the owner's credentials.

Two items are therefore owner-blocked and are called out as such below.

## Principle

This repo already states the rule that shapes most of this work: _shape is
computed, never eyeballed_. Three of the nine axes fail today because an
invariant is asserted in prose and nothing checks it — the guard contract, the
coverage floor, and the docs' own references. Each gets a check that fails CI,
landed **before** the bulk work it governs, so the invariant cannot regress
while the work is in flight.

## The work, by axis

### 1. Production operations (D+ → A)

`/api/health` returns **HTTP 503** on every call, reproduced four times:

```json
{ "status": "degraded", "database": "connected", "redis": "disconnected" }
```

`redis: "disconnected"` requires `REDIS_URL` to be _set_ and unreachable — so a
broken value is configured in Vercel production. Per `CLAUDE.md`, that means
rate limiting and 2FA token storage have silently fallen back to in-memory
storage on serverless, which is per-instance, which is not enforcement.

The client compounds it. `app/lib/redis.ts` constructs `ioredis` with
`lazyConnect: false` — a raw TCP connection opened at module load inside a
serverless function.

**Change.** Substitute `@upstash/redis` behind the existing `IRateLimiter`
interface. The Redis surface is four files (`app/lib/redis.ts`,
`app/lib/rate-limit.ts`, `app/lib/two-factor-tokens.ts`,
`app/api/health/route.ts`) and `IRateLimiter` is three methods
(`check`, `reset`, `cleanup`), so this is a substitution behind a stable
contract, not a rewrite. The in-memory fallback stays for local development.

**Also.** Set `sslmode` explicitly on the Postgres connection string. The
deprecation warning is 52 of 52 production log events, and `pg` v9 /
`pg-connection-string` v3 convert it from a warning into a behavior change.

**Owner-blocked.** Provisioning the Upstash integration and clearing the stale
`REDIS_URL`. Code and fallback land first; the checklist is handed over.

### 2. CI gating (C → A)

`.github/workflows/ci.yml` runs lint → design:check → typecheck → unit →
build. It does not run:

- **35 collected Playwright tests** across 13 specs, covering payments, auth
  redirects, conversation sharing, account deletion and voice. (The suite
  declares more; most sit in describe blocks that skip themselves without
  live credentials.)
- **2 integration suites** (`app/__tests__/integration/`) against real Postgres.

Both configs already reference a CI job that was never written —
`jest.integration.config.js` names "the `integration` CI job" in its own header
comment. The money path and the auth path are covered only by tests nobody
runs.

The constraint that justified this is gone: `CLAUDE.md` says "Repo is private;
Actions minutes are capped", but the repo is **public**, so Actions minutes are
unlimited.

**Change.** Two new jobs in `ci.yml`:

- `integration` — Postgres service container, `prisma migrate deploy`, then
  `bun run test:integration`.
- `e2e` — Playwright against the config's existing `.env.ci.example` +
  `SKIP_CLERK_AUTH_HANDSHAKE` path, which is already built for running without
  live Clerk credentials.

Both added to `master` branch protection as required checks.

### 3. Security architecture — adoption (C+ → A)

`guard()` (`app/lib/guarded-route.ts`, ADR 0003) is the right abstraction and is
used by **7 of 89 routes**. The other 82 hand-roll the preamble. Its own
docstring enumerates the defects that follow from having no interface to be
absent from, and the audit confirmed they are still live:

- 6 mutating routes with **no rate limiter**, including
  `POST/PATCH/DELETE /api/conversations`.
- `clerk-proxy` derives its forwarded-for from the client-controlled end.

**Change, in order.**

1. `guard()` tags the handler it returns.
2. A Jest suite globs `app/api/**/route.ts` and asserts every exported method
   handler carries the tag, or appears in an allowlist where each entry states
   its reason. The candidate exceptions are the signature-verified and
   public entry points — `webhooks/clerk`, `webhooks/stripe`, `pusher/auth`,
   `csrf`, `health` — but each is first tried as `guard({ auth: "none" })`
   and allowlisted only where the guard genuinely cannot express it.
3. The 6 unlimited routes migrate first — they are the defect, not just the
   duplication.
4. The remaining routes migrate in directory-sized batches until the allowlist
   is the entire exception set.

Enforcement lands before the bulk migration so no batch can silently reintroduce
what it just removed.

### 4. Security architecture — design (A− → A)

`app/api/clerk-proxy/[[...path]]/route.ts` sets
`X-Forwarded-For` from `request.headers.get("x-forwarded-for")` unmodified and
forwards it upstream to Clerk. Clerk's bot protection and rate limiting key on
that header, so a client that sets it chooses its own identity for Clerk's abuse
controls.

**Change.** Take the trusted hop rather than the client-supplied chain, and
assert the rewritten upstream URL still resolves under the Clerk base path
before the request is issued.

### 5. Test depth (C → A)

1180 passing tests produce 29.16% statement coverage, because they concentrate
on `lib` and `api`:

```
 49.8%  app/api          14.9%  app/components
 45.9%  app/lib           8.4%  app/hooks
 22.9%  app/(marketing)   7.8%  app/(dashboard)
                          6.3%  app/actions
```

**Change.** Add `coverageThreshold` to `jest.config.js` — `app/lib` and
`app/api` at 80%, global at 60% — and run coverage in CI. Land the thresholds at
today's measured numbers first so nothing can regress, then raise them as tests
land. Priority order for new tests follows blast radius: `app/actions` (6.3%,
and every page depends on it), then `app/api` to 80%, then `app/lib`.

### 6. Observability and alerting (C− → A)

The 503 has stood long enough that nobody noticed, which says more about
alerting than about Redis. Sentry is wired (`tracesSampleRate: 0.1`) and the
runtime log is otherwise clean.

**Change.** Report the degradation from the code path that causes it: when
`getRedisClient()` returns null in production, rate limiting and 2FA tokens have
silently become per-instance, so that call reports to Sentry at error level,
once per cold start.

A scheduled probe of `/api/health` was considered and rejected. Every cron in
`vercel.json` runs daily, which is this project's plan granularity, so a probe
would find an outage up to 24 hours late. The fallback path fires on real
traffic instead. Pair it with a Sentry alert rule that reaches a person — the
report existing is not the same as someone seeing it, and that gap is exactly
what let the original 503 stand.

Also audit the existing Sentry alert rules, and move the 5 server-side
`console.*` calls in `app/lib` to the structured logger.

**Explicitly not doing:** a blanket `console.*` → logger migration. 31 of the
36 calls are in client components and hooks, where `console.error` is the
correct browser-side behavior and pino is not.

### 7. Domain docs and ADRs (A− → A)

Three documented claims are false:

- `README.md:67` links `runbooks/` — the directory does not exist.
- `DEPLOYMENT.md:142` instructs `bun run ops:sentry:alerts:audit` — no such
  script.
- `CLAUDE.md` says the repo is private — it is public.

**Change.** Write the runbooks the README promises (incident, rollback,
secrets, Stripe, Sentry, DB drill), correct the other two, and add a check that
every filesystem path and `bun run` script named in the docs resolves. Same
principle as the guard check: the claim is computed, not eyeballed.

### 8. Launch readiness (D → A)

`support@infinistar.app` is hardcoded in 8 files. One of them is
`app/(docs)/privacy/page.tsx`, where it is the GDPR data-rights contact — a
legal document naming an address that cannot receive mail, on a domain that does
not resolve.

With `infini-star.vercel.app` canonical, the sitemap and canonicals are already
correct; the support contact is the whole remaining defect.

**Change.** Centralize the address to a single constant so the value is a
one-line change, and replace every hardcoded occurrence.

**Owner-blocked.** The actual address. `SMTP_FROM` is still `ci@example.com`,
so there is no verified sender to infer one from.

### 9. Code quality and type safety (A− → A)

The smallest gap on the board: zero `any`, zero `@ts-ignore`, lint clean, 2
TODOs. `app/lib/themes.ts` (718 lines) is a data table and is left alone. No
refactoring is manufactured here to justify a letter grade.

## Sequencing

Eight PRs, each independently green and reviewable, each branched from
`master`. Small shaped diffs, per the fleet merge policy.

1. CI gating — `integration` + `e2e` jobs, coverage threshold pinned at today's floor
2. Upstash substitution + explicit `sslmode`
3. `guard()` enforcement check + the 6 unlimited routes + `clerk-proxy` hardening
4. Guard migration, batch 1
5. Guard migration, batch 2
6. Guard migration, batch 3
7. Docs truth check + runbooks + support-contact centralization
8. Coverage push to the tiered thresholds

## Done means

- `/api/health` returns 200 in production.
- CI runs unit, integration and e2e, and all three are required on `master`.
- The guard check passes, and every allowlist entry states why the guard
  cannot express that route.
- `coverageThreshold` holds at lib/api 80%, global 60%.
- A production fallback to in-memory storage reports to Sentry, and an alert
  rule on it reaches a person.
- No document names a path, script, address or domain that does not resolve.
