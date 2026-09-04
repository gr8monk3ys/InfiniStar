# InfiniStar

AI character chat app: Next.js 16 App Router, React 19, TypeScript, Prisma + Postgres (Neon), Clerk auth, Stripe (free/PRO), Pusher real-time, Anthropic SDK for the model. Bun everywhere. Live: https://infini-star.vercel.app

## Run / test

```bash
bun install && cp .env.template .env.local        # fill it in
bunx prisma migrate dev && bun run dev            # localhost:3000
set -a; source .env.ci.example; set +a            # dummy env so env.mjs validation passes
bun run lint && bun run typecheck
bun run test --runInBand                          # Jest. NOT `bun test` (no jest.resetModules/jsdom; false failures)
bun run test:integration                          # needs a real DATABASE_URL
SKIP_ENV_VALIDATION=1 bun run build
```

CI (`.github/workflows/ci.yml`, one job named `CI`) runs exactly lint → typecheck → test → build. Repo is private; Actions minutes are capped, so nothing else is scheduled.

## Where things live

- `app/(auth)`, `app/(dashboard)/dashboard`, `app/(marketing)`, `app/(docs)` — route groups (not in URLs)
- `app/api/` — REST routes incl. `webhooks/{clerk,stripe}`, `cron/*`, `csrf`, `health`, `ai/chat-stream`
- `app/actions/` — server-side data fetching; `app/lib/` — `prismadb.ts`, `csrf.ts`, `rate-limit.ts`, `sanitize.ts`, `ai.ts`, `stripe.ts`
- `prisma/schema.prisma` (UUID ids, `@db.Uuid`), migrations in `prisma/migrations/` — production uses `migrate deploy`, never `db push`
- `env.mjs` — typed env schema; `.env.template` lists every variable
- `app/__tests__/` Jest unit, `tests/` integration, `e2e/` Playwright
- `CONTEXT.md` — the domain glossary. Read it before naming anything; several
  terms (personality vs persona vs character, tier vs plan) are overloaded and
  the codebase has been bitten by conflating them
- `docs/adr/` — decisions that look wrong without their reasoning. Check here
  before "fixing" something deliberate

## Gotchas

- Zod v4 rejects non-RFC-4122 UUIDs: test ids need a valid version/variant, e.g. `11111111-1111-4111-8111-111111111111`.
- `app/lib/stripe.ts` does not pin `apiVersion`; the SDK's own default is used so Stripe bumps don't break typecheck.
- All POST/PUT/PATCH/DELETE routes validate a double-submit CSRF token (`app/lib/csrf.ts`, client hook `app/hooks/useCsrfToken.ts`).
- Rate limiting and 2FA tokens are Redis-backed when `REDIS_URL` is set, in-memory otherwise; set it for any multi-instance deploy.
- `ENABLE_FALLBACK_AUTH` enables a bcrypt/cookie auth path as a hedge against a Clerk outage. Keep it off; every route re-checks the flag server-side.
- Free tier: `AI_FREE_MONTHLY_MESSAGE_LIMIT` (default 50) messages/month, tracked in the `AiUsage` model.
- Cron routes `/api/cron/auto-delete` and `/api/cron/process-deletions` are protected by `CRON_SECRET`.
- **Production deploys run `prisma migrate deploy` first** (`buildCommand` in
  `vercel.json`, guarded on `VERCEL_ENV`). A failing migration fails the build,
  so code never ships ahead of its schema. Before this existed, eight
  migrations sat unapplied from February to September and personas,
  attribution, fallback auth and the roleplay fields were missing in
  production while the code expected them.
- **Preview deploys share the production database.** `DATABASE_URL` is scoped
  to Production, Preview and Development with the same value, so a PR preview
  reads and writes live data. That is why migrations are gated to production
  builds only — otherwise every preview of a branch would apply its migrations
  to production before review.
- Migrations need `DIRECT_URL`: Neon's pooled connection cannot run them. It is
  set in the Vercel project; locally, `vercel env pull .env` then run, because
  `prisma.config.ts` reads `.env` and not `.env.local`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `gr8monk3ys/InfiniStar`, driven by the `gh` CLI.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name: `needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. Both exist and
are worth reading before changing anything in an area they cover. See
`docs/agents/domain.md`.
