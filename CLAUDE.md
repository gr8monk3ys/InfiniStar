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

## Gotchas

- Zod v4 rejects non-RFC-4122 UUIDs: test ids need a valid version/variant, e.g. `11111111-1111-4111-8111-111111111111`.
- `app/lib/stripe.ts` does not pin `apiVersion`; the SDK's own default is used so Stripe bumps don't break typecheck.
- All POST/PUT/PATCH/DELETE routes validate a double-submit CSRF token (`app/lib/csrf.ts`, client hook `app/hooks/useCsrfToken.ts`).
- Rate limiting and 2FA tokens are Redis-backed when `REDIS_URL` is set, in-memory otherwise; set it for any multi-instance deploy.
- `ENABLE_FALLBACK_AUTH` enables a bcrypt/cookie auth path as a hedge against a Clerk outage. Keep it off; every route re-checks the flag server-side.
- Free tier: `AI_FREE_MONTHLY_MESSAGE_LIMIT` (default 50) messages/month, tracked in the `AiUsage` model.
- Cron routes `/api/cron/auto-delete` and `/api/cron/process-deletions` are protected by `CRON_SECRET`.
